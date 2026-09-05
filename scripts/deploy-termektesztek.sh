#!/usr/bin/env bash
#
# Terméktesztek — DigitalOcean droplet telepítő (termektesztek.com)
# ==================================================================
# Futtatás root-ként a droplet-en (a weblap mellé, második oldalként):
#
#   bash scripts/deploy-termektesztek.sh
#
# Feltételek:
#   - Node 22+ már telepítve van (a weblap telepítője feltette)
#   - A termektesztek.com (és www) DNS A-rekordja a droplet IP-jére mutat
#   - A GitHub repó létezik (lásd REPO_URL); privát repóhoz deploy key kell
#
# Amit a szkript csinál:
#   1. Kód klónozása ide: /var/www/termektesztek (3001-es port, pm2 név: termektesztek)
#   2. .env ellenőrzése (.env.example sablonból, ha hiányzik -> megáll kitöltésre)
#   3. npm ci + migrate deploy + seed (admin + kategóriák) + build
#   4. pm2 indítás + újrainduláskori élesztés
#   5. Nginx vhost termektesztek.com-ra + Certbot SSL
#   6. Heti mentés cronnal (SQLite DB + feltöltött képek)
#
# A szkript biztonságosan újrafuttatható: a kész lépéseket kihagyja.

set -euo pipefail

# ---------- Konfiguráció ----------
DOMAIN="termektesztek.com"
WWW_DOMAIN="www.termektesztek.com"
APP_DIR="/var/www/termektesztek"
APP_NAME="termektesztek"
APP_PORT="3001"
ADMIN_EMAIL_NOTICE="admin@termektesztek.com"
# A kód forrása. Privát repó esetén a szerveren kell hozzáférés
# (deploy key), különben a clone jelszókéréssel elakad.
REPO_URL="https://github.com/wowkucko/termektesztek.git"

C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_CYAN='\033[0;36m'; C_RED='\033[0;31m'; C_NC='\033[0m'
step()  { echo -e "\n${C_CYAN}▶ $1${C_NC}"; }
ok()    { echo -e "  ${C_GREEN}✓ $1${C_NC}"; }
warn()  { echo -e "  ${C_YELLOW}⚠ $1${C_NC}"; }
fail()  { echo -e "  ${C_RED}✗ $1${C_NC}"; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Futtasd root-ként: sudo bash scripts/deploy-termektesztek.sh"
  exit 1
fi

# ---------- 1. Node ellenőrzés ----------
step "1/7 Node ellenőrzés"
if ! command -v node >/dev/null 2>&1; then
  fail "Nincs Node a szerveren. Telepítsd (pl. a weblap deploy-scriptjének 1. lépésével)."
  exit 1
fi
ok "Node: $(node -v), npm: $(npm -v)"

# ---------- 2. Kód ----------
step "2/7 Alkalmazás elérése: $APP_DIR"
mkdir -p "$APP_DIR"
if [ -f "$APP_DIR/package.json" ]; then
  ok "A kód már itt van — nem klónozom újra (frissítéshez: update-script)."
elif [ -n "$REPO_URL" ]; then
  git clone "$REPO_URL" "$APP_DIR"
  ok "Kód klónozva innen: $REPO_URL"
else
  fail "Nincs kód a $APP_DIR-ben, és a REPO_URL sincs beállítva."
  exit 1
fi
cd "$APP_DIR"

# ---------- 3. .env ----------
step "3/7 Környezeti változók (.env)"
if [ -f "$APP_DIR/.env" ]; then
  ok ".env már létezik."
else
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  fail "Nincs .env — létrehoztam a sablonból, de még KITÖLTETLEN."
  echo ""
  echo "  Szerkeszd meg, és futtasd újra a szkriptet:"
  echo "    nano $APP_DIR/.env"
  echo ""
  echo "  Kötelező: JWT_SECRET (openssl rand -base64 48), ADMIN_EMAIL,"
  echo "  ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL=https://termektesztek.com,"
  echo "  WORKERS_DISABLED=true maradjon!"
  exit 1
fi

# ---------- 4. Build ----------
step "4/7 Függőségek, migráció, seed, build (ez eltarthat pár percig)"
npm ci
npm run db:migrate
# A seed a .env ADMIN_* változóit olvassa (a tsx nem tölti be automatikusan a .env-t)
set -a; . ./.env; set +a
npm run db:seed || {
  warn "A seed nem futott le (valószínűleg ADMIN_EMAIL/PASSWORD hiányzik a .env-ből)."
  warn "Állítsd be őket, és futtasd: cd $APP_DIR && npm run db:seed"
}
npm run build

# ---------- 5. pm2 ----------
step "5/7 Indítás pm2-vel (automatikus újraindulás)"
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2
fi
if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  ok "A $APP_NAME már fut pm2 alatt — újraindítom a friss builddel."
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start "$APP_DIR/ecosystem.config.js"
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ---------- 6. Nginx + SSL ----------
step "6/7 Nginx reverse proxy + Certbot SSL"
cat > /etc/nginx/sites-available/termektesztek <<EOF
server {
    listen 80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/termektesztek /etc/nginx/sites-enabled/termektesztek
nginx -t && systemctl reload nginx
ok "Nginx konfigurálva (80-as port, proxy a ${APP_PORT}-re)."

if ! command -v certbot >/dev/null 2>&1; then
  apt install -y certbot python3-certbot-nginx
fi
if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
  ok "SSL tanúsítvány már létezik."
else
  warn "Certbot SSL-kérés indul. Ha a DNS még nem mutat ide, hibázni fog —"
  warn "akkor később futtasd: certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
  certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --non-interactive --agree-tos --redirect -m "$ADMIN_EMAIL_NOTICE" || true
fi

# ---------- 7. Heti mentés ----------
step "7/7 Heti biztonsági mentés (SQLite DB + feltöltött képek)"
mkdir -p /root/backups
CRON_LINE="0 3 * * 0 tar czf /root/backups/termektesztek-\$(date +\%F).tar.gz -C ${APP_DIR} prisma/dev.db public/uploads"
if crontab -l 2>/dev/null | grep -q "backups/termektesztek"; then
  ok "A mentési cron már létezik."
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  ok "Heti mentés beállítva (vasárnap 3:00 → /root/backups/)."
fi

# ---------- Kész ----------
step "Kész! ✅"
echo ""
echo "  A weboldal:      https://${DOMAIN}"
echo "  Admin:           https://${DOMAIN}/admin   (az .env-ben lévő jelszóval)"
echo "  Ellenőrzés:      curl -I https://${DOMAIN}/  →  200"
echo "  Naplók:          pm2 logs $APP_NAME"
echo "  Frissítés:       bash ${APP_DIR}/scripts/update-termektesztek.sh"
echo ""
echo "  Teendők az első cikkek előtt:"
echo "   1) Lépj be az adminba, és TÖRÖLD a seed-minta cikket."
echo "   2) Itthon: állítsd be a PUSH_TO=https://termektesztek.com-ot,"
echo "      és a Push to live gombbal töltsd fel a cikkeket."
