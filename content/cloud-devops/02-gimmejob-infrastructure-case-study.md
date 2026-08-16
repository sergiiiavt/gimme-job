# Real implementation: GimmeJob production n8n infrastructure

> **CASE STUDY · GIMMEJOB** — This chapter is designed to be reproducible. It explains what the production code does, why each part exists, how to build an equivalent system, and how to verify the result.

## What we are building

GimmeJob runs its main web application on Cloudflare, but long-running n8n workflows need a conventional server runtime. The production solution is a small Hetzner VM provisioned automatically from GitHub Actions.

```diagram
GitHub repository
      |
      | push affecting ops/hetzner/**
      | or manual workflow dispatch
      v
GitHub Actions
      |
      v
ops/hetzner/provision.mjs
      |
      +---------------------> Hetzner Cloud API
      |                           |
      |                           +--> firewall
      |                           +--> Ubuntu VM
      |                           +--> public IPv4
      |
      +---------------------> Cloudflare API
      |                           |
      |                           +--> n8n.gimme-job.com A record
      |
      v
cloud-init on the VM
      |
      v
ops/hetzner/bootstrap.sh
      |
      +--> Docker Engine
      +--> generated local secrets
      +--> Docker Compose
                |
                +--> PostgreSQL
                +--> n8n
                +--> Caddy
                         |
                         v
                  HTTPS public endpoint
```

The important design idea is that provisioning, machine bootstrap, runtime topology, DNS, TLS, and readiness verification are separate layers that cooperate.

## Requirements and constraints

The implementation is solving a concrete set of production requirements:

- n8n must run continuously outside the short-lived execution model of the main Cloudflare Worker.
- PostgreSQL data and n8n state must survive container restarts.
- n8n port `5678` and PostgreSQL must not be directly exposed to the Internet.
- HTTPS must be the public entry point.
- the infrastructure must be reproducible from the repository rather than dependent on manual console configuration;
- cloud credentials must stay in GitHub repository secrets;
- database and n8n encryption secrets should be generated on the VM and not committed to Git;
- the workflow should be safely re-runnable when the server or firewall already exists.

## Repository map

| File | Responsibility | Why it is separate |
| --- | --- | --- |
| `.github/workflows/hetzner-n8n.yml` | Trigger, GitHub secret injection, provisioning execution, HTTPS readiness gate | Defines orchestration and CI permissions |
| `ops/hetzner/provision.mjs` | Hetzner firewall/server creation, Cloudflare DNS, cloud-init | Owns provider API operations |
| `ops/hetzner/bootstrap.sh` | Docker installation, swap, secret generation, Compose startup | Runs inside the VM after creation |
| `ops/hetzner/docker-compose.yml` | PostgreSQL, n8n, Caddy, networks and volumes | Describes the runtime topology |
| `ops/hetzner/Caddyfile` | Reverse proxy from public HTTPS to n8n | Keeps TLS/proxy behavior independent of the app container |

This separation is useful when debugging. A provider API problem, cloud-init problem, container problem, and TLS problem fail in different layers.

## Step 1: trigger provisioning from GitHub Actions

The production workflow runs when infrastructure files change on `main`, and it can also be started manually.

```yaml
on:
  push:
    branches:
      - main
    paths:
      - .github/workflows/hetzner-n8n.yml
      - ops/hetzner/**
  workflow_dispatch:
```

The workflow injects `HETZNER_TOKEN` and `CLOUDFLARE_API_TOKEN` from GitHub secrets. The token values are not stored in the repository.

Before touching infrastructure, the workflow explicitly checks that the required Hetzner credential exists. This is a small but important gate: configuration failure should be detected before an ambiguous provider request is attempted.

## Step 2: converge the firewall and server

`provision.mjs` first searches for stable names such as `gimmejob-n8n-fw` and `gimmejob-n8n`.

If the firewall already exists, it is reused. If the server already exists, it is reused. This makes a re-run different from a naive script that would create another VM every time.

The firewall exposes only the ports needed for the chosen architecture:

| Port | Protocol | Purpose |
| --- | --- | --- |
| 22 | TCP | SSH with public-key authentication |
| 80 | TCP | HTTP redirect and ACME flow |
| 443 | TCP | HTTPS |
| 443 | UDP | HTTP/3 |

PostgreSQL and n8n port `5678` are intentionally absent from the public firewall.

The server is created from Ubuntu 24.04, given public networking, attached to the firewall, and started with cloud-init user data.

## Step 3: bootstrap the machine with cloud-init

The provisioning code injects cloud-init that does two things before application setup:

- disables password-based SSH authentication;
- downloads the version-controlled bootstrap script over HTTPS and executes it.

```diagram
Hetzner creates Ubuntu VM
      |
      v
cloud-init starts
      |
      +--> enforce SSH key authentication
      |
      +--> fetch bootstrap.sh from the repository
                |
                v
          configure runtime
```

This is the bridge between infrastructure provisioning and operating-system configuration.

## Step 4: install the runtime and create local secrets

`bootstrap.sh` installs Docker from Docker's official repository, enables Docker, creates a 2 GiB swap file when the machine has no active swap, and downloads the current Compose and Caddy configuration.

On the first run it generates:

- a PostgreSQL password;
- an n8n encryption key.

Those values are written to `/opt/gimmejob-n8n/.env` with restrictive permissions. The repository contains the logic required to create the secrets, but not the secret values.

That distinction is a core infrastructure pattern: **reproducible secret creation without secret disclosure**.

## Step 5: run PostgreSQL, n8n and Caddy as one private stack

The Compose file creates one internal bridge network. PostgreSQL and n8n attach only to that network. Caddy also attaches to it but is the only service publishing host ports.

```diagram
Internet
   |
80 / 443
   |
   v
 Caddy
   |
Docker internal network
   |
   +-----------> n8n :5678
                    |
                    v
              PostgreSQL :5432

Persistent volumes:
- PostgreSQL data
- n8n data
- Caddy certificate/config data
```

n8n waits for the PostgreSQL health check before starting. Named Docker volumes preserve state across container recreation.

## Step 6: configure DNS and obtain HTTPS

After Hetzner assigns the public IPv4 address, the provisioning code tries to create or update the Cloudflare A record for `n8n.gimme-job.com`.

The record is updated instead of duplicated when it already exists. If the Cloudflare token does not have the required DNS permission, provisioning still reports the server result and the workflow gives a clear warning that DNS must be configured manually.

Caddy then uses the public hostname as the HTTPS entry point and proxies traffic to the internal n8n service.

## Step 7: verify end-to-end readiness

The GitHub Actions workflow does not stop when the server exists. If DNS automation succeeded, it repeatedly requests the public HTTPS endpoint and only succeeds when n8n becomes reachable.

That single check validates several layers at once:

```diagram
HTTPS request succeeds
      |
      +--> DNS resolves
      +--> server networking works
      +--> firewall allows HTTPS
      +--> cloud-init completed
      +--> Docker is running
      +--> Caddy is running
      +--> TLS is working
      +--> n8n is responding
```

This is stronger evidence than “the VM was created successfully.”

## Reproduce it yourself

To reproduce the same architecture for another project, use the following sequence.

1. Create a Hetzner Cloud project and an API token with the permissions required to manage the target resources.
2. Create a domain or subdomain that you control and decide whether DNS should be automated.
3. Store provider tokens in GitHub repository secrets rather than in source files.
4. Define stable names for the server and firewall so the provisioning code can find existing resources.
5. Implement `ensureFirewall()` and `ensureServer()` style operations that read remote state before creating resources.
6. Attach cloud-init that locks down SSH and executes a version-controlled machine-bootstrap script.
7. In the bootstrap script, install Docker, create runtime directories, generate application secrets locally, and start a Compose stack.
8. Keep databases and internal application ports private; expose only the reverse proxy.
9. Create or update the DNS record after the server receives its public address.
10. Finish the workflow with an HTTPS readiness check that exercises the real public path.

The exact provider can change. The dependency order and verification model remain useful on other clouds.

## Verification

On the server, the minimum useful checks are:

```bash
cd /opt/gimmejob-n8n
docker compose ps
docker compose logs --tail=100 n8n
docker compose logs --tail=100 caddy
```

From outside the VM, verify the public boundary:

```bash
curl -I https://n8n.gimme-job.com/
```

Also verify that the internal service ports are not intentionally published from Docker and are not allowed by the cloud firewall.

A complete verification should answer four questions: **Did the infrastructure converge? Did bootstrap finish? Are the services healthy? Can a real client reach the intended public endpoint?**

## Why these decisions

**Why a VM at all?** n8n is a long-running workflow engine with persistent application state. A conventional always-on runtime is a simpler fit than forcing it into the execution model of the main Cloudflare Worker.

**Why Docker Compose?** The system is small: one database, one application, one reverse proxy. Compose keeps the topology understandable and version controlled without introducing an orchestration platform that the project does not need.

**Why PostgreSQL instead of keeping all n8n state inside the container?** The database becomes an explicit persistent dependency rather than ephemeral container storage.

**Why Caddy?** It creates a narrow public edge: Caddy owns ports 80/443 and TLS while n8n remains internal.

**Why generate secrets on the VM?** The values never need to exist in Git. Re-running bootstrap also preserves the existing `.env` instead of replacing the encryption key.

**Why provider API code rather than Terraform today?** The current production requirement is small, and the repository already has an idempotent automation layer. This is still reviewable infrastructure automation, but it does not provide Terraform's state/plan model. A future migration to Terraform or OpenTofu would be a tooling change, not a reason to discard the engineering model described here.

## Failure modes

| Symptom | Likely layer | What to inspect |
| --- | --- | --- |
| Workflow fails before provisioning | CI configuration | GitHub secret availability and workflow syntax |
| Server creation returns capacity errors | cloud provider | selected Hetzner locations and retry behavior |
| Server exists but bootstrap never completes | cloud-init / OS | `/var/log/gimmejob-bootstrap.log`, cloud-init logs |
| Containers keep restarting | runtime | `docker compose ps` and service logs |
| n8n cannot reach PostgreSQL | internal network / credentials | Compose environment, health check, `.env` |
| DNS does not point to the VM | DNS automation | Cloudflare token permissions and A record |
| DNS resolves but HTTPS fails | firewall / Caddy / TLS | ports 80/443, Caddy logs, certificate flow |
| Workflow times out waiting for HTTPS | any downstream layer | debug in dependency order rather than changing several layers at once |

The table is intentionally organized by layer. Good incident diagnosis follows the same architecture used to build the system.

## What the implementation does not hide

This is a real production case study, so it also documents current boundaries rather than presenting the architecture as perfect.

The Hetzner firewall currently allows SSH from the public Internet, but the machine disables password authentication and uses SSH public-key authentication. PostgreSQL and n8n are not publicly exposed. The provisioning model is API-driven and idempotent, but it does not currently have Terraform-style state planning. DNS automation can be skipped when the Cloudflare token lacks DNS write permission.

Understanding those boundaries is part of understanding the system.

## Summary

GimmeJob's n8n infrastructure is built as a chain of reproducible layers: GitHub Actions orchestrates, provider API code converges the Hetzner resources, cloud-init enters the machine, the bootstrap script configures the operating system, Docker Compose defines the service topology, Cloudflare supplies DNS, Caddy owns the HTTPS edge, and a public readiness probe verifies the final result.

The central lesson is not “copy these five files.” It is to understand the dependency chain well enough that you could rebuild the same architecture for another project and know how to prove each layer works.

## Sources

- [Provisioning implementation](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/provision.mjs)
- [Hetzner GitHub Actions workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/hetzner-n8n.yml)
- [VM bootstrap](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/bootstrap.sh)
- [Docker Compose runtime](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/docker-compose.yml)
- [Caddy configuration](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/Caddyfile)
- [Hetzner Cloud API documentation](https://docs.hetzner.cloud/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
