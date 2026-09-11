#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
RUNTIME_DIR=/opt/gimmejob-n8n
REPO_RAW=https://raw.githubusercontent.com/sergiiiavt/gimme-job/main/ops/hetzner
HTTPS_ONLY='=https'

log() {
  printf '[gimmejob-bootstrap] %s\n' "$*"
}

ensure_env_value() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" "$RUNTIME_DIR/.env"; then
    printf '%s=%s\n' "$key" "$value" >>"$RUNTIME_DIR/.env"
  fi
}

ensure_env_secret() {
  local key="$1"
  if ! grep -q "^${key}=" "$RUNTIME_DIR/.env"; then
    printf '%s=%s\n' "$key" "$(openssl rand -hex 32)" >>"$RUNTIME_DIR/.env"
  fi
}

mysql_seed_counts() {
  docker compose exec -T mysql-lab sh -lc \
    'mysql --protocol=TCP -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --batch --skip-column-names -e "SELECT CONCAT_WS(CHAR(58),(SELECT COUNT(*) FROM gimmejob_lab.users),(SELECT COUNT(*) FROM gimmejob_lab.products),(SELECT COUNT(*) FROM gimmejob_lab.orders));"' \
    2>/dev/null
}

reconcile_mysql_seed() {
  local ready=false
  local counts=""

  for attempt in $(seq 1 60); do
    if docker compose exec -T mysql-lab sh -lc \
      'mysqladmin ping -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; then
      ready=true
      break
    fi
    log "Waiting for MySQL lab before fixture reconciliation ($attempt/60)"
    sleep 2
  done

  if [[ "$ready" != true ]]; then
    echo "MySQL lab did not become ready for fixture reconciliation." >&2
    exit 1
  fi

  counts="$(mysql_seed_counts || true)"
  if [[ "$counts" == "10000:200:50000" ]]; then
    log "MySQL lab fixture seed is current ($counts)"
    return
  fi

  log "MySQL lab fixture seed is missing or stale (${counts:-unavailable}); rebuilding the base fixture"
  docker compose exec -T mysql-lab sh -lc \
    'mysql --protocol=TCP -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS gimmejob_lab;"'
  docker compose exec -T mysql-lab sh -lc \
    'mysql --protocol=TCP -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD"' \
    <"$RUNTIME_DIR/db-lab/mysql-init.sql"

  counts="$(mysql_seed_counts || true)"
  if [[ "$counts" != "10000:200:50000" ]]; then
    echo "MySQL lab fixture reconciliation failed; expected 10000:200:50000, got ${counts:-unavailable}." >&2
    exit 1
  fi
  log "MySQL lab fixture seed reconciled ($counts)"
}

reload_caddy() {
  log "Validating and reloading Caddy configuration"
  docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
}

log "Updating base system"
apt-get update
apt-get install -y ca-certificates curl openssl

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine from Docker's official apt repository"
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
    https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker

if ! swapon --show --noheadings | grep -q .; then
  log "Creating 2 GiB swap file"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

install -d -m 700 "$RUNTIME_DIR"
install -d -m 755 "$RUNTIME_DIR/db-lab"
install -d -m 755 "$RUNTIME_DIR/db-lab-api"
install -d -m 755 "$RUNTIME_DIR/mongo-lab-api"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/docker-compose.yml" -o "$RUNTIME_DIR/docker-compose.yml"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/Caddyfile" -o "$RUNTIME_DIR/Caddyfile"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab/mysql-init.sql" -o "$RUNTIME_DIR/db-lab/mysql-init.sql"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab/postgres-init.sql" -o "$RUNTIME_DIR/db-lab/postgres-init.sql"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab/mongo-init.js" -o "$RUNTIME_DIR/db-lab/mongo-init.js"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab-api/Dockerfile" -o "$RUNTIME_DIR/db-lab-api/Dockerfile"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab-api/server.mjs" -o "$RUNTIME_DIR/db-lab-api/server.mjs"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/mongo-lab-api/Dockerfile" -o "$RUNTIME_DIR/mongo-lab-api/Dockerfile"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/mongo-lab-api/package.json" -o "$RUNTIME_DIR/mongo-lab-api/package.json"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/mongo-lab-api/package-lock.json" -o "$RUNTIME_DIR/mongo-lab-api/package-lock.json"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/mongo-lab-api/server.mjs" -o "$RUNTIME_DIR/mongo-lab-api/server.mjs"
chmod 644 "$RUNTIME_DIR/db-lab/mysql-init.sql" "$RUNTIME_DIR/db-lab/postgres-init.sql" "$RUNTIME_DIR/db-lab/mongo-init.js" \
  "$RUNTIME_DIR/db-lab-api/Dockerfile" "$RUNTIME_DIR/db-lab-api/server.mjs" \
  "$RUNTIME_DIR/mongo-lab-api/Dockerfile" "$RUNTIME_DIR/mongo-lab-api/package.json" \
  "$RUNTIME_DIR/mongo-lab-api/package-lock.json" "$RUNTIME_DIR/mongo-lab-api/server.mjs"

if [[ ! -f "$RUNTIME_DIR/.env" ]]; then
  log "Creating persistent runtime environment"
  umask 077
  : >"$RUNTIME_DIR/.env"
fi
chmod 600 "$RUNTIME_DIR/.env"

ensure_env_value POSTGRES_DB n8n
ensure_env_value POSTGRES_USER n8n
ensure_env_value N8N_HOST n8n.gimme-job.com
ensure_env_secret POSTGRES_PASSWORD
ensure_env_secret N8N_ENCRYPTION_KEY
ensure_env_secret MYSQL_LAB_ROOT_PASSWORD
ensure_env_secret POSTGRES_LAB_ADMIN_PASSWORD
ensure_env_secret MONGO_LAB_ADMIN_PASSWORD
chmod 600 "$RUNTIME_DIR/.env"

cd "$RUNTIME_DIR"
docker compose config --quiet
if [[ -f "$RUNTIME_DIR/ai.env" ]]; then
  chmod 600 "$RUNTIME_DIR/ai.env"
  log "Starting n8n stack, GimmeJob AI, MySQL lab, PostgreSQL lab, MongoDB lab, and Caddy"
  docker compose --profile ai pull --ignore-buildable
  docker compose --profile ai build db-lab-api mongo-lab-api
  docker compose --profile ai up -d --remove-orphans
else
  log "Starting n8n stack, MySQL lab, PostgreSQL lab, MongoDB lab, and Caddy (AI runtime not configured yet)"
  docker compose pull
  docker compose up -d --remove-orphans
fi

reload_caddy
reconcile_mysql_seed
docker compose --profile ai ps 2>/dev/null || docker compose ps

install -m 600 /dev/null "$RUNTIME_DIR/.bootstrap-complete"
date -u +%FT%TZ >"$RUNTIME_DIR/.bootstrap-complete"
log "Bootstrap complete"
