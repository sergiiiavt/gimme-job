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

function serverUrl(value) {
  return apiUrl(`/servers/${positiveId(value, "server id")}`);
}

function actionStatusUrl(value) {
  return apiUrl(`/actions/${positiveId(value, "action id")}`);
}

function serverActionUrl(serverIdValue, action) {
  const allowed = new Set(["disable_rescue", "poweron", "reboot"]);
  if (!allowed.has(action)) throw new Error("Unsupported Hetzner server action");
  return apiUrl(`/servers/${positiveId(serverIdValue, "server id")}/actions/${action}`);
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

async function runAction(serverId, action) {
  const result = await request(serverActionUrl(serverId, action), { method: "POST" });
  await waitAction(result.action?.id);
}

const servers = await request(serverSearchUrl());
const server = servers.servers?.[0];
if (!server) throw new Error(`${SERVER_NAME} was not found`);
const serverId = positiveId(server.id, "server id");
const ip = server.public_net?.ipv4?.ip;
if (typeof ip !== "string" || isIP(ip) !== 4) throw new Error(`${SERVER_NAME} has no valid public IPv4`);

// Do not ask the rescue shell to reboot itself: SSH can disappear before the
// command exits and make a successful recovery look failed. Explicitly disable
// Rescue through the provider API, then boot/reboot the installed OS.
await runAction(serverId, "disable_rescue");
const current = (await request(serverUrl(serverId))).server;
if (current?.status === "off") {
  await runAction(serverId, "poweron");
  console.log(`Rescue disabled; powered on ${SERVER_NAME} from local disk (${ip})`);
} else {
  await runAction(serverId, "reboot");
  console.log(`Rescue disabled; rebooted ${SERVER_NAME} from local disk (${ip})`);
}
