from pathlib import Path
import textwrap


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected patch anchor missing in {path}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


# Navigation
replace_once(
    "app/site-navigation.tsx",
    'export type ExternalNavigationId = "ai-assistant" | "qa-fundamentals" | "testing-tools" | "metrics-estimation" | "websocket-playground" | "games";',
    'export type ExternalNavigationId = "ai-assistant" | "qa-fundamentals" | "testing-tools" | "metrics-estimation" | "websocket-playground" | "database-playground" | "games";',
)
websocket_item = '''      {
        id: "websocket-playground",
        label: "WebSocket Playground",
        external: true,
        publicHref: "/playgrounds/websocket",
        personalHref: "/playgrounds/websocket",
      },'''
database_item = websocket_item + '''
      {
        id: "database-playground",
        label: "Database Playground",
        external: true,
        publicHref: "/playgrounds/databases",
        personalHref: "/playgrounds/databases",
      },'''
replace_once("app/site-navigation.tsx", websocket_item, database_item)

# Docker Compose: bridge Caddy network to the database-lab network only through the API sidecar.
compose_service = textwrap.dedent('''
  db-lab-api:
    build:
      context: ./db-lab-api
    restart: unless-stopped
    profiles:
      - ai
    depends_on:
      mysql-lab:
        condition: service_healthy
      postgres-lab:
        condition: service_healthy
    env_file:
      - ./ai.env
    environment:
      MYSQL_LAB_HOST: mysql-lab
      MYSQL_LAB_PORT: 3306
      MYSQL_LAB_ROOT_PASSWORD: ${MYSQL_LAB_ROOT_PASSWORD}
      POSTGRES_LAB_HOST: postgres-lab
      POSTGRES_LAB_PORT: 5432
      POSTGRES_LAB_ADMIN_PASSWORD: ${POSTGRES_LAB_ADMIN_PASSWORD}
    expose:
      - "8080"
    networks:
      - n8n_internal
      - db_lab_internal

''').lstrip("\n")
replace_once("ops/hetzner/docker-compose.yml", "  caddy:\n", compose_service + "  caddy:\n")

# Caddy: same AI origin, private sidecar path; browser still goes through Cloudflare Worker proxy.
replace_once(
    "ops/hetzner/Caddyfile",
    textwrap.dedent('''
    ai.gimme-job.com {
      encode zstd gzip
      reverse_proxy gimmejob-ai:8000
    }
    ''').lstrip("\n"),
    textwrap.dedent('''
    ai.gimme-job.com {
      encode zstd gzip

      handle_path /db-lab/* {
        reverse_proxy db-lab-api:8080
      }

      handle {
        reverse_proxy gimmejob-ai:8000
      }
    }
    ''').lstrip("\n"),
)

# Bootstrap sidecar source and build it locally on the server.
replace_once(
    "ops/hetzner/bootstrap.sh",
    'install -d -m 755 "$RUNTIME_DIR/db-lab"\n',
    'install -d -m 755 "$RUNTIME_DIR/db-lab"\ninstall -d -m 755 "$RUNTIME_DIR/db-lab-api"\n',
)
bootstrap_downloads = textwrap.dedent(r'''curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab-api/Dockerfile" -o "$RUNTIME_DIR/db-lab-api/Dockerfile"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab-api/server.mjs" -o "$RUNTIME_DIR/db-lab-api/server.mjs"
chmod 644 "$RUNTIME_DIR/db-lab/mysql-init.sql" "$RUNTIME_DIR/db-lab/postgres-init.sql" \
  "$RUNTIME_DIR/db-lab-api/Dockerfile" "$RUNTIME_DIR/db-lab-api/server.mjs"''')
replace_once(
    "ops/hetzner/bootstrap.sh",
    'chmod 644 "$RUNTIME_DIR/db-lab/mysql-init.sql" "$RUNTIME_DIR/db-lab/postgres-init.sql"',
    bootstrap_downloads,
)
replace_once(
    "ops/hetzner/bootstrap.sh",
    "  docker compose --profile ai pull\n  docker compose --profile ai up -d --remove-orphans\n  docker compose --profile ai ps",
    "  docker compose --profile ai pull --ignore-buildable\n  docker compose --profile ai build db-lab-api\n  docker compose --profile ai up -d --remove-orphans\n  docker compose --profile ai ps",
)

# AI deploy workflow uploads and builds the sidecar and validates both real engines.
ai_path = Path(".github/workflows/ai-image.yml")
ai = ai_path.read_text()
old_dir = "            'install -d -m 700 /opt/gimmejob-n8n'"
if old_dir not in ai:
    raise SystemExit("AI deploy runtime directory anchor missing")
ai = ai.replace(old_dir, "            'install -d -m 700 /opt/gimmejob-n8n /opt/gimmejob-n8n/db-lab-api'", 1)
old_scp = '''          "${SCP[@]}" \\
            ops/hetzner/docker-compose.yml \\
            ops/hetzner/Caddyfile \\
            "$RUNNER_TEMP/gimmejob-ai.env" \\
            "$DEPLOY_USER@$DEPLOY_HOST:/opt/gimmejob-n8n/"'''
if old_scp not in ai:
    raise SystemExit("AI deploy SCP anchor missing")
ai = ai.replace(old_scp, old_scp + '''

          "${SCP[@]}" \\
            ops/hetzner/db-lab-api/Dockerfile \\
            ops/hetzner/db-lab-api/server.mjs \\
            "$DEPLOY_USER@$DEPLOY_HOST:/opt/gimmejob-n8n/db-lab-api/"''', 1)
old_remote = '''          chmod 600 ai.env
          chmod 644 docker-compose.yml Caddyfile
          docker compose --profile ai pull gimmejob-ai caddy
          docker compose --profile ai up -d gimmejob-ai caddy'''
new_remote = '''          chmod 600 ai.env
          chmod 644 docker-compose.yml Caddyfile db-lab-api/Dockerfile db-lab-api/server.mjs
          docker compose --profile ai pull gimmejob-ai caddy
          docker compose --profile ai build db-lab-api
          docker compose --profile ai up -d gimmejob-ai db-lab-api caddy'''
if old_remote not in ai:
    raise SystemExit("AI deploy compose anchor missing")
ai = ai.replace(old_remote, new_remote, 1)
smoke_anchor = "      - name: Verify canonical RAG from Hetzner\n"
if smoke_anchor not in ai:
    raise SystemExit("AI deploy RAG smoke anchor missing")
db_smoke = r'''      - name: Verify database playground API
        shell: bash
        run: |
          set -euo pipefail
          for engine in mysql postgres; do
            body="$(curl --fail --silent --show-error --max-time 30 \
              --request POST \
              --header "Authorization: Bearer $GIMMEJOB_AI_SERVICE_TOKEN" \
              --header 'Content-Type: application/json' \
              --data "{\"engine\":\"$engine\",\"sessionId\":\"production-db-smoke\"}" \
              "$AI_URL/db-lab/v1/schema")"
            if ! grep -Fq '"tables"' <<<"$body" || ! grep -Fq '"users"' <<<"$body"; then
              echo "$engine database playground schema smoke failed." >&2
              echo "$body" >&2
              exit 1
            fi
            echo "$engine database playground API is healthy."
          done

'''
ai_path.write_text(ai.replace(smoke_anchor, db_smoke + smoke_anchor, 1))

# Refresh workflow triggers on sidecar changes and verifies it after the DB ports.
repair_path = Path(".github/workflows/hetzner-n8n-repair.yml")
repair = repair_path.read_text()
trigger = "      - ops/hetzner/db-lab/**\n"
if trigger not in repair:
    raise SystemExit("Refresh trigger anchor missing")
repair = repair.replace(trigger, trigger + "      - ops/hetzner/db-lab-api/**\n", 1)
ports = '          check_port 3306 "MySQL lab"\n          check_port 5432 "PostgreSQL lab"\n'
if ports not in repair:
    raise SystemExit("Refresh DB port smoke anchor missing")
health = ports + r'''
      - name: Verify database lab API health
        shell: bash
        run: |
          body="$(curl --fail --silent --show-error --max-time 20 \
            --resolve ai.gimme-job.com:443:$HETZNER_SERVER_IP \
            https://ai.gimme-job.com/db-lab/health)"
          if ! grep -Fq '"status":"ok"' <<<"$body"; then
            echo "Database lab API health check failed: $body" >&2
            exit 1
          fi
          echo "Database lab API is healthy behind Caddy."
'''
repair_path.write_text(repair.replace(ports, health, 1))

# PR CI also builds the sidecar image.
replace_once(
    ".github/workflows/ci.yml",
    "      - name: Verify repository\n        run: npm run verify\n",
    "      - name: Verify repository\n        run: npm run verify\n\n      - name: Build database lab API image\n        run: docker build ops/hetzner/db-lab-api\n",
)

# Browser presentation and credentialed orchestration are validated by build/contracts/deployment smoke.
replace_once(
    "sonar-project.properties",
    "ops/hetzner/provision.mjs,worker/core.ts",
    "ops/hetzner/provision.mjs,ops/hetzner/db-lab-api/server.mjs,app/playgrounds/databases/page.tsx,app/playgrounds/databases/database-playground.tsx,worker/core.ts",
)
