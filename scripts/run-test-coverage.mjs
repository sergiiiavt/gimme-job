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
    // Tests load TypeScript through tsx, which compiles it; without source maps the coverage
    // report counts lines of the compiled code against the original files.
    "--enable-source-maps",
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
