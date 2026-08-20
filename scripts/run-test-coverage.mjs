import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const coverageDir = path.resolve("coverage");
const lcovPath = path.join(coverageDir, "lcov.info");

await rm(coverageDir, { recursive: true, force: true });
await mkdir(coverageDir, { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--import",
    "./tests/register-css-module-loader.mjs",
    "--test",
    "--experimental-test-coverage",
    "--test-reporter=spec",
    "--test-reporter=lcov",
    "--test-reporter-destination=stdout",
    `--test-reporter-destination=${lcovPath}`,
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
