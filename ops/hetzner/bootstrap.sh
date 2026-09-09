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
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/docker-compose.yml" -o "$RUNTIME_DIR/docker-compose.yml"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/Caddyfile" -o "$RUNTIME_DIR/Caddyfile"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab/mysql-init.sql" -o "$RUNTIME_DIR/db-lab/mysql-init.sql"
curl --fail --silent --show-error --location --proto "$HTTPS_ONLY" --proto-redir "$HTTPS_ONLY" \
  "$REPO_RAW/db-lab/postgres-init.sql" -o "$RUNTIME_DIR/db-lab/postgres-init.sql"
chmod 644 "$RUNTIME_DIR/db-lab/mysql-init.sql" "$RUNTIME_DIR/db-lab/postgres-init.sql"

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
chmod 600 "$RUNTIME_DIR/.env"

cd "$RUNTIME_DIR"
docker compose config --quiet
if [[ -f "$RUNTIME_DIR/ai.env" ]]; then
  chmod 600 "$RUNTIME_DIR/ai.env"
  log "Starting n8n stack, GimmeJob AI, MySQL lab, PostgreSQL lab, and Caddy"
  docker compose --profile ai pull
  docker compose --profile ai up -d --remove-orphans
  docker compose --profile ai ps
else
  log "Starting n8n stack, MySQL lab, PostgreSQL lab, and Caddy (AI runtime not configured yet)"
  docker compose pull
  docker compose up -d --remove-orphans
  docker compose ps
fi

install -m 600 /dev/null "$RUNTIME_DIR/.bootstrap-complete"
date -u +%FT%TZ >"$RUNTIME_DIR/.bootstrap-complete"
log "Bootstrap complete"
