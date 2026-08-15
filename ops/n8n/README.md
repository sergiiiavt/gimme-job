# GimmeJob n8n runtime

This directory contains the self-hosted n8n runtime for the Gmail -> GimmeJob integration.

## Architecture

```text
Gmail
  -> n8n Gmail Trigger
  -> keep structured metadata only
  -> HTTPS POST with Bearer auth
  -> https://gimme-job.com/internal/n8n/email-events
  -> Cloudflare Worker
  -> D1 email_events
```

n8n and its Postgres database run outside the GimmeJob Worker. Cloudflare Tunnel exposes only the n8n web endpoint; Postgres and port 5678 are not published directly on the VM.

## Runtime files

- `docker-compose.yml` - pinned n8n + Postgres + cloudflared services.
- `.env.example` - non-secret environment template.
- `workflows/gimmejob-gmail-ingest.json` - importable workflow with no credentials or tokens committed.

## Target host

Use a small always-on Linux VM. The intended low-cost target is an Ubuntu Oracle Cloud Always Free VM when capacity is available. The Compose stack also works on any normal Linux VM with Docker Compose.

Recommended minimum for this small workflow: 2 GB RAM. 4 GB is preferable if using an Ampere A1 VM.

## 1. Prepare the VM

Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu instructions.

Then clone GimmeJob and enter this directory:

```bash
git clone https://github.com/sergiiiavt/gimme-job.git
cd gimme-job/ops/n8n
```

Do not expose TCP 5678 or 5432 in the VM firewall/security list. The stack has no host port mappings and is reached through Cloudflare Tunnel.

## 2. Create runtime secrets

```bash
cp .env.example .env
```

Generate two independent random values:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Put them into `.env` as:

```text
POSTGRES_PASSWORD=<first random value>
N8N_ENCRYPTION_KEY=<second random value>
```

Keep `N8N_ENCRYPTION_KEY` stable. n8n uses it to encrypt stored credentials; replacing it without a migration/restore plan can make existing credentials unreadable.

`.env` must never be committed.

## 3. Create the Cloudflare Tunnel

In Cloudflare Zero Trust:

1. Create a remotely managed Tunnel for this n8n instance.
2. Add a public hostname such as `n8n.gimme-job.com`.
3. Point its service to:

```text
http://n8n:5678
```

4. Copy the generated tunnel token into:

```text
CLOUDFLARE_TUNNEL_TOKEN=<token>
```

5. Keep:

```text
N8N_HOST=n8n.gimme-job.com
```

If another hostname is used, change `N8N_HOST` to match it before starting n8n. The OAuth callback URL depends on this hostname.

## 4. Start n8n

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Inspect startup logs if needed:

```bash
docker compose logs --tail=200 n8n
docker compose logs --tail=100 cloudflared
```

Open:

```text
https://n8n.gimme-job.com
```

Create the n8n owner account.

## 5. Import the GimmeJob workflow

Import:

```text
ops/n8n/workflows/gimmejob-gmail-ingest.json
```

Workflow name:

```text
GimmeJob - Gmail ingest
```

It is intentionally inactive after import and contains no credentials.

The initial Gmail search is deliberately narrow:

```text
newer_than:2d
```

After verification, replace it with the Gmail query appropriate for job-search mail, or remove it if all incoming mail should be processed.

## 6. Configure Gmail OAuth

Open the `Gmail Trigger` node and create/select a Gmail OAuth2 credential.

For self-hosted n8n, configure a Google OAuth client and use the exact OAuth redirect/callback URL shown by n8n. Authorize the Gmail account that receives recruiter/job-search mail.

This is the only place Gmail OAuth tokens belong. They must not be copied into GimmeJob, GitHub, D1, or the workflow JSON.

The workflow uses the simplified Gmail Trigger output. It receives IDs and headers for mapping; the next node removes all non-approved fields before anything is sent to GimmeJob.

## 7. Configure GimmeJob Bearer authentication

Open `Send metadata to GimmeJob`.

Create an n8n **Bearer Auth** credential and set its token to the same secret value used by GimmeJob as:

```text
N8N_INGEST_TOKEN
```

The token itself is not present in the workflow JSON.

If the plaintext value is no longer available, rotate `N8N_INGEST_TOKEN` in GitHub, redeploy GimmeJob so Cloudflare receives the new secret, then put that same new value into the n8n Bearer Auth credential.

## 8. Verify before activation

Send one harmless test email to the connected Gmail account, then manually execute the workflow.

Expected path:

```text
Gmail Trigger
  -> Keep GimmeJob metadata only
  -> Send metadata to GimmeJob
```

Before the HTTP node, confirm the item contains only:

```text
providerMessageId
threadId
receivedAt
senderName
senderEmail
subject
classification
```

It must not contain `body`, `text`, `html`, `raw`, `snippet`, MIME content, or attachments.

Expected first delivery from GimmeJob:

```json
{
  "ok": true,
  "id": "gmail:<gmail-message-id>",
  "created": true,
  "classification": "UNCLASSIFIED"
}
```

Delivering the same Gmail message again is idempotent and should return `created: false`.

After the test passes, activate the workflow.

## 9. Operations

Status:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs --tail=200 n8n
```

Restart:

```bash
docker compose restart n8n
```

Upgrade only intentionally. The n8n and cloudflared images are version-pinned in `docker-compose.yml`; review release notes, update the tags in Git, then pull and restart.

The named volumes `n8n_postgres_data` and `n8n_data` are persistent Docker volumes. Do not destroy them during routine upgrades.

## Security boundary

This Phase 1-2 workflow can only read Gmail metadata and POST it to the dedicated GimmeJob ingest endpoint. It contains no Gmail send, reply, delete, archive, label, attachment, or raw-message operation.

GimmeJob independently rejects raw email body fields and authenticates the ingest request with a separate Bearer token.
