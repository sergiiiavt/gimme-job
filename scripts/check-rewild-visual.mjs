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
const BASELINE_PATH = join(ROOT, "tests/fixtures/rewild-ecosystem.sha256");
const ARTIFACT_DIR = join(ROOT, "artifacts");

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
  const candidates = [
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  throw new Error("Chrome/Chromium is required for the Rewild visual regression gate.");
}

async function waitForServer(server) {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited before benchmark capture (code ${server.exitCode}).`);
    try {
      const response = await fetch(BENCHMARK_URL, { redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        throw new Error(`Benchmark URL redirected to ${response.headers.get("location") ?? "an unknown location"}.`);
      }
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 125));
  }
  throw new Error(`Timed out waiting for ${BENCHMARK_URL}: ${lastError}`);
}

function stopServer(server) {
  if (!server.pid || server.exitCode !== null) return;
  try {
    if (process.platform === "win32") server.kill("SIGTERM");
    else process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function main() {
  if (!touchesRewild()) {
    console.log("Rewild visual benchmark skipped: pull request does not touch Rewild.");
    return;
  }

  const chrome = findChrome();
  const temp = await mkdtemp(join(tmpdir(), "rewild-visual-"));
  const rawScreenshot = join(temp, "chrome.png");
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
    await waitForServer(server);
    const chromeRun = spawnSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT}`,
      "--virtual-time-budget=2000",
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
    stopServer(server);
    await rm(temp, { recursive: true, force: true });
  }
}

await main();
