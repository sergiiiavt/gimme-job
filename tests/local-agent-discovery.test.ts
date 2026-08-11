import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalAgentApiResolver,
  discoverLocalAgentApiBase,
  localAgentCandidatePorts,
} from "../app/local-agent.ts";

const TEST_INSTANCE_ID = "test-workspace-and-database";

test("local-agent discovery identifies the compatible health response across fallback ports", async () => {
  const requestedUrls: string[] = [];
  const fetchImpl = async (url: string) => {
    requestedUrls.push(url);
    if (url === "http://127.0.0.1:4318/api/health") {
      return Response.json({ ok: true, service: "job-search-agent", apiVersion: 1, instanceId: TEST_INSTANCE_ID, startedAt: 200 });
    }
    if (url === "http://127.0.0.1:4317/api/health") {
      return Response.json({ ok: true, service: "job-search-agent", apiVersion: 1, instanceId: TEST_INSTANCE_ID, startedAt: 100 });
    }
    throw new Error("Connection refused");
  };

  const apiBase = await discoverLocalAgentApiBase({ fetchImpl, instanceId: TEST_INSTANCE_ID, timeoutMs: 50 });

  assert.equal(apiBase, "http://127.0.0.1:4318/api");
  assert.deepEqual(requestedUrls, [
    "http://127.0.0.1:4317/api/health",
    "http://127.0.0.1:4318/api/health",
    "http://127.0.0.1:4319/api/health",
    "http://127.0.0.1:4320/api/health",
    "http://127.0.0.1:4321/api/health",
  ]);
});

test("local-agent discovery rejects when no candidate has the expected identity", async () => {
  await assert.rejects(
    discoverLocalAgentApiBase({
      attempts: 2,
      fetchImpl: async () => Response.json({ ok: true, service: "unrelated-service" }),
      instanceId: TEST_INSTANCE_ID,
      timeoutMs: 50,
    }),
    /was not found on ports 4317, 4318/,
  );
});

test("candidate ports stay inside the valid TCP port range", () => {
  assert.deepEqual(localAgentCandidatePorts(65_534, 5), [65_534, 65_535]);
  assert.throws(() => localAgentCandidatePorts(65_536, 1), /Invalid local agent port/);
});

test("local-agent discovery honors a configured starting port", async () => {
  const apiBase = await discoverLocalAgentApiBase({
    attempts: 2,
    fetchImpl: async (url) => url.includes(":5101/")
      ? Response.json({ ok: true, service: "job-search-agent", apiVersion: 1, instanceId: TEST_INSTANCE_ID, startedAt: 10 })
      : Response.json({ ok: false }),
    instanceId: TEST_INSTANCE_ID,
    startPort: 5_100,
    timeoutMs: 50,
  });

  assert.equal(apiBase, "http://127.0.0.1:5101/api");
});

test("local-agent discovery ignores a newer agent from another checkout or database", async () => {
  const apiBase = await discoverLocalAgentApiBase({
    attempts: 2,
    fetchImpl: async (url) => url.includes(":4317/")
      ? Response.json({ ok: true, service: "job-search-agent", apiVersion: 1, instanceId: "other-workspace", startedAt: 999 })
      : Response.json({ ok: true, service: "job-search-agent", apiVersion: 1, instanceId: TEST_INSTANCE_ID, startedAt: 1 }),
    instanceId: TEST_INSTANCE_ID,
    timeoutMs: 50,
  });

  assert.equal(apiBase, "http://127.0.0.1:4318/api");
});

test("local-agent resolver retries rejected discovery and can invalidate a moved agent", async () => {
  let discoveries = 0;
  const resolver = createLocalAgentApiResolver(async () => {
    discoveries += 1;
    if (discoveries === 1) throw new Error("Agent is still starting");
    return discoveries === 2
      ? "http://127.0.0.1:4318/api"
      : "http://127.0.0.1:4319/api";
  });

  await assert.rejects(resolver.resolve(), /still starting/);
  assert.equal(await resolver.resolve(), "http://127.0.0.1:4318/api");
  assert.equal(await resolver.resolve(), "http://127.0.0.1:4318/api");
  assert.equal(discoveries, 2);

  resolver.invalidate();
  assert.equal(await resolver.resolve(), "http://127.0.0.1:4319/api");
  assert.equal(discoveries, 3);
});

test("local-agent resolver refreshes its cached choice after the discovery TTL", async () => {
  let now = 0;
  let newestPort = 4_317;
  let discoveries = 0;
  const resolver = createLocalAgentApiResolver(async () => {
    discoveries += 1;
    return `http://127.0.0.1:${newestPort}/api`;
  }, { cacheTtlMs: 100, now: () => now });

  assert.equal(await resolver.resolve(), "http://127.0.0.1:4317/api");
  newestPort = 4_318;
  now = 99;
  assert.equal(await resolver.resolve(), "http://127.0.0.1:4317/api");
  now = 100;
  assert.equal(await resolver.resolve(), "http://127.0.0.1:4318/api");
  assert.equal(discoveries, 2);
});
