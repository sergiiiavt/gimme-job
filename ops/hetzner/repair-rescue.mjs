import { appendFileSync } from "node:fs";

const API = "https://api.hetzner.cloud/v1";
const SERVER_NAME = "gimmejob-n8n";
const token = process.env.HETZNER_TOKEN?.trim();
if (!token) throw new Error("HETZNER_TOKEN is required");

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `${method} ${path} failed (${response.status})`);
  }
  return payload;
}

async function waitAction(id, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { action } = await request(`/actions/${id}`);
    if (action.status === "success") return;
    if (action.status === "error") {
      throw new Error(action.error?.message ?? `Hetzner action ${id} failed`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for Hetzner action ${id}`);
}

function env(name, value) {
  if (!process.env.GITHUB_ENV) return;
  appendFileSync(process.env.GITHUB_ENV, `${name}<<GIMMEJOB_EOF\n${value}\nGIMMEJOB_EOF\n`);
}

const servers = await request(`/servers?name=${encodeURIComponent(SERVER_NAME)}`);
const server = servers.servers?.[0];
if (!server) throw new Error(`${SERVER_NAME} was not found`);
const ip = server.public_net?.ipv4?.ip;
if (!ip) throw new Error(`${SERVER_NAME} has no public IPv4`);

console.log(`Repair target: ${SERVER_NAME} (${ip})`);

const rescue = await request(`/servers/${server.id}/actions/enable_rescue`, {
  method: "POST",
  body: { type: "linux64" },
});
const password = rescue.root_password;
if (!password) throw new Error("Hetzner did not return a rescue root password");
console.log(`::add-mask::${password}`);
await waitAction(rescue.action.id);

const reboot = await request(`/servers/${server.id}/actions/reboot`, { method: "POST" });
await waitAction(reboot.action.id);

env("HETZNER_SERVER_IP", ip);
env("HETZNER_RESCUE_PASSWORD", password);
console.log("Rescue enabled and server rebooted into the Hetzner rescue system");
