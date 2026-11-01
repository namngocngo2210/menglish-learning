#!/usr/bin/env bash
# Daily BeeJunior backup (cron 03:30): pg_dump -> verify -> counts -> tiered local retention -> encrypted off-host copy.
#   Local retention: daily 14 d, weekly (Sundays) 8 w, monthly (1st) 6 m  ->  ~/backups/beejunior/{daily,weekly,monthly}
#   Off-host: only if $BJ_OFFSITE_DIR/r2.env exists (Cloudflare R2, encrypted client-side; docs/backup-offsite-r2.md).
# Exit 0 only if the local dump verified AND (when configured) the off-host copy verified. Any failure -> alert + exit 1.
set -euo pipefail
umask 077
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}
fail() { alert "backup FAILED: $*"; echo "$(date -u +%FT%TZ) $*" >> "$BACKUP_DIR/last-failure"; exit 1; }
exec 9>"$BACKUP_DIR/.lock"; flock -n 9 || fail "another backup is running"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/daily/beejunior-$ts.dump"
trap 'rm -f "$out.tmp" "$out.counts.tmp"' EXIT

log "dump $DB_NAME from $PG_CONTAINER"
docker exec "$PG_CONTAINER" pg_dump -U postgres -d "$DB_NAME" -Fc --no-owner > "$out.tmp" || fail "pg_dump failed"
[ "$(stat -c %s "$out.tmp")" -gt 1024 ] || fail "dump is suspiciously small"
entries="$(docker exec -i "$PG_CONTAINER" pg_restore -l < "$out.tmp" | grep -c .)" || fail "pg_restore -l cannot read the dump"
[ "$entries" -gt 20 ] || fail "dump has only $entries entries"
counts "$PG_CONTAINER" "$DB_NAME" > "$out.counts.tmp" || fail "row counts failed"
mv "$out.counts.tmp" "$out.counts"; mv "$out.tmp" "$out"
log "dump ok: $(stat -c %s "$out") bytes, $entries entries"

# Weekly (Sunday) and monthly (1st) tiers are hard links of the daily file.
if [ "$(date -u +%u)" = 7 ]; then ln -f "$out" "$BACKUP_DIR/weekly/"; ln -f "$out.counts" "$BACKUP_DIR/weekly/"; fi
if [ "$(date -u +%d)" = 01 ]; then ln -f "$out" "$BACKUP_DIR/monthly/"; ln -f "$out.counts" "$BACKUP_DIR/monthly/"; fi
# Prune only after a good new backup exists. -mtime counts whole days.
find "$BACKUP_DIR/daily" -name 'beejunior-*' -mtime +14 -delete
find "$BACKUP_DIR/weekly" -name 'beejunior-*' -mtime +56 -delete
find "$BACKUP_DIR/monthly" -name 'beejunior-*' -mtime +183 -delete
date -u +%FT%TZ > "$BACKUP_DIR/last-ok"

if [ -f "$OFFSITE_DIR/r2.env" ]; then
  export BJ_OFFSITE_STATUS_FILE="$BACKUP_DIR/last-offsite-ok"
  # BACKUP_PUBLIC_KEY_FILE etc. come from r2.env. Host node if present, else a throwaway node container.
  if command -v "${BJ_NODE:-node}" >/dev/null 2>&1; then
    "${BJ_NODE:-node}" "$OPS_JS/offsite.mjs" --env-file "$OFFSITE_DIR/r2.env" upload "$out" || fail "off-host upload failed"
  else
    docker run --rm --label hermes.task=backup --user "$(id -u):$(id -g)" --memory 192m --memory-swap 192m --cpus 0.5 \
      --read-only --tmpfs /tmp -e TMPDIR=/tmp -e BJ_OFFSITE_STATUS_FILE \
      -v "$OPS_JS:$OPS_JS:ro" -v "$OFFSITE_DIR:$OFFSITE_DIR:ro" -v "$BACKUP_DIR:$BACKUP_DIR" \
      node:22-alpine node "$OPS_JS/offsite.mjs" --env-file "$OFFSITE_DIR/r2.env" upload "$out" || fail "off-host upload failed"
  fi
else
  log "off-host copy skipped: $OFFSITE_DIR/r2.env not configured"
fi
log "backup complete"
