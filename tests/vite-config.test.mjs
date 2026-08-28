import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_PLACEHOLDER_DATABASE_ID,
  getCloudflareViteDevMode,
} from "../scripts/cloudflare-vite-dev-mode.mjs";

const expectedD1Binding = {
  binding: "DB",
  database_name: "gimmejob-db",
  database_id: LOCAL_PLACEHOLDER_DATABASE_ID,
};

test("local:web uses local D1 and never requests remote AI or Vectorize bindings", () => {
  const mode = getCloudflareViteDevMode("local:web");

  assert.equal(mode.isOfflineLocalWeb, true);
  assert.equal(mode.remoteBindings, false);
  assert.deepEqual(mode.bindingConfig.d1_databases, [expectedD1Binding]);
  assert.equal("ai" in mode.bindingConfig, false);
  assert.equal("vectorize" in mode.bindingConfig, false);
});

test("normal dev preserves remote AI and Vectorize bindings", () => {
  const mode = getCloudflareViteDevMode("dev");

  assert.equal(mode.isOfflineLocalWeb, false);
  assert.equal(mode.remoteBindings, true);
  assert.deepEqual(mode.bindingConfig.d1_databases, [expectedD1Binding]);
  assert.deepEqual(mode.bindingConfig.ai, { binding: "AI" });
  assert.deepEqual(mode.bindingConfig.vectorize, [
    {
      binding: "RAG_INDEX",
      index_name: "gimmejob-rag",
    },
  ]);
});
