import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;
const WIDTH = 1200;
const HEIGHT = 675;
const BENCHMARK_URL = `http://127.0.0.1:${PORT}/visual/rewild-benchmark.html`;
const ENTITY_ATLAS_URL = `http://127.0.0.1:${PORT}/rewild/overhead/entities-atlas-v3.png`;
const TERRAIN_ATLAS_URL = `http://127.0.0.1:${PORT}/rewild/overhead/terrain-atlas-v3.png`;
const BASELINE_PATH = join(ROOT, "tests/fixtures/rewild-ecosystem.sha256");
const ARTIFACT_DIR = join(ROOT, "artifacts");

const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

function touchesRewild() {
  if (process.env.GITHUB_ACTIONS !== "true") return true;
  const diff = spawnSync("git", ["diff", "--name-only", "origin/main...HEAD"], { cwd: ROOT, encoding: "utf8" });
  if (diff.status !== 0) return true;
  return diff.stdout.split(/\r?\n/).some((file) =>
    file.startsWith("app/rewild-")
    || file.startsWith("tests/rewild-")
    || file.startsWith("public/rewild/overhead/")
    || file.startsWith("config/rewild/")
    || file === "visual/rewild-benchmark.html"
    || file === "visual/rewild-vite.config.ts"
    || file === "scripts/check-rewild-visual.mjs"
    || file === "tests/fixtures/rewild-ecosystem.sha256",
  );
}

function findChrome() {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    if (spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0) return candidate;
  }
  throw new Error("Chrome/Chromium is required for the Rewild visual regression gate.");
}

function stopProcess(processHandle) {
  if (!processHandle?.pid || processHandle.exitCode !== null) return;
  try {
    if (process.platform === "win32") processHandle.kill("SIGTERM");
    else process.kill(-processHandle.pid, "SIGTERM");
  } catch {
    processHandle.kill("SIGTERM");
  }
}

async function waitForExit(processHandle, timeoutMs = 3000) {
  if (!processHandle || processHandle.exitCode !== null) return;
  await Promise.race([
    new Promise((resolveExit) => processHandle.once("exit", resolveExit)),
    sleep(timeoutMs),
  ]);
}

async function safeRemove(path) {
  try {
    await rm(path, { recursive: true, force: true, maxRetries: 8, retryDelay: 125 });
  } catch (error) {
    console.warn(`Rewild visual cleanup warning: ${error}`);
  }
}

async function waitForUrl(url, processHandle, label) {
  let lastError = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processHandle?.exitCode !== null) throw new Error(`${label} exited before becoming ready (code ${processHandle.exitCode}).`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 300 && response.status < 400) throw new Error(`redirected to ${response.headers.get("location")}`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError}`);
}

async function requireAsset(url, label) {
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`${label} is not served by the benchmark Vite server: HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image/png")) throw new Error(`${label} returned ${contentType || "an unknown content type"} instead of image/png.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error(`${label} is unexpectedly small (${bytes.length} bytes).`);
}

async function main() {
  if (!touchesRewild()) {
    console.log("Rewild visual benchmark skipped: pull request does not touch Rewild.");
    return;
  }

  const chrome = findChrome();
  const temp = await mkdtemp(join(tmpdir(), "rewild-visual-"));
  const rawScreenshot = join(temp, "chrome.png");
  const chromeProfile = join(temp, "chrome-profile");
  const server = spawn("npm", ["exec", "vite", "--", "--config", "visual/rewild-vite.config.ts"], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: "none" },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  let serverOutput = "";
  server.stdout?.on("data", (chunk) => { serverOutput += chunk.toString(); });
  server.stderr?.on("data", (chunk) => { serverOutput += chunk.toString(); });

  try {
    await waitForUrl(BENCHMARK_URL, server, "Rewild benchmark server");
    await requireAsset(ENTITY_ATLAS_URL, "Rewild entity atlas");
    await requireAsset(TERRAIN_ATLAS_URL, "Rewild terrain atlas");

    const chromeRun = spawnSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      "--force-device-scale-factor=1",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${WIDTH},${HEIGHT}`,
      "--virtual-time-budget=10000",
      `--user-data-dir=${chromeProfile}`,
      `--screenshot=${rawScreenshot}`,
      BENCHMARK_URL,
    ], { cwd: ROOT, encoding: "utf8", timeout: 30000 });

    if (chromeRun.status !== 0) {
      throw new Error(`Chrome benchmark capture failed.\n${chromeRun.stdout}\n${chromeRun.stderr}`);
    }

    const normalized = await sharp(rawScreenshot)
      .resize(WIDTH, HEIGHT, { fit: "fill", kernel: "nearest" })
      .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
      .toBuffer();
    const actual = createHash("sha256").update(normalized).digest("hex");
    const expected = (await readFile(BASELINE_PATH, "utf8")).trim();

    if (!/^[a-f0-9]{64}$/.test(expected)) {
      await mkdir(ARTIFACT_DIR, { recursive: true });
      await writeFile(join(ARTIFACT_DIR, "rewild-benchmark-actual.png"), normalized);
      console.error(`REWILD_BENCHMARK_SHA256=${actual}`);
      throw new Error("Rewild visual baseline is deliberately awaiting review. Inspect the uploaded benchmark artifact before recording a new SHA-256.");
    }
    if (actual !== expected) {
      await mkdir(ARTIFACT_DIR, { recursive: true });
      await writeFile(join(ARTIFACT_DIR, "rewild-benchmark-actual.png"), normalized);
      console.error(`Expected Rewild benchmark SHA-256: ${expected}`);
      console.error(`Actual Rewild benchmark SHA-256:   ${actual}`);
      throw new Error("Rewild visual regression detected. Review the generated benchmark artifact before updating the baseline.");
    }
    console.log(`Rewild visual benchmark passed: ${actual}`);
  } catch (error) {
    if (serverOutput.trim()) console.error(serverOutput.trim());
    throw error;
  } finally {
    stopProcess(server);
    await waitForExit(server);
    await safeRemove(temp);
  }
}

await main();
