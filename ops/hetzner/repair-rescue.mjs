import { appendFileSync } from "node:fs";
import { isIP } from "node:net";

const API_ORIGIN = "https://api.hetzner.cloud";
const API_PREFIX = "/v1";
const SERVER_NAME = "gimmejob-n8n";
const token = process.env.HETZNER_TOKEN?.trim();
if (!token) throw new Error("HETZNER_TOKEN is required");

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid Hetzner ${label}`);
  return id;
}

function apiUrl(pathname) {
  const url = new URL(API_ORIGIN);
  url.pathname = `${API_PREFIX}${pathname}`;
  return url;
}

function serverSearchUrl() {
  const url = apiUrl("/servers");
  url.searchParams.set("name", SERVER_NAME);
  return url;
}

function actionStatusUrl(value) {
  const id = positiveId(value, "action id");
  return apiUrl(`/actions/${id}`);
}

function serverActionUrl(serverIdValue, action) {
  const serverId = positiveId(serverIdValue, "server id");
  if (action !== "enable_rescue" && action !== "reboot") throw new Error("Unsupported Hetzner server action");
  return apiUrl(`/servers/${serverId}/actions/${action}`);
}

async function request(url, { method = "GET", body } = {}) {
  if (!(url instanceof URL) || url.origin !== API_ORIGIN || !url.pathname.startsWith(`${API_PREFIX}/`)) {
    throw new Error("Invalid Hetzner API endpoint");
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Hetzner API request failed (${response.status})`);
  return payload;
}

async function waitAction(value, timeoutMs = 120000) {
  const id = positiveId(value, "action id");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { action } = await request(actionStatusUrl(id));
    if (action?.status === "success") return;
    if (action?.status === "error") throw new Error(`Hetzner action ${id} failed`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for Hetzner action ${id}`);
}

function validatedIpv4(value) {
  if (typeof value !== "string" || isIP(value) !== 4) throw new Error(`${SERVER_NAME} has no valid public IPv4`);
  return value;
}

function rescuePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 256 || /[\r\n]/.test(value)) {
    throw new Error("Hetzner returned an invalid rescue root password");
  }
  return value;
}

function githubCommandValue(value) {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function env(name, value) {
  if (!process.env.GITHUB_ENV) return;
  appendFileSync(process.env.GITHUB_ENV, `${name}<<GIMMEJOB_EOF\n${value}\nGIMMEJOB_EOF\n`);
}

const servers = await request(serverSearchUrl());
const server = servers.servers?.[0];
if (!server) throw new Error(`${SERVER_NAME} was not found`);
const serverId = positiveId(server.id, "server id");
const ip = validatedIpv4(server.public_net?.ipv4?.ip);

console.log(`Repair target found: ${SERVER_NAME}`);

const rescue = await request(serverActionUrl(serverId, "enable_rescue"), {
  method: "POST",
  body: { type: "linux64" },
});
const password = rescuePassword(rescue.root_password);
process.stdout.write(`::add-mask::${githubCommandValue(password)}\n`);
await waitAction(rescue.action?.id);

const reboot = await request(serverActionUrl(serverId, "reboot"), { method: "POST" });
await waitAction(reboot.action?.id);

env("HETZNER_SERVER_IP", ip);
env("HETZNER_RESCUE_PASSWORD", password);
console.log("Rescue enabled and server rebooted into the Hetzner rescue system");
