import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { testCoverageArguments } from "../scripts/test-coverage-options.mjs";

test("generated bundle coverage cannot erase source hits or cover an uncalled source function", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gimmejob-coverage-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "dist"));
  const source = [
    "export function exercised() {",
    "  return 42;",
    "}",
    "export function uncalled() {",
    "  return 99;",
    "}",
    "",
  ].join("\n");
  await writeFile(path.join(root, "source.mjs"), source);
  const sourceMap = {
    version: 3, file: "bundle.mjs", sources: ["../source.mjs"],
    sourcesContent: [source], names: [], mappings: "AAAA;AACA;AACA;AACA;AACA;AACA",
  };
  await writeFile(path.join(root, "dist", "bundle.mjs"), `${source}\n//# sourceMappingURL=bundle.mjs.map\n`);
  await writeFile(path.join(root, "dist", "bundle.mjs.map"), JSON.stringify(sourceMap));
  const fixture = path.join(root, "fixture.test.mjs");
  await writeFile(fixture, [
    'import assert from "node:assert/strict";',
    'import { exercised } from "./source.mjs";',
    "assert.equal(exercised(), 42);",
    'const artifact = await import("./dist/bundle.mjs");',
    // A real assertion on the artifact still runs, without contributing duplicate coverage.
    "assert.equal(typeof artifact.exercised, 'function');",
    "",
  ].join("\n"));

  const reportPath = path.join(root, "lcov.info");
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.NODE_V8_COVERAGE;
  const result = spawnSync(process.execPath, [...testCoverageArguments(reportPath), fixture], {
    cwd: root, encoding: "utf8", env: childEnv,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = await readFile(reportPath, "utf8");
  const record = report.split("end_of_record").find((entry) => /^SF:.*[/\\]?source\.mjs$/m.test(entry));
  assert.ok(record, "the original source must remain in the report");
  const counts = new Map([...record.matchAll(/^DA:(\d+),(\d+)/gm)].map((match) => [Number(match[1]), Number(match[2])]));
  assert.ok(counts.get(2) > 0, "the executed return retains its hit count");
  assert.equal(counts.get(5), 0, "the uncalled return stays uncovered");
});
