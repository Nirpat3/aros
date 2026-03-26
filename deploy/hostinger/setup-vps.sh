#!/usr/bin/env bash
# AROS Platform — First-time Hostinger VPS Setup
# Run as root: sudo bash setup-vps.sh

set -euo pipefail

echo "=== AROS VPS Setup ==="

# ── System packages ──────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw build-essential

# ── Node.js 20 via NodeSource ────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

# ── pnpm ─────────────────────────────────────────────────────────
corepack enable
corepack prepare pnpm@9.15.4 --activate
echo "pnpm: $(pnpm -v)"

# ── PM2 ──────────────────────────────────────────────────────────
npm install -g pm2
pm2 startup systemd -u root --hp /root
echo "PM2 installed"

# ── Firewall ─────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "Firewall enabled: SSH + Nginx"

# ── App user + directories ───────────────────────────────────────
id -u aros &>/dev/null || useradd -m -s /bin/bash aros
mkdir -p /opt/aros-platform /var/log/aros /var/www/certbot
chown -R aros:aros /opt/aros-platform /var/log/aros

# ── Nginx config ─────────────────────────────────────────────────
if [ -f /opt/aros-platform/deploy/hostinger/nginx.conf ]; then
  cp /opt/aros-platform/deploy/hostinger/nginx.conf /etc/nginx/sites-available/aros
  ln -sf /etc/nginx/sites-available/aros /etc/nginx/sites-enabled/aros
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  echo "Nginx configured"
else
  echo "WARN: Nginx config not found — deploy the app first, then re-run or copy manually."
fi

# ── SSL ──────────────────────────────────────────────────────────
echo ""
echo "To set up SSL, run:"
echo "  certbot --nginx -d aros.nirtek.net -d '*.aros.nirtek.net' --non-interactive --agree-tos --email admin@nirtek.net"
echo ""
echo "Note: Wildcard certs require DNS validation. For single domain:"
echo "  certbot --nginx -d aros.nirtek.net --non-interactive --agree-tos --email admin@nirtek.net"
echo ""

# ── Certbot auto-renewal ────────────────────────────────────────
systemctl enable certbot.timer 2>/dev/null || true

echo "=== VPS Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. su - aros"
echo "  2. cd /opt/aros-platform"
echo "  3. git clone git@github.com:Nirlabinc/aros-platform.git ."
echo "  4. cp .env.example .env && nano .env"
echo "  5. ./deploy/hostinger/deploy.sh production"
