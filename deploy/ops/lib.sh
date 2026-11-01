# Shared helpers for deploy/ops/*.sh (sourced). Pure bash + docker; no secrets handled here.
BACKUP_DIR="${BJ_BACKUP_DIR:-$HOME/backups/beejunior}"
PG_CONTAINER="${BJ_PG_CONTAINER:-beejunior-postgres-1}"
DB_NAME="${BJ_DB:-beejunior}"
OFFSITE_DIR="${BJ_OFFSITE_DIR:-$HOME/beejunior-offsite}" # r2.env (600) + backup-public.pem; NOT the DB secrets dir
OPS_JS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../scripts/ops" && pwd)"
# Content tables must match exactly between the live DB (at dump time) and the restored copy.
STRICT_TABLES="${BJ_STRICT_TABLES:-sources topics passages questions question_revisions tests test_items mixer_presets}"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# Pluggable alert: BJ_ALERT_CMD receives the message on stdin (e.g. a script that posts to Telegram).
alert() {
  log "ALERT $*" >&2
  [ -n "${BJ_ALERT_CMD:-}" ] && printf '%s\n' "BeeJunior: $*" | $BJ_ALERT_CMD || true
}

# counts <container> <db>: "table|rows" for every public table, sorted. Same query live and restored.
counts() {
  docker exec -i "$1" psql -U postgres -d "$2" -At -v ON_ERROR_STOP=1 -c \
    "SELECT format('SELECT %L, count(*) FROM public.%I;', tablename, tablename) FROM pg_tables WHERE schemaname='public' ORDER BY 1" \
    | docker exec -i "$1" psql -U postgres -d "$2" -At -v ON_ERROR_STOP=1 | sort
}

file_age_hours() { echo $(( ( $(date +%s) - $(stat -c %Y "$1") ) / 3600 )); }

newest_daily() { ls -1t "$BACKUP_DIR"/daily/beejunior-*.dump 2>/dev/null | head -n 1; }
