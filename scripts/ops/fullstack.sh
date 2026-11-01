#!/usr/bin/env bash
# Throwaway FULL-STACK harness for S-F measurements (postgres + api + web + worker from deploy/compose.yml).
# Runs under a separate compose project (default "bjsf") on its own network; never touches Caddy, the real
# "menglish-proxy" network, or any production data. Everything is labelled hermes.task and removed by `down`.
#
#   BJ_FS_SECRETS=<dir made by deploy/gen-secrets.sh> TAG=sf scripts/ops/fullstack.sh up|down|stats|load|soak|chaos|drill
#   up                 start the stack (images beejunior-api:$TAG and beejunior-web:$TAG must exist), migrate, db-init, import
#   stats              one CSV block: container, mem MiB / limit, cpu %, restarts, OOMKilled
#   load <secs> <conc> closed-loop load on web (:3100) and api (:8080) from a container on the proxy network
#   soak <minutes>     moderate load + stats every 5 min (CSV on stdout)
#   chaos              kill api, kill postgres, check behaviour + recovery + watchdog; exit 1 on any failed expectation
#   drill              backup.sh -> restore-test.sh against this stack (BJ_BACKUP_DIR=<tmp>)
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
P="${BJ_FS_PROJECT:-bjsf}"
TAG="${TAG:-sf}"
SECRETS_DIR="${BJ_FS_SECRETS:?set BJ_FS_SECRETS}"
TASK="${HERMES_KANBAN_TASK:-fullstack}"
export SECRETS_DIR TAG
GEN="$REPO/deploy/.compose.fullstack.yml"
dc() { docker compose -p "$P" -f "$GEN" -f "$REPO/deploy/.compose.fullstack.labels.yml" "$@"; }
# A one-off node container on the stack's proxy network (same path the Caddy upstream would use).
cx() { docker run --rm --label "hermes.task=$TASK" --network "$P-proxy" --memory 128m --cpus 1 -v "$REPO/scripts/ssr:/w:ro" -v "$SECRETS_DIR:/s:ro" node:22-alpine node "$@"; }
probe() { cx /w/probe.mjs "$@"; }
fails=0
expect() { if [[ "$2" =~ $3 ]]; then echo "PASS $1: $2"; else echo "FAIL $1: got '$2', want /$3/"; fails=$((fails + 1)); fi; }

prepare() {
  sed "s#menglish-proxy: { external: true }#menglish-proxy: { name: $P-proxy }#" "$REPO/deploy/compose.yml" > "$GEN"
  { echo "services:"; for s in postgres migrate db-init import api web worker; do printf '  %s:\n    labels: { hermes.task: "%s" }\n' "$s" "$TASK"; done; } > "$REPO/deploy/.compose.fullstack.labels.yml"
}
wait_healthy() { # wait_healthy <service> <seconds>
  for _ in $(seq "$2"); do [ "$(docker inspect -f '{{.State.Health.Status}}' "$P-$1-1" 2>/dev/null)" = healthy ] && return 0; sleep 1; done; return 1
}
stats() {
  echo "container,mem_mib,mem_limit_mib,cpu_pct,restarts,oom_killed"
  for s in postgres api web worker; do
    c="$P-$s-1"
    read -r mem lim cpu < <(docker stats --no-stream --format '{{.MemUsage}} {{.CPUPerc}}' "$c" | awk '{gsub("MiB","",$1); gsub("MiB","",$3); gsub("%","",$4); print $1, $3, $4}')
    echo "$s,$mem,$lim,$cpu,$(docker inspect -f '{{.RestartCount}},{{.State.OOMKilled}}' "$c")"
  done
}

case "${1:-}" in
  up)
    prepare
    dc up -d --no-build postgres && wait_healthy postgres 60 || { echo "postgres not healthy"; exit 1; }
    dc run --rm migrate && dc run --rm db-init && dc run --rm import || { echo "bootstrap failed"; exit 1; }
    dc up -d --no-build api web worker
    for s in api web worker; do wait_healthy "$s" 120 && echo "$s healthy" || { echo "$s NOT healthy"; exit 1; }; done ;;
  down) prepare; dc down -v --remove-orphans ;;
  stats) stats ;;
  load)
    secs="${2:-30}"; conc="${3:-20}"
    cx /w/load.mjs --host bj-web --port 3100 --conc "$conc" --secs "$secs" --sample 80 --label web &
    cx /w/load.mjs --host bj-api --port 8080 --conc 2 --secs "$secs" --paths /api/v1/public/grades,/api/v1/public/topics --label api &
    sleep $((secs / 2)); stats; wait ;;
  soak)
    mins="${2:-60}"; secs=$((mins * 60))
    cx /w/load.mjs --host bj-web --port 3100 --conc 4 --secs "$secs" --sample 80 --label web-soak > "${TMPDIR:-/tmp}/soak-web.json" &
    cx /w/load.mjs --host bj-api --port 8080 --conc 2 --secs "$secs" --paths /api/v1/public/grades,/api/v1/public/topics --label api-soak > "${TMPDIR:-/tmp}/soak-api.json" &
    for i in $(seq 0 5 "$mins"); do
      echo "# minute $i"; stats
      [ "$i" -ge "$mins" ] && break
      probe bj-web 3100 --purge '{"all":true,"soft":true}' /s/internal_token > /dev/null
      sleep 300
    done
    wait; cat "${TMPDIR:-/tmp}/soak-web.json" "${TMPDIR:-/tmp}/soak-api.json" ;;
  chaos)
    G="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    read -r PA _ <<< "$(probe bj-web 3100 --tests)"
    expect "baseline page" "$(probe bj-web 3100 "$PA" "$G" | cut -d' ' -f1)" '^200$'
    echo "== 1. kill -9 api: site unaffected, restart policy brings it back"
    # `docker kill` counts as a manual stop in Docker 29 (the restart policy then does NOT fire), so crash the
    # container's init from the host instead: that is what an OOM kill or a segfault looks like to the daemon.
    kill -9 "$(docker inspect -f '{{.State.Pid}}' "$P-api-1")"; t0=$SECONDS
    expect "web page while api is down" "$(probe bj-web 3100 "$PA" "$G" | cut -d' ' -f1)" '^200$'
    sleep 3; wait_healthy api 90; expect "api healthy again (restart policy)" "$?" '^0$'; echo "api recovery: $((SECONDS - t0)) s"
    expect "api RestartCount" "$(docker inspect -f '{{.RestartCount}}' "$P-api-1")" '^[1-9]'
    echo "== 2. kill -9 postgres: cached pages keep serving, api degrades, everything self-heals"
    rc_api="$(docker inspect -f '{{.RestartCount}}' "$P-api-1")"; rc_worker="$(docker inspect -f '{{.RestartCount}}' "$P-worker-1")"
    before="$(docker exec "$P-postgres-1" psql -U postgres -d beejunior -Atc 'select count(*) from questions')"
    # postgres runs as uid 70, so the host cannot SIGKILL it without sudo: kill it, then start it again after 8 s
    # (acting as the supervisor). Crash recovery from WAL is what is being tested, not the restart policy.
    docker kill "$P-postgres-1" > /dev/null; t0=$SECONDS
    ( sleep 8; docker start "$P-postgres-1" > /dev/null ) &
    probe bj-web 3100 --purge "{\"paths\":[\"$PA\"],\"soft\":true}" /s/internal_token > /dev/null
    expect "expired page served stale for Googlebot, db down" "$(probe bj-web 3100 "$PA" "$G" | cut -d' ' -f1,2)" '^200 (STALE|HIT)$'
    expect "api /healthz stays 200" "$(probe bj-api 8080 /healthz | cut -d' ' -f1)" '^200$'
    wait_healthy postgres 90; expect "postgres healthy again" "$?" '^0$'; echo "postgres recovery: $((SECONDS - t0)) s"
    ok=1; for _ in $(seq 60); do [ "$(probe bj-api 8080 /readyz | cut -d' ' -f1)" = 200 ] && [ "$(probe bj-web 3100 /readyz | cut -d' ' -f1)" = 200 ] && ok=0 && break; sleep 1; done
    expect "api and web /readyz recover without restarting them" "$ok" '^0$'; echo "readyz recovery: $((SECONDS - t0)) s"
    expect "no data lost after kill -9 (questions count)" "$(docker exec "$P-postgres-1" psql -U postgres -d beejunior -Atc 'select count(*) from questions')" "^$before\$"
    expect "web RestartCount unchanged (0)" "$(docker inspect -f '{{.RestartCount}}' "$P-web-1")" '^0$'
    # A dropped postgres connection must not crash the long-running processes (pool 'error' listeners).
    expect "api did not crash on the lost connection" "$(docker inspect -f '{{.RestartCount}}' "$P-api-1")" "^$rc_api\$"
    expect "worker did not crash on the lost connection" "$(docker inspect -f '{{.RestartCount}}' "$P-worker-1")" "^$rc_worker\$"
    echo "failures: $fails"; exit $((fails > 0)) ;;
  drill)
    B="$(mktemp -d)"
    export BJ_PG_CONTAINER="$P-postgres-1" BJ_BACKUP_DIR="$B" BJ_COMPOSE_PROJECT="$P" HERMES_KANBAN_TASK="$TASK"
    bash "$REPO/deploy/ops/backup.sh" && bash "$REPO/deploy/ops/restore-test.sh" && cat "$B"/restore-reports/*.txt | head -30
    echo "--- watchdog"; bash "$REPO/deploy/ops/watchdog.sh"; echo "watchdog exit=$?"; echo "backup dir: $B" ;;
  *) sed -n 2,13p "$0"; exit 2 ;;
esac
