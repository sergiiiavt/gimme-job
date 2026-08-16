#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
RUNTIME_DIR=/opt/gimmejob-n8n
REPO_RAW=https://raw.githubusercontent.com/sergiiiavt/gimme-job/main/ops/hetzner

log() {
  printf '[gimmejob-bootstrap] %s\n' "$*"
}

log "Updating base system"
apt-get update
apt-get install -y ca-certificates curl openssl

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine from Docker's official apt repository"
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
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
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  "$REPO_RAW/docker-compose.yml" -o "$RUNTIME_DIR/docker-compose.yml"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  "$REPO_RAW/Caddyfile" -o "$RUNTIME_DIR/Caddyfile"

if [[ ! -f "$RUNTIME_DIR/.env" ]]; then
  log "Generating persistent n8n and PostgreSQL secrets"
  umask 077
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  N8N_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  cat >"$RUNTIME_DIR/.env" <<EOF
POSTGRES_DB=n8n
POSTGRES_USER=n8n
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY
N8N_HOST=n8n.gimme-job.com
EOF
fi
chmod 600 "$RUNTIME_DIR/.env"

log "Starting PostgreSQL, n8n, and Caddy"
cd "$RUNTIME_DIR"
docker compose pull
docker compose up -d --remove-orphans

docker compose ps
install -m 600 /dev/null "$RUNTIME_DIR/.bootstrap-complete"
date -u +%FT%TZ >"$RUNTIME_DIR/.bootstrap-complete"
log "Bootstrap complete"
