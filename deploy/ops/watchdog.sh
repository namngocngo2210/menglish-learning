#!/usr/bin/env bash
# Watchdog (cron every 5 min): containers healthy, readiness endpoints, backup freshness, restore drill age, disk.
# Prints one line per check (OK/FAIL). On FAIL it calls BJ_ALERT_CMD (message on stdin), at most once per 6 h per
# distinct failure set. Exit 1 if any check fails. Read-only: it never restarts or changes anything.
set -uo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
PROJECT="${BJ_COMPOSE_PROJECT:-beejunior}"
MAX_BACKUP_H="${BJ_MAX_BACKUP_HOURS:-26}"
MAX_RESTORE_H="${BJ_MAX_RESTORE_HOURS:-192}" # weekly drill + a day of slack
fails=()
ok() { echo "OK   $1"; }
bad() { echo "FAIL $1"; fails+=("$1"); }

for svc in postgres api web worker; do
  c="$PROJECT-$svc-1"
  st="$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$c" 2>/dev/null || echo missing)"
  if [ "$st" = running/healthy ]; then ok "$svc container $st"; else bad "$svc container $st"; fi
done
probe() { docker exec "$PROJECT-$1-1" wget -qO- -T 4 "http://127.0.0.1:$2$3" >/dev/null 2>&1; }
if probe api 8080 /readyz; then ok "api /readyz"; else bad "api /readyz"; fi
if probe web 3100 /readyz; then ok "web /readyz"; else bad "web /readyz"; fi

d="$(newest_daily)"
if [ -z "$d" ]; then
  bad "no local backup"
else
  h="$(file_age_hours "$d")"
  if [ "$h" -le "$MAX_BACKUP_H" ]; then ok "local backup ${h}h old"; else bad "local backup ${h}h old (> ${MAX_BACKUP_H}h)"; fi
fi
if [ -f "$OFFSITE_DIR/r2.env" ]; then
  if [ -f "$BACKUP_DIR/last-offsite-ok" ]; then
    h="$(file_age_hours "$BACKUP_DIR/last-offsite-ok")"
    if [ "$h" -le "$MAX_BACKUP_H" ]; then ok "off-host copy ${h}h old"; else bad "off-host copy ${h}h old"; fi
  else
    bad "off-host copy never succeeded"
  fi
fi
if [ -f "$BACKUP_DIR/last-restore-ok" ]; then
  h="$(file_age_hours "$BACKUP_DIR/last-restore-ok")"
  if [ "$h" -le "$MAX_RESTORE_H" ]; then ok "restore drill ${h}h old"; else bad "restore drill ${h}h old"; fi
else
  bad "restore drill never succeeded"
fi
free_gb="$(df -BG --output=avail "$BACKUP_DIR" 2>/dev/null | tail -1 | tr -dc 0-9)"
if [ "${free_gb:-0}" -ge 5 ]; then ok "disk ${free_gb}G free"; else bad "disk ${free_gb:-?}G free (< 5G)"; fi

state="$BACKUP_DIR/.watchdog-state"
if [ "${#fails[@]}" -gt 0 ]; then
  sig="$(printf '%s\n' "${fails[@]}" | sha256sum | cut -c1-16)"
  if [ ! -f "$state" ] || [ "$(cut -d' ' -f1 "$state")" != "$sig" ] || [ $(( $(date +%s) - $(cut -d' ' -f2 "$state") )) -gt 21600 ]; then
    alert "watchdog: $(printf '%s; ' "${fails[@]}")"
    echo "$sig $(date +%s)" > "$state"
  fi
  exit 1
fi
rm -f "$state"
