# GimmeJob n8n production stack

This directory defines the self-hosted n8n instance used by GimmeJob.

## Architecture

- Hetzner VM: `gimmejob-n8n`
- Public hostname: `n8n.gimme-job.com`
- Reverse proxy/TLS: Caddy
- Workflow runtime: n8n
- Database: PostgreSQL
- Persistent Docker volumes for PostgreSQL, n8n data, and Caddy certificates
- n8n port `5678` is private to the Docker network and is not exposed on the VM
- UFW exposes only SSH, HTTP, and HTTPS
- Nightly local backups are retained for 14 days

## First deployment

1. In Cloudflare DNS, create this record:

   - Type: `A`
   - Name: `n8n`
   - IPv4: `46.224.218.150`
   - Proxy status: **DNS only** initially

2. Open the Hetzner server console or SSH to the server as `root`.

3. After this branch is merged to `main`, run:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/sergiiiavt/gimme-job/main/infra/n8n/install.sh | bash
   ```

4. Open `https://n8n.gimme-job.com` and create the n8n owner account.

The install script generates the PostgreSQL password and `N8N_ENCRYPTION_KEY` on the server. These values are stored only in `/opt/gimmejob-n8n/.env` with mode `0600`.

## Operations

```bash
cd /opt/gimmejob-n8n

docker compose --env-file .env -f compose.yaml ps
docker compose --env-file .env -f compose.yaml logs -f n8n
./backup.sh
```

## Upgrade n8n

Change `N8N_VERSION` deliberately after reviewing the target release, then run:

```bash
cd /opt/gimmejob-n8n
docker compose --env-file .env -f compose.yaml pull n8n
docker compose --env-file .env -f compose.yaml up -d n8n
```

Do not use an unpinned `latest` image for production upgrades.

## Backups

`backup.sh` stores:

- PostgreSQL dump
- n8n persistent data
- a protected copy of the server `.env`, which is required to decrypt stored n8n credentials

Backups are written to `/var/backups/gimmejob-n8n` and files older than 14 days are deleted. The installer schedules the backup daily at 03:17 server time.

This is a local backup only. A later hardening step should copy encrypted backups off the VM (for example, to Cloudflare R2) so a VM/disk loss cannot destroy both production data and its backup.
