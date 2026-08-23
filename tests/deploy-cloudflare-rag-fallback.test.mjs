import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readText = (path) => readFile(projectFile(path), "utf8");

test("keeps the core Cloudflare deployment independent from optional Vectorize RAG", async () => {
  const [deployScript, docs] = await Promise.all([
    readText("scripts/deploy-cloudflare.mjs"),
    readText("docs/mcp-vectorize.md"),
  ]);

  assert.match(deployScript, /function tryEnsureVectorIndex\(\) \{[\s\S]*return false;[\s\S]*\}/);
  assert.match(deployScript, /Continuing core deployment without semantic RAG bindings/);
  assert.match(deployScript, /async function writeDeployConfig\([^)]*ragEnabled = true\)/);
  assert.match(deployScript, /if \(ragEnabled\) \{[\s\S]*deployConfig\.vectorize[\s\S]*\} else \{[\s\S]*delete deployConfig\.ai;[\s\S]*delete deployConfig\.vectorize;/);
  assert.match(deployScript, /async function refreshRagIndexBestEffort\(mcpServiceToken\)/);
  assert.match(deployScript, /Core Worker deployment succeeded, but the RAG refresh failed/);
  assert.match(deployScript, /const ragEnabled = tryEnsureVectorIndex\(\);/);
  assert.match(deployScript, /await writeDeployConfig\(id, multiUserEnabled, aiService, ragEnabled\);/);
  assert.match(deployScript, /if \(ragEnabled\) await refreshRagIndexBestEffort\(mcpServiceToken\);/);

  assert.match(docs, /Vectorize Read/);
  assert.match(docs, /Vectorize Write/);
  assert.match(docs, /production Worker and D1 deployment continues/);
});
