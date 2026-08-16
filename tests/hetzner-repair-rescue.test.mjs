import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("Hetzner rescue repair validates remote data before using it", { concurrency: false }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gimmejob-repair-rescue-"));
  const githubEnv = path.join(directory, "github-env");
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.HETZNER_TOKEN;
  const originalGithubEnv = process.env.GITHUB_ENV;
  const originalStdoutWrite = process.stdout.write;
  const calls = [];
  let capturedOutput = "";

  process.env.HETZNER_TOKEN = "test-hetzner-token";
  process.env.GITHUB_ENV = githubEnv;
  process.stdout.write = ((chunk) => {
    capturedOutput += String(chunk);
    return true;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = input instanceof URL ? input : new URL(String(input));
    calls.push({ url: url.toString(), method: init.method ?? "GET", body: init.body ?? null });

    if (url.pathname === "/v1/servers" && url.searchParams.get("name") === "gimmejob-n8n") {
      return Response.json({
        servers: [{ id: 123, public_net: { ipv4: { ip: "203.0.113.10" } } }],
      });
    }
    if (url.pathname === "/v1/servers/123/actions/enable_rescue") {
      return Response.json({ root_password: "rescue-pass-123", action: { id: 456 } });
    }
    if (url.pathname === "/v1/actions/456") {
      return Response.json({ action: { status: "success" } });
    }
    if (url.pathname === "/v1/servers/123/actions/reboot") {
      return Response.json({ action: { id: 789 } });
    }
    if (url.pathname === "/v1/actions/789") {
      return Response.json({ action: { status: "success" } });
    }
    return Response.json({ error: "unexpected test endpoint" }, { status: 404 });
  };

  try {
    const moduleUrl = pathToFileURL(path.resolve("ops/hetzner/repair-rescue.mjs"));
    moduleUrl.searchParams.set("test", String(Date.now()));
    await import(moduleUrl.href);

    assert.equal(calls.length, 5);
    assert.ok(calls.every(({ url }) => url.startsWith("https://api.hetzner.cloud/v1/")));
    assert.equal(calls[1].method, "POST");
    assert.deepEqual(JSON.parse(calls[1].body), { type: "linux64" });
    assert.equal(calls[3].method, "POST");

    const output = await readFile(githubEnv, "utf8");
    assert.match(output, /HETZNER_SERVER_IP<<GIMMEJOB_EOF\n203\.0\.113\.10\nGIMMEJOB_EOF/);
    assert.match(output, /HETZNER_RESCUE_PASSWORD<<GIMMEJOB_EOF\nrescue-pass-123\nGIMMEJOB_EOF/);
    assert.match(capturedOutput, /::add-mask::rescue-pass-123\n/);
  } finally {
    globalThis.fetch = originalFetch;
    process.stdout.write = originalStdoutWrite;
    if (originalToken === undefined) delete process.env.HETZNER_TOKEN;
    else process.env.HETZNER_TOKEN = originalToken;
    if (originalGithubEnv === undefined) delete process.env.GITHUB_ENV;
    else process.env.GITHUB_ENV = originalGithubEnv;
    await rm(directory, { recursive: true, force: true });
  }
});
