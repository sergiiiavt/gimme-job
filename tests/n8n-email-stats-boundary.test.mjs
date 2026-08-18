import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const boundarySource = await readFile(new URL("../worker/multi-user-boundary.ts", import.meta.url), "utf8");

test("n8n email stats route preserves bearer authorization at the multi-user boundary", () => {
  const servicePathsMatch = boundarySource.match(/const N8N_SERVICE_PATHS = new Set\(\[(?<paths>[\s\S]*?)\]\);/);
  assert.ok(servicePathsMatch?.groups?.paths, "N8N_SERVICE_PATHS should be declared as an explicit allowlist");
  assert.match(servicePathsMatch.groups.paths, /"\/internal\/n8n\/email-stats"/);
});
