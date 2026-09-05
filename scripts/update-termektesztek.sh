#!/usr/bin/env bash
#
# Terméktesztek — éles verziófrissítő (termektesztek.com)
# ========================================================
# A droplet-en root-ként futtatva a GitHubról lehúzza a legújabb kódot,
# migrálja az adatbázist, újraépíti, és újraindítja a pm2 alatt futó appot.
#
#   bash scripts/update-termektesztek.sh
#
# A prisma/dev.db (cikkek, kommentek) és a public/uploads (képek)
# érintetlen marad — gitignore-oltak, a git pull nem nyúl hozzájuk.

set -euo pipefail

APP_DIR="/var/www/termektesztek"
APP_NAME="termektesztek"

C_GREEN='\033[0;32m'; C_RED='\033[0;31m'; C_NC='\033[0m'
ok()   { echo -e "  ${C_GREEN}✓ $1${C_NC}"; }
fail() { echo -e "  ${C_RED}✗ $1${C_NC}"; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Futtasd root-ként: sudo bash scripts/update-termektesztek.sh"
  exit 1
fi

cd "$APP_DIR"

if [ ! -d .git ]; then
  fail "Nincs git repo a $APP_DIR-ben — a frissítés csak git-telepítésnél működik."
  echo "  Telepítés: bash $APP_DIR/scripts/deploy-termektesztek.sh"
  exit 1
fi

echo "▶ 1/5 Friss kód letöltése (git pull)"
git pull

echo "▶ 2/5 Függőségek szinkronizálása"
npm ci

echo "▶ 3/5 Adatbázis-migráció (prisma migrate deploy)"
npm run db:migrate

echo "▶ 4/5 Build (ez eltarthat pár percig)"
npm run build

echo "▶ 5/5 Újraindítás pm2-vel"
pm2 restart "$APP_NAME" --update-env
pm2 save >/dev/null

ok "Kész — a termektesztek.com az új verziót szolgálja ki."
echo ""
echo "  Ellenőrzés: curl -I https://termektesztek.com/"
echo "              curl -I https://termektesztek.com/sitemap.xml"
echo "  Naplók:     pm2 logs $APP_NAME"
