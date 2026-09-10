import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/hetzner-n8n-repair.yml", "utf8");
const caddy = readFileSync("ops/hetzner/Caddyfile", "utf8");
const bootLocal = readFileSync("ops/hetzner/boot-local.mjs", "utf8");
const websocketProxy = readFileSync("worker/websocket-playground-proxy.ts", "utf8");

test("runtime refresh exits rescue through the Hetzner API instead of rebooting inside SSH", () => {
  assert.match(workflow, /Boot installed Ubuntu from local disk/);
  assert.match(workflow, /node ops\/hetzner\/boot-local\.mjs/);
  assert.doesNotMatch(workflow, /nohup sh -c 'sleep 2; reboot'/);
  assert.match(bootLocal, /disable_rescue/);
  assert.match(bootLocal, /poweron/);
  assert.match(bootLocal, /reboot/);
});

test("runtime refresh verifies the AI and public WebSocket boundaries", () => {
  assert.match(workflow, /_gimmejob\/ai\/health/);
  assert.match(workflow, /wss:\/\/gimme-job\.com\/playgrounds\/websocket\/ws/);
  assert.match(workflow, /Stabilize and recheck runtime boundary/);
});

test("WebSocket traffic uses the stable n8n TLS bridge to the AI container", () => {
  assert.match(caddy, /handle_path \/_gimmejob\/ai\/\*/);
  assert.match(caddy, /reverse_proxy gimmejob-ai:8000/);
  assert.match(websocketProxy, /https:\/\/n8n\.gimme-job\.com\/_gimmejob\/ai\/v1\/playground\/ws/);
  assert.doesNotMatch(websocketProxy, /https:\/\/ai\.gimme-job\.com\/v1\/playground\/ws/);
});
