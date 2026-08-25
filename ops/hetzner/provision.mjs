import { appendFileSync } from "node:fs";

const HETZNER_API = "https://api.hetzner.cloud/v1";
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const SERVER_NAME = "gimmejob-n8n";
const FIREWALL_NAME = "gimmejob-n8n-fw";
const SERVER_TYPE = "cx23";
const N8N_HOSTNAME = "n8n.gimme-job.com";
const AI_HOSTNAME = "ai.gimme-job.com";
const PUBLIC_HOSTNAMES = [N8N_HOSTNAME, AI_HOSTNAME];
const ZONE_NAME = "gimme-job.com";
const PREFERRED_LOCATIONS = ["nbg1", "fsn1", "hel1"];

// Public key only. The corresponding private key never leaves the user's machine.
const SSH_PUBLIC_KEY = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDNrULrj7iwoTCT8ld4YDekf7r0ljiqg+zLhh3BlyNwBkX6NrMSbxMcz8xqwFFyEtGp9zmAzU+p8rI0XJV8h9AnezHtS82WaQm8fkeBOpNfT+fj2XVg/HKJVtidIFL4DJ6EhHmFbbrwppAfXuxbyYr8YTv56DDmzY6gdQabk2K/PefW098RKVea/XTOkoc8r1H2qmIGPA8fBKQZCIqHzputhDA7+/NOFwXx6m94vdmZb9csLLub4SUKHorh/v31JPsZpGZCmOgYkW/5zW97rYcETF7VarVEtOkXU8eNnKf/fzhCp2/ztokFmlJzES0RQJwmUZ4Y4yJGgp6nb3ctC3WX ssh-key-2026-08-15";

const hetznerToken = process.env.HETZNER_TOKEN?.trim();
if (!hetznerToken) {
  throw new Error("HETZNER_TOKEN is required");
}

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonRequest(url, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text.slice(0, 500) };
    }
  }

  if (!response.ok || payload?.success === false) {
    const apiError = payload?.error ?? payload?.errors?.[0] ?? {};
    const message = apiError.message ?? payload?.message ?? `${method} ${url} failed`;
    throw new ApiError(message, response.status, apiError.code);
  }

  return payload;
}

function hcloud(path, options = {}) {
  return jsonRequest(`${HETZNER_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${hetznerToken}`,
      ...options.headers,
    },
  });
}

function cloudInit() {
  return `#cloud-config
ssh_pwauth: false
disable_root: false
ssh_authorized_keys:
  - ${SSH_PUBLIC_KEY}
write_files:
  - path: /etc/ssh/sshd_config.d/99-gimmejob.conf
    permissions: '0644'
    content: |
      PasswordAuthentication no
      KbdInteractiveAuthentication no
      PermitRootLogin prohibit-password
runcmd:
  - systemctl reload ssh
  - [ bash, -lc, "curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' https://raw.githubusercontent.com/sergiiiavt/gimme-job/main/ops/hetzner/bootstrap.sh -o /root/gimmejob-bootstrap.sh && chmod 700 /root/gimmejob-bootstrap.sh && /root/gimmejob-bootstrap.sh >>/var/log/gimmejob-bootstrap.log 2>&1" ]
`;
}

async function ensureFirewall() {
  const existing = await hcloud(`/firewalls?name=${encodeURIComponent(FIREWALL_NAME)}`);
  if (existing.firewalls?.length) {
    console.log(`Reusing firewall ${FIREWALL_NAME}`);
    return existing.firewalls[0];
  }

  const created = await hcloud("/firewalls", {
    method: "POST",
    body: {
      name: FIREWALL_NAME,
      labels: {
        environment: "production",
        service: "n8n",
        managed_by: "github-actions",
      },
      rules: [
        {
          direction: "in",
          protocol: "tcp",
          port: "22",
          source_ips: ["0.0.0.0/0", "::/0"],
          description: "SSH (public-key authentication only)",
        },
        {
          direction: "in",
          protocol: "tcp",
          port: "80",
          source_ips: ["0.0.0.0/0", "::/0"],
          description: "HTTP for HTTPS redirect and ACME",
        },
        {
          direction: "in",
          protocol: "tcp",
          port: "443",
          source_ips: ["0.0.0.0/0", "::/0"],
          description: "HTTPS",
        },
        {
          direction: "in",
          protocol: "udp",
          port: "443",
          source_ips: ["0.0.0.0/0", "::/0"],
          description: "HTTP/3",
        },
      ],
    },
  });

  console.log(`Created firewall ${FIREWALL_NAME}`);
  return created.firewall;
}

function retryableCapacityError(error) {
  return (
    error instanceof ApiError &&
    (error.status === 412 ||
      error.status === 503 ||
      ["resource_unavailable", "server_unavailable", "unavailable"].includes(error.code))
  );
}

async function ensureServer(firewall) {
  const existing = await hcloud(`/servers?name=${encodeURIComponent(SERVER_NAME)}`);
  if (existing.servers?.length) {
    console.log(`Reusing server ${SERVER_NAME}`);
    return existing.servers[0];
  }

  let lastError;
  for (const location of PREFERRED_LOCATIONS) {
    try {
      const created = await hcloud("/servers", {
        method: "POST",
        body: {
          name: SERVER_NAME,
          server_type: SERVER_TYPE,
          image: "ubuntu-24.04",
          location,
          start_after_create: true,
          public_net: {
            enable_ipv4: true,
            enable_ipv6: true,
          },
          firewalls: [{ firewall: firewall.id }],
          labels: {
            environment: "production",
            service: "n8n",
            managed_by: "github-actions",
          },
          user_data: cloudInit(),
        },
      });
      console.log(`Created ${SERVER_NAME} (${SERVER_TYPE}) in ${location}`);
      return created.server;
    } catch (error) {
      lastError = error;
      if (!retryableCapacityError(error)) throw error;
      console.warn(`Capacity unavailable in ${location}; trying the next EU location`);
    }
  }

  throw lastError ?? new Error("Could not create the Hetzner server");
}

async function waitForPublicNetwork(server) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const current = (await hcloud(`/servers/${server.id}`)).server;
    if (current?.public_net?.ipv4?.ip) {
      if (attempt > 1) console.log(`Public network became ready after ${attempt} checks`);
      return current;
    }
    if (attempt === 1 || attempt % 5 === 0) {
      console.log(`Waiting for Hetzner public network (${attempt}/60)...`);
    }
    await sleep(2000);
  }
  throw new Error(`${SERVER_NAME} did not receive a public IPv4 address within 2 minutes`);
}

async function ensureFirewallApplied(firewall, server) {
  const refreshed = (await hcloud(`/firewalls/${firewall.id}`)).firewall;
  const applied = refreshed.applied_to?.some(
    (entry) => entry.type === "server" && Number(entry.server?.id) === Number(server.id),
  );
  if (applied) {
    console.log(`Firewall ${FIREWALL_NAME} is attached to ${SERVER_NAME}`);
    return;
  }

  try {
    await hcloud(`/firewalls/${firewall.id}/actions/apply_to_resources`, {
      method: "POST",
      body: {
        apply_to: [{ type: "server", server: { id: server.id } }],
      },
    });
    console.log(`Applied firewall ${FIREWALL_NAME} to ${SERVER_NAME}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "firewall_already_applied") return;
    throw error;
  }
}

function serverIpv4(server) {
  const ip = server?.public_net?.ipv4?.ip;
  if (!ip) throw new Error(`${SERVER_NAME} does not have a public IPv4 address`);
  return ip;
}

async function configureCloudflareDns(ipv4) {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    console.warn("CLOUDFLARE_API_TOKEN is unavailable; DNS will need to be configured manually");
    return false;
  }

  const cf = (path, options = {}) =>
    jsonRequest(`${CLOUDFLARE_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

  try {
    const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
    const zone = zones.result?.find((item) => item.name === ZONE_NAME);
    if (!zone) throw new Error(`Cloudflare zone ${ZONE_NAME} was not found`);

    for (const hostname of PUBLIC_HOSTNAMES) {
      const records = await cf(
        `/zones/${zone.id}/dns_records?type=A&name=${encodeURIComponent(hostname)}`,
      );
      const record = records.result?.[0];
      const desired = {
        type: "A",
        name: hostname,
        content: ipv4,
        ttl: 1,
        proxied: false,
        comment: "GimmeJob Hetzner runtime; managed by GitHub Actions",
      };

      if (record) {
        await cf(`/zones/${zone.id}/dns_records/${record.id}`, {
          method: "PATCH",
          body: desired,
        });
        console.log(`Updated ${hostname} -> ${ipv4}`);
      } else {
        await cf(`/zones/${zone.id}/dns_records`, {
          method: "POST",
          body: desired,
        });
        console.log(`Created ${hostname} -> ${ipv4}`);
      }
    }
    return true;
  } catch {
    console.warn("Cloudflare DNS automation skipped; configure DNS manually if needed");
    return false;
  }
}

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

function addSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
}

const firewall = await ensureFirewall();
const initialServer = await ensureServer(firewall);
const server = await waitForPublicNetwork(initialServer);
await ensureFirewallApplied(firewall, server);
const ipv4 = serverIpv4(server);
const dnsConfigured = await configureCloudflareDns(ipv4);

setOutput("server_id", server.id);
setOutput("server_ip", ipv4);
setOutput("dns_configured", dnsConfigured ? "true" : "false");
setOutput("n8n_url", `https://${N8N_HOSTNAME}`);
setOutput("ai_url", `https://${AI_HOSTNAME}`);

addSummary([
  "## Hetzner production runtime",
  "",
  `- Server: \`${SERVER_NAME}\` (ID ${server.id})`,
  `- IPv4: \`${ipv4}\``,
  `- n8n: https://${N8N_HOSTNAME}`,
  `- AI service: https://${AI_HOSTNAME}`,
  `- Cloudflare DNS updated: ${dnsConfigured ? "yes" : "no"}`,
  "- Ports exposed by Hetzner firewall: 22/tcp, 80/tcp, 443/tcp, 443/udp",
  "- PostgreSQL, n8n port 5678, and AI port 8000 are Docker-internal only",
]);

console.log(`Server ready for bootstrap: ${SERVER_NAME} ${ipv4}`);
