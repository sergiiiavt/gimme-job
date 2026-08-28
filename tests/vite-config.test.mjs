import assert from "node:assert/strict";
import test from "node:test";
import viteConfig from "../vite.config.ts";

const originalLifecycleEvent = process.env.npm_lifecycle_event;

function restoreLifecycleEvent() {
  if (originalLifecycleEvent === undefined) {
    delete process.env.npm_lifecycle_event;
    return;
  }
  process.env.npm_lifecycle_event = originalLifecycleEvent;
}

test.after(restoreLifecycleEvent);

async function resolveViteConfig(lifecycleEvent) {
  process.env.npm_lifecycle_event = lifecycleEvent;
  return viteConfig({
    command: "serve",
    mode: "test",
    isSsrBuild: false,
    isPreview: false,
  });
}

test("local:web resolves a fully local Cloudflare Vite configuration", async () => {
  const config = await resolveViteConfig("local:web");

  assert.equal(config.server?.port, 4173);
  assert.equal(config.server?.strictPort, true);
  assert.ok(Array.isArray(config.plugins));
});

test("normal dev still resolves the remote-capable Cloudflare configuration", async () => {
  const config = await resolveViteConfig("dev");

  assert.equal(config.server?.port, 4173);
  assert.ok(Array.isArray(config.plugins));
});
