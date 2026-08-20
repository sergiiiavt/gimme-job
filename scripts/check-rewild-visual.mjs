import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;
const DEBUG_PORT = 9222;
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

async function waitForChrome(chromeProcess) {
  let lastError = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (chromeProcess.exitCode !== null) throw new Error(`Chrome exited before CDP became ready (code ${chromeProcess.exitCode}).`);
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for Chrome DevTools: ${lastError}`);
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

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    const timer = setTimeout(() => rejectOpen(new Error("Timed out opening Chrome DevTools WebSocket.")), 5000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolveOpen();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      rejectOpen(new Error("Failed to open Chrome DevTools WebSocket."));
    }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8"));
    if (payload.id) {
      const waiter = pending.get(payload.id);
      if (!waiter) return;
      pending.delete(payload.id);
      if (payload.error) waiter.reject(new Error(`${payload.error.message}${payload.error.data ? `: ${payload.error.data}` : ""}`));
      else waiter.resolve(payload.result ?? {});
      return;
    }
    if (payload.method === "Runtime.exceptionThrown") {
      diagnostics.push(payload.params?.exceptionDetails?.exception?.description
        ?? payload.params?.exceptionDetails?.text
        ?? "Unknown runtime exception");
    }
    if (payload.method === "Log.entryAdded" && payload.params?.entry?.level === "error") {
      diagnostics.push(payload.params.entry.text);
    }
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolveResult, rejectResult) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectResult(new Error(`Timed out waiting for CDP method ${method}.`));
      }, 10000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolveResult(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          rejectResult(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  return { socket, send, diagnostics };
}

async function captureReadyBenchmark(chrome, temp, rawScreenshot) {
  const chromeProfile = join(temp, "chrome-profile");
  const chromeProcess = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-sandbox",
    "--force-device-scale-factor=1",
    `--window-size=${WIDTH},${HEIGHT}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${chromeProfile}`,
    "about:blank",
  ], {
    cwd: ROOT,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let chromeOutput = "";
  chromeProcess.stdout?.on("data", (chunk) => { chromeOutput += chunk.toString(); });
  chromeProcess.stderr?.on("data", (chunk) => { chromeOutput += chunk.toString(); });

  try {
    await waitForChrome(chromeProcess);
    const targetResponse = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(BENCHMARK_URL)}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Chrome could not create benchmark target: HTTP ${targetResponse.status}.`);
    const target = await targetResponse.json();
    if (!target.webSocketDebuggerUrl) throw new Error("Chrome benchmark target did not expose a DevTools WebSocket URL.");

    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Log.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Page.navigate", { url: BENCHMARK_URL });

      let ready = false;
      let lastState = null;
      for (let attempt = 0; attempt < 150; attempt += 1) {
        const evaluation = await cdp.send("Runtime.evaluate", {
          expression: `({ ready: document.documentElement.dataset.rewildBenchmark === "ready", href: location.href, canvas: Boolean(document.querySelector("#rewild-benchmark")), width: document.querySelector("#rewild-benchmark")?.width ?? 0, height: document.querySelector("#rewild-benchmark")?.height ?? 0 })`,
          returnByValue: true,
        });
        lastState = evaluation.result?.value ?? null;
        if (lastState?.ready) {
          ready = true;
          break;
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      }

      if (!ready) {
        const details = cdp.diagnostics.length ? `\nBrowser errors:\n${cdp.diagnostics.join("\n")}` : "";
        throw new Error(`Rewild benchmark never reported ready. Last browser state: ${JSON.stringify(lastState)}${details}`);
      }

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      if (!screenshot.data) throw new Error("Chrome DevTools returned an empty Rewild screenshot.");
      await writeFile(rawScreenshot, Buffer.from(screenshot.data, "base64"));
    } finally {
      cdp.socket.close();
    }
  } catch (error) {
    if (chromeOutput.trim()) console.error(chromeOutput.trim());
    throw error;
  } finally {
    stopProcess(chromeProcess);
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
    await captureReadyBenchmark(chrome, temp, rawScreenshot);

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
    await rm(temp, { recursive: true, force: true });
  }
}

await main();
