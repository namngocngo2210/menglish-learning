#!/usr/bin/env bash
# Weekly restore drill (cron Sunday 04:30): restores the newest local dump into a THROWAWAY postgres container
# (no network, 256 MB, removed afterwards) and compares row counts with the counts taken at dump time.
#   restore-test.sh [dump-file]       report: $BACKUP_DIR/restore-reports/restore-<UTC date>.txt, marker: last-restore-ok
# Never touches the live database. Exit 0 = restore works and content tables match exactly.
set -euo pipefail
umask 077
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

dump="${1:-$(newest_daily)}"
[ -n "$dump" ] && [ -f "$dump" ] || { alert "restore-test: no dump found in $BACKUP_DIR/daily"; exit 1; }
mkdir -p "$BACKUP_DIR/restore-reports"
report="$BACKUP_DIR/restore-reports/restore-$(date -u +%Y%m%d).txt"
name="bj-restore-test-$$"
cleanup() { docker stop "$name" >/dev/null 2>&1 || true; rm -f "$report.err" "$report.counts"; }
trap cleanup EXIT
start=$(date +%s)
verdict=PASS
notes=()

docker run -d --rm --name "$name" --label "hermes.task=${HERMES_KANBAN_TASK:-restore-test}" --network none \
  --memory 256m --memory-swap 256m --cpus 0.5 -e POSTGRES_PASSWORD="$(openssl rand -hex 12)" \
  postgres:16-alpine >/dev/null
# The image restarts postgres once after initdb, so wait for a real query rather than pg_isready.
for _ in $(seq 90); do docker exec "$name" psql -U postgres -qAtc 'select 1' >/dev/null 2>&1 && break; sleep 1; done
docker exec "$name" psql -U postgres -qAtc 'select 1' >/dev/null 2>&1 || { alert "restore-test: throwaway postgres did not start"; exit 1; }
# The dump keeps GRANTs, so the group roles created by migration 0019 must exist before restoring (as in a real recovery).
docker exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE bj_api NOLOGIN; CREATE ROLE bj_web NOLOGIN; CREATE ROLE bj_worker NOLOGIN;
CREATE DATABASE restore_check;
SQL
if ! docker exec -i "$name" pg_restore -U postgres -d restore_check --no-owner --exit-on-error < "$dump" 2> "$report.err"; then
  verdict=FAIL
  notes+=("pg_restore failed: $(head -c 300 "$report.err" | tr '\n' ' ')")
fi

if [ "$verdict" = PASS ]; then
  counts "$name" restore_check > "$report.counts"
  if [ -f "$dump.counts" ]; then
    for t in $STRICT_TABLES; do
      want="$(grep "^$t|" "$dump.counts" | cut -d'|' -f2 || true)"
      got="$(grep "^$t|" "$report.counts" | cut -d'|' -f2 || true)"
      if [ -z "$want" ] || [ "$want" != "$got" ]; then verdict=FAIL; notes+=("table $t: dump-time=${want:-missing} restored=${got:-missing}"); fi
    done
    diffs="$(diff "$dump.counts" "$report.counts" | grep -c '^[<>]' || true)"
    notes+=("all tables: $diffs differing count lines (non-content tables may change between the count and the dump)")
  else
    verdict=FAIL
    notes+=("no $(basename "$dump").counts to compare with")
  fi
fi
elapsed=$(( $(date +%s) - start ))
{
  echo "restore-test $(date -u +%FT%TZ) verdict=$verdict"
  echo "dump=$(basename "$dump") size_bytes=$(stat -c %s "$dump") elapsed_s=$elapsed"
  printf 'note: %s\n' "${notes[@]}"
  echo "--- restored row counts ---"
  cat "$report.counts" 2>/dev/null || true
} > "$report"
log "restore-test $verdict (${elapsed}s) -> $report"
if [ "$verdict" = PASS ]; then
  date -u +%FT%TZ > "$BACKUP_DIR/last-restore-ok"
else
  alert "restore-test FAILED, see $report"
  exit 1
fi
