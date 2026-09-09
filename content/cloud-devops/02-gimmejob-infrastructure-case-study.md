# Real implementation: GimmeJob production n8n infrastructure

> **CASE STUDY · GIMMEJOB** — This chapter is designed to be reproducible. It explains what the production code does, why each part exists, how to build an equivalent system, and how to verify the result.

## What we are building

GimmeJob runs its main web application on Cloudflare, but long-running n8n workflows need a conventional server runtime. The production solution is a small Hetzner VM provisioned automatically from GitHub Actions. The same VM also hosts two deliberately public, disposable database labs for MySQL and PostgreSQL practice; they are isolated from the private n8n database.

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
      |                           +--> db.gimme-job.com A record
      |
      v
cloud-init / runtime refresh
      |
      v
ops/hetzner/bootstrap.sh
      |
      +--> Docker Engine
      +--> generated local secrets
      +--> Docker Compose
                |
                +--> private PostgreSQL --> n8n --> Caddy --> HTTPS
                +--> MySQL lab ----------------------------> :3306
                +--> PostgreSQL lab -----------------------> :5432
```

The important design idea is that provisioning, machine bootstrap, runtime topology, DNS, TLS, database-lab isolation, and readiness verification are separate layers that cooperate.

## Requirements and constraints

The implementation is solving a concrete set of production requirements:

- n8n must run continuously outside the short-lived execution model of the main Cloudflare Worker.
- PostgreSQL data and n8n state must survive container restarts.
- n8n port `5678` and its PostgreSQL database must not be directly exposed to the Internet.
- HTTPS must be the public entry point for n8n.
- MySQL and PostgreSQL test labs must be reachable from the Internet on their standard ports while containing synthetic/disposable data only.
- the database labs must use separate containers, volumes, credentials, and Docker networking from the private n8n database;
- the infrastructure must be reproducible from the repository rather than dependent on manual console configuration;
- cloud credentials must stay in GitHub repository secrets;
- production database and n8n encryption secrets should be generated on the VM and not committed to Git;
- the workflow should be safely re-runnable when the server or firewall already exists.

## Repository map

| File | Responsibility | Why it is separate |
| --- | --- | --- |
| `.github/workflows/hetzner-n8n.yml` | Trigger, GitHub secret injection, provisioning execution, HTTPS readiness gate | Defines provisioning orchestration and CI permissions |
| `.github/workflows/hetzner-n8n-repair.yml` | Refresh the version-controlled runtime on an existing VM and verify the public boundaries | Separates runtime convergence from provider provisioning |
| `ops/hetzner/provision.mjs` | Hetzner firewall/server convergence, Cloudflare DNS, cloud-init | Owns provider API operations |
| `ops/hetzner/bootstrap.sh` | Docker installation, swap, secret generation, fixture download, Compose startup | Runs inside the VM after creation or refresh |
| `ops/hetzner/docker-compose.yml` | Private n8n stack, public DB labs, networks and volumes | Describes the runtime topology |
| `ops/hetzner/db-lab/*.sql` | Synthetic database fixtures and constrained lab users | Keeps test data and engine-specific initialization version controlled |
| `ops/hetzner/Caddyfile` | Reverse proxy from public HTTPS to n8n | Keeps TLS/proxy behavior independent of the app container |

This separation is useful when debugging. A provider API problem, cloud-init problem, database initialization problem, container problem, and TLS problem fail in different layers.

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

A separate runtime-refresh workflow also runs for version-controlled VM-runtime changes. The two workflows share one concurrency group so they do not modify the Hetzner runtime simultaneously.

The workflows inject `HETZNER_TOKEN` and, where required, `CLOUDFLARE_API_TOKEN` from GitHub secrets. The token values are not stored in the repository.

Before touching infrastructure, the workflow explicitly checks that the required Hetzner credential exists. This is a small but important gate: configuration failure should be detected before an ambiguous provider request is attempted.

## Step 2: converge the firewall and server

`provision.mjs` first searches for stable names such as `gimmejob-n8n-fw` and `gimmejob-n8n`.

If the firewall already exists, its rules are reconciled with the desired definition rather than merely reused unchanged. If the server already exists, it is reused. This makes a re-run different from a naive script that would either leave stale firewall rules or create another VM every time.

The firewall exposes only the ports required by the chosen architecture:

| Port | Protocol | Purpose |
| --- | --- | --- |
| 22 | TCP | SSH with public-key authentication |
| 80 | TCP | HTTP redirect and ACME flow |
| 443 | TCP | HTTPS |
| 443 | UDP | HTTP/3 |
| 3306 | TCP | disposable public MySQL lab |
| 5432 | TCP | disposable public PostgreSQL lab |

The private n8n PostgreSQL database is **not** the PostgreSQL service exposed on `5432`. It is a separate container on the private Docker network. n8n port `5678` also remains absent from the public firewall.

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

For an already-running server, the runtime-refresh workflow temporarily boots the Hetzner rescue environment, installs the current bootstrap as a systemd service on the VM filesystem, then reboots back into Ubuntu. That gives repository changes a repeatable deployment path without storing the VM's SSH private key in GitHub.

## Step 4: install the runtime and create local secrets

`bootstrap.sh` installs Docker from Docker's official repository, enables Docker, creates a 2 GiB swap file when the machine has no active swap, and downloads the current Compose, Caddy, and database-lab fixture files.

It preserves existing environment values and generates missing runtime secrets such as:

- the private n8n PostgreSQL password;
- the n8n encryption key;
- the MySQL lab root/admin password;
- the PostgreSQL lab admin password.

Those values are written to `/opt/gimmejob-n8n/.env` with restrictive permissions. The shared disposable lab login is separate from those admin credentials; its plaintext password is not committed to Git, while engine-specific one-way verifiers are stored with the test fixtures.

That distinction is a core infrastructure pattern: **reproducible secret creation without disclosing production/admin secrets**.

## Step 5: keep the application stack private and isolate the public DB labs

Compose uses separate Docker networks for different trust boundaries.

```diagram
                         Internet
                    /       |       \
                 443      3306      5432
                  |         |         |
                  v         v         v
                Caddy    MySQL lab  PostgreSQL lab
                  |
            n8n private network       db_lab_internal
                  |
                  v
                n8n :5678
                  |
                  v
        private PostgreSQL :5432

Persistent volumes:
- private n8n PostgreSQL data
- n8n data
- MySQL lab data
- PostgreSQL lab data
- Caddy certificate/config data
```

The two lab databases share neither a volume nor a Docker network with the private n8n PostgreSQL service. Their fixtures contain synthetic users, products, and orders. The `orders.user_id` and `orders.product_id` columns intentionally start without secondary indexes so `EXPLAIN`, `CREATE INDEX`, and before/after execution-plan exercises produce meaningful differences.

n8n still waits for its private PostgreSQL health check before starting. The database-lab services have their own health checks and restart policies. Named Docker volumes preserve state across container recreation.

## Step 6: configure DNS and obtain HTTPS

After Hetzner assigns the public IPv4 address, the provisioning code tries to create or update Cloudflare A records for both `n8n.gimme-job.com` and `db.gimme-job.com`.

The records are updated instead of duplicated when they already exist. The DB hostname is DNS-only rather than proxied because normal Cloudflare HTTP proxying does not carry MySQL/PostgreSQL TCP protocols on these ports.

Caddy uses `n8n.gimme-job.com` as the HTTPS entry point and proxies traffic to the internal n8n service. Database clients connect directly to `db.gimme-job.com` on ports `3306` or `5432`.

## Step 7: verify end-to-end readiness

The GitHub Actions workflows do not stop when the server exists. Provisioning verifies the public n8n HTTPS path, and the runtime-refresh workflow verifies n8n again after reboot plus raw TCP reachability of both public database ports.

```diagram
Runtime refresh succeeds
      |
      +--> firewall/DNS converged
      +--> rescue refresh completed
      +--> Ubuntu booted
      +--> Docker Compose started
      +--> n8n HTTPS responds
      +--> MySQL :3306 accepts TCP connections
      +--> PostgreSQL :5432 accepts TCP connections
```

Port reachability proves the public boundary is open. An application-level verification should go one step further and authenticate with the lab user, query the seeded tables, and inspect a real execution plan.

## Reproduce it yourself

To reproduce the same architecture for another project, use the following sequence.

1. Create a Hetzner Cloud project and an API token with the permissions required to manage the target resources.
2. Create a domain or subdomain that you control and decide whether DNS should be automated.
3. Store provider tokens in GitHub repository secrets rather than in source files.
4. Define stable names for the server and firewall so the provisioning code can find existing resources.
5. Implement `ensureFirewall()` and `ensureServer()` style operations that read and reconcile remote state before creating resources.
6. Attach cloud-init that locks down SSH and executes a version-controlled machine-bootstrap script.
7. In the bootstrap script, install Docker, create runtime directories, generate application/admin secrets locally, and start a Compose stack.
8. Keep production databases and application ports private by default. If you intentionally expose disposable labs, use separate containers, credentials, data, networks, and explicit firewall rules.
9. Create or update the required DNS records after the server receives its public address.
10. Finish the workflow with readiness checks for every intended public boundary, then authenticate at the application protocol level when possible.

The exact provider can change. The dependency order and verification model remain useful on other clouds.

## Verification

On the server, the minimum useful checks are:

```bash
cd /opt/gimmejob-n8n
docker compose ps
docker compose logs --tail=100 n8n
docker compose logs --tail=100 mysql-lab
docker compose logs --tail=100 postgres-lab
```

From outside the VM, verify the public boundaries:

```bash
curl -I https://n8n.gimme-job.com/
# plus a MySQL client connection to db.gimme-job.com:3306
# and a PostgreSQL client connection to db.gimme-job.com:5432
```

Also verify that n8n port `5678` and the **private** PostgreSQL container are not published. Seeing `5432` reachable from the Internet is expected only because that host port belongs to the separate `postgres-lab` service.

A complete verification should answer four questions: **Did the infrastructure converge? Did bootstrap finish? Are the services healthy? Can a real client authenticate and use each intended public endpoint?**

## Why these decisions

**Why a VM at all?** n8n is a long-running workflow engine with persistent application state. A conventional always-on runtime is a simpler fit than forcing it into the execution model of the main Cloudflare Worker.

**Why Docker Compose?** The system is still small enough to model explicitly: one private n8n database, n8n, a reverse proxy, an AI service profile, and two isolated database labs. Compose keeps the topology understandable and version controlled without introducing an orchestration platform that the project does not need.

**Why PostgreSQL for n8n instead of keeping all n8n state inside the container?** The database becomes an explicit persistent dependency rather than ephemeral container storage.

**Why separate database-lab containers instead of exposing the n8n PostgreSQL database?** The labs can be intentionally reachable and mutable without granting any path to workflow state or production application data.

**Why Caddy?** It creates a narrow HTTP public edge: Caddy owns ports 80/443 and TLS while n8n remains internal. The database labs bypass Caddy because they use native database protocols rather than HTTP.

**Why generate secrets on the VM?** Production/admin values never need to exist in Git. Re-running bootstrap also preserves the existing `.env` instead of replacing encryption keys or database admin passwords.

**Why provider API code rather than Terraform today?** The current production requirement is small, and the repository already has an idempotent automation layer. This is still reviewable infrastructure automation, but it does not provide Terraform's state/plan model. A future migration to Terraform or OpenTofu would be a tooling change, not a reason to discard the engineering model described here.

## Failure modes

| Symptom | Likely layer | What to inspect |
| --- | --- | --- |
| Workflow fails before provisioning | CI configuration | GitHub secret availability and workflow syntax |
| Server creation returns capacity errors | cloud provider | selected Hetzner locations and retry behavior |
| Server exists but bootstrap never completes | cloud-init / OS | `/var/log/gimmejob-bootstrap.log`, cloud-init logs |
| Containers keep restarting | runtime | `docker compose ps` and service logs |
| n8n cannot reach PostgreSQL | private network / credentials | n8n Compose environment, private DB health check, `.env` |
| MySQL/PostgreSQL lab port is closed | firewall / Compose | reconciled firewall rules, published host port, lab container state |
| lab port opens but login/query fails | DB initialization / credentials | lab container logs, init SQL, shared lab verifier |
| DNS does not point to the VM | DNS automation | Cloudflare token permissions and A records |
| DNS resolves but n8n HTTPS fails | firewall / Caddy / TLS | ports 80/443, Caddy logs, certificate flow |
| Workflow times out after runtime refresh | any downstream layer | debug in dependency order rather than changing several layers at once |

The table is intentionally organized by layer. Good incident diagnosis follows the same architecture used to build the system.

## What the implementation does not hide

This is a real production case study, so it also documents current boundaries rather than presenting the architecture as perfect.

The Hetzner firewall allows SSH from the public Internet, but the machine disables password authentication and uses SSH public-key authentication. MySQL `3306` and PostgreSQL `5432` are also deliberately public for the disposable labs. That exposure is acceptable here only because the lab services use synthetic data, constrained non-admin lab users, separate volumes, and a Docker network that does not contain n8n or its database. The private n8n PostgreSQL service and n8n port `5678` are not publicly exposed.

The provisioning model is API-driven and idempotent, but it does not currently have Terraform-style state planning. Runtime refresh uses a temporary Hetzner rescue boot, so an infrastructure deployment briefly restarts the VM and its hosted services. DNS automation can be skipped when the Cloudflare token lacks DNS write permission.

Understanding those boundaries is part of understanding the system.

## Summary

GimmeJob's Hetzner infrastructure is built as a chain of reproducible layers: GitHub Actions orchestrates, provider API code converges the Hetzner resources, cloud-init or rescue refresh enters the machine, the bootstrap script configures the operating system, Docker Compose defines private and public service boundaries, Cloudflare supplies DNS, Caddy owns the HTTPS edge, and readiness probes verify the intended public endpoints.

The central lesson is not “copy these files.” It is to understand the dependency chain and trust boundaries well enough that you could rebuild the same architecture for another project and know how to prove each layer works.

## Sources

- [Provisioning implementation](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/provision.mjs)
- [Hetzner provisioning workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/hetzner-n8n.yml)
- [Hetzner runtime refresh workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/hetzner-n8n-repair.yml)
- [VM bootstrap](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/bootstrap.sh)
- [Docker Compose runtime](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/docker-compose.yml)
- [Database lab fixtures](https://github.com/sergiiiavt/gimme-job/tree/main/ops/hetzner/db-lab)
- [Caddy configuration](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/Caddyfile)
- [Hetzner Cloud API documentation](https://docs.hetzner.cloud/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
