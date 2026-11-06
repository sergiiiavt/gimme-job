import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { testCoverageArguments } from "./coverage-options.mjs";

const coverageDir = path.resolve("coverage");
const lcovPath = path.join(coverageDir, "lcov.info");

await rm(coverageDir, { recursive: true, force: true });
await mkdir(coverageDir, { recursive: true });

const result = spawnSync(
  process.execPath,
  testCoverageArguments(lcovPath),
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
