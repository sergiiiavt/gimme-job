import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { hasMcpServiceToken, mcpServiceAuthFailure } = await import("../worker/mcp-auth.ts");

test("MCP service token requires an exact match", () => {
  const valid = new Request("https://example.test/mcp", {
    headers: { "x-gimmejob-mcp-token": "0123456789abcdef0123456789abcdef" },
  });
  const invalid = new Request("https://example.test/mcp", {
    headers: { "x-gimmejob-mcp-token": "0123456789abcdef0123456789abcdeg" },
  });
  const missing = new Request("https://example.test/mcp");

  assert.equal(hasMcpServiceToken(valid, "0123456789abcdef0123456789abcdef"), true);
  assert.equal(hasMcpServiceToken(invalid, "0123456789abcdef0123456789abcdef"), false);
  assert.equal(hasMcpServiceToken(missing, "0123456789abcdef0123456789abcdef"), false);
  assert.equal(hasMcpServiceToken(valid, undefined), false);
});

test("MCP auth failure distinguishes missing configuration from invalid credentials", async () => {
  const invalid = mcpServiceAuthFailure(true);
  const missing = mcpServiceAuthFailure(false);

  assert.equal(invalid.status, 401);
  assert.equal(missing.status, 503);
  assert.deepEqual(await invalid.json(), { error: "MCP service authentication required." });
  assert.deepEqual(await missing.json(), { error: "MCP service authentication is not configured." });
});
