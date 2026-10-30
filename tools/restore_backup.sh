#!/usr/bin/env bash
# Restores an encrypted backup into an EMPTY database and shows what came back (HU-016).
# Use it for the monthly restore test, or to recover after a disaster.
#
#   bash tools/restore_backup.sh BACKUP_FILE AGE_KEY_FILE [TARGET_DATABASE_URL]
#
# BACKUP_FILE   a cuadernos-*.dump.age downloaded from the R2 bucket
# AGE_KEY_FILE  the private key (kept outside GitHub, in the team's password manager)
# TARGET        defaults to a "restore_test" database in the local Docker Compose Postgres.
#               Never point it at production.
set -euo pipefail

FILE="${1:?Usage: bash tools/restore_backup.sh BACKUP_FILE AGE_KEY_FILE [TARGET_DATABASE_URL]}"
KEY="${2:?Missing the age private key file}"
TARGET="${3:-postgres://cuadernos:cuadernos@localhost:5432/restore_test}"

case "$TARGET" in
  *neon.tech*) echo "That looks like the production database. Use an isolated one." >&2; exit 1 ;;
esac

count() { psql "$TARGET" -tAc "$1"; }

tables=$(count "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$tables" != "0" ]; then
  echo "The target database is not empty ($tables tables). Create a fresh one first." >&2
  exit 1
fi

# Decrypt first, so a wrong key gives a clear message. The plain copy is deleted on exit.
plain=$(mktemp)
trap 'rm -f "$plain"' EXIT
if ! age --decrypt --identity "$KEY" --output "$plain" "$FILE" 2>/dev/null; then
  echo "Could not decrypt $FILE: wrong key, or the file is damaged." >&2
  exit 1
fi

echo "Restoring $FILE ..."
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$TARGET" "$plain"

echo
echo "What came back:"
echo "  shops:          $(count 'select count(*) from core_tenant')"
echo "  people:         $(count 'select count(*) from auth_user')"
echo "  memberships:    $(count 'select count(*) from accounts_membership')"
echo "  entries:        $(count 'select count(*) from notebooks_entry')"
echo "  voided entries: $(count 'select count(*) from notebooks_entry where is_voided')"
echo "  audit rows:     $(count 'select count(*) from core_auditentry')"
echo "  last entry:     $(count "select coalesce(max(date)::text, 'none') from notebooks_entry")"
echo "  last change:    $(count "select coalesce(max(created_at)::text, 'none') from core_auditentry")"
echo
echo "Compare these numbers with production. If they match, write the date in docs/operacion/backups.md."
