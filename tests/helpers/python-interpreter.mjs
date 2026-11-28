import { spawnSync } from "node:child_process";

/**
 * Finds a working Python 3 for tests that run the offline Python labs.
 *
 * Lookup order: the PYTHON environment variable (used alone when set), then
 * the `py -3` launcher on Windows, then python3 and python. A candidate counts
 * only if it runs a one-line Python 3 program. That rules out the Microsoft
 * Store placeholders Windows puts on PATH as python.exe and python3.exe.
 */
export function pythonCandidates(env = process.env, platform = process.platform) {
  const override = env.PYTHON?.trim();
  if (override) return [{ command: override, args: [] }];
  return [
    ...(platform === "win32" ? [{ command: "py", args: ["-3"] }] : []),
    { command: "python3", args: [] },
    { command: "python", args: [] },
  ];
}

export function isPython3(candidate, run = spawnSync) {
  const result = run(candidate.command, [...candidate.args, "-c", "import sys; print(sys.version_info[0])"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    windowsHide: true,
  });
  return !result.error && result.status === 0 && String(result.stdout).trim() === "3";
}

const describe = ({ command, args }) => [command, ...args].join(" ");

/**
 * The first working candidate, or a reason to skip. CI never skips: a missing
 * interpreter there makes runPython() fail the test instead.
 */
export function findPython({ env = process.env, platform = process.platform, probe = isPython3 } = {}) {
  const candidates = pythonCandidates(env, platform);
  const found = candidates.find((candidate) => probe(candidate));
  if (found) return { ...found, skip: false };
  const problem = `no working Python 3 found (tried ${candidates.map(describe).join(", ")}); set PYTHON to a Python 3 interpreter`;
  const inCi = Boolean(env.CI) && env.CI !== "false";
  return { command: null, args: [], skip: inCi ? false : problem, problem };
}

export function runPython(python, args, options) {
  if (!python.command) throw new Error(python.problem);
  return spawnSync(python.command, [...python.args, ...args], options);
}
