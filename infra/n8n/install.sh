#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

STACK_DIR="${STACK_DIR:-/opt/gimmejob-n8n}"
REPO_REF="${GIMMEJOB_INFRA_REF:-main}"
RAW_BASE="https://raw.githubusercontent.com/sergiiiavt/gimme-job/${REPO_REF}/infra/n8n"
N8N_DOMAIN="${N8N_DOMAIN:-n8n.gimme-job.com}"
N8N_VERSION="${N8N_VERSION:-2.32.7}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl openssl ufw

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# shellcheck disable=SC1091
. /etc/os-release
CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
if [[ -z "$CODENAME" ]]; then
  echo "Unable to determine Ubuntu codename." >&2
  exit 1
fi

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

timedatectl set-timezone Europe/Kyiv || true

install -d -m 0750 "$STACK_DIR"
curl -fsSL "$RAW_BASE/compose.yaml" -o "$STACK_DIR/compose.yaml"
curl -fsSL "$RAW_BASE/Caddyfile" -o "$STACK_DIR/Caddyfile"
curl -fsSL "$RAW_BASE/backup.sh" -o "$STACK_DIR/backup.sh"
chmod 0750 "$STACK_DIR/backup.sh"

if [[ ! -f "$STACK_DIR/.env" ]]; then
  POSTGRES_PASSWORD="$(openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-')"
  N8N_ENCRYPTION_KEY="$(openssl rand -hex 32)"

  umask 077
  cat > "$STACK_DIR/.env" <<EOF
N8N_DOMAIN=$N8N_DOMAIN
N8N_VERSION=$N8N_VERSION
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY
EOF
fi
chmod 0600 "$STACK_DIR/.env"

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cd "$STACK_DIR"
docker compose --env-file .env -f compose.yaml config >/dev/null
docker compose --env-file .env -f compose.yaml pull
docker compose --env-file .env -f compose.yaml up -d

install -d -m 0700 /var/backups/gimmejob-n8n
cat > /etc/cron.d/gimmejob-n8n-backup <<'EOF'
17 3 * * * root /opt/gimmejob-n8n/backup.sh >> /var/log/gimmejob-n8n-backup.log 2>&1
EOF
chmod 0644 /etc/cron.d/gimmejob-n8n-backup

cat <<EOF

n8n stack installed.

Domain: https://$N8N_DOMAIN
Stack:  $STACK_DIR

Required DNS record:
  Type: A
  Name: n8n
  Value: 46.224.218.150
  Proxy: DNS only until Caddy has issued the certificate

Useful commands:
  cd $STACK_DIR && docker compose --env-file .env -f compose.yaml ps
  cd $STACK_DIR && docker compose --env-file .env -f compose.yaml logs -f n8n
  cd $STACK_DIR && ./backup.sh
EOF
