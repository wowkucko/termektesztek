#!/usr/bin/env bash
# Egyszerű SQLite mentés script. Ajánlott cronba tenni, pl. naponta egyszer:
#   crontab -e
#   0 3 * * * /var/www/termektesztelo/deploy/backup-db.sh
#
# A DB_PATH-t es a BACKUP_DIR-t igazitsd a sajat elerhetosegeidhez.

set -euo pipefail

DB_PATH="/var/www/termektesztelo/prisma/prod.db"
BACKUP_DIR="/var/backups/termektesztelo"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/prod-$TIMESTAMP.db"

# A 30 napnal regebbi mentesek torlese
find "$BACKUP_DIR" -name "prod-*.db" -mtime +30 -delete

echo "Mentés kész: $BACKUP_DIR/prod-$TIMESTAMP.db"
