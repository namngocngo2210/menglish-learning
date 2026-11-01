#!/usr/bin/env bash
# Chaos check for the S-B stack: Postgres / api unreachable, cold start without a database, recovery.
# Runs against the throwaway stack of docs/backend/ssr-bench/up.sh (containers bj-v-pg, bj-v-api,
# network bj-v-net, secrets in $SECRETS) and starts its own bj-v-chaos-* web containers (killed at the end).
#   SECRETS=<dir with url_web, tok> IMAGE=bj-v-web:t [EDGE_JS=<freshly built edge.mjs>] bash scripts/ssr/chaos.sh
# Exit code 0 only if every expectation below holds. Pause (not stop) is used: connections hang, the harsher case.
set -u
SECRETS=${SECRETS:?set SECRETS}; IMAGE=${IMAGE:-bj-v-web:t}; NET=${NET:-bj-v-net}
HERE=$(cd "$(dirname "$0")" && pwd)
LBL=(--label "hermes.task=${HERMES_KANBAN_TASK:-chaos}")
GBOT="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
fails=0
probe() { docker run --rm "${LBL[@]}" --network "$NET" -v "$HERE:/w:ro" -v "$SECRETS:/s:ro" "$IMAGE" node /w/probe.mjs "$@"; }
web() { # web <name>: edge container with the warmer off (deterministic), optional new edge bundle
  local extra=(); [ -n "${EDGE_JS:-}" ] && extra=(-v "$EDGE_JS:/app/edge/edge.mjs:ro")
  docker run -d --rm "${LBL[@]}" --name "$1" --network "$NET" -v "$SECRETS:/s:ro" "${extra[@]}" \
    --memory 384m --memory-swap 384m --cpus 1 --read-only --tmpfs /tmp \
    -e WARM_ENABLED=false -e CONTENT_SOURCE=db -e DATABASE_URL_FILE=/s/url_web -e INTERNAL_TOKEN_FILE=/s/tok -e PG_POOL_MAX=5 \
    -e NODE_OPTIONS=--max-old-space-size=256 "$IMAGE" node --max-old-space-size=256 edge/edge.mjs >/dev/null
}
expect() { # expect <label> <got> <regex>
  if [[ "$2" =~ $3 ]]; then echo "PASS $1: $2"; else echo "FAIL $1: got '$2', want /$3/"; fails=$((fails + 1)); fi
}
cleanup() { docker unpause bj-v-pg bj-v-api >/dev/null 2>&1; docker kill bj-v-chaos-a bj-v-chaos-b >/dev/null 2>&1; }
trap cleanup EXIT
wait_ready() { for _ in $(seq 40); do [ "$(probe "$1" 3100 /readyz | cut -d' ' -f1)" = 200 ] && return 0; sleep 1; done; return 1; }

echo "== 1. warm cache, database paused, soft purge, Googlebot"
web bj-v-chaos-a; wait_ready bj-v-chaos-a || { echo "FAIL chaos-a never ready"; exit 1; }
read -r PATH_A PATH_B <<<"$(probe bj-v-chaos-a 3100 --tests)"
[ -n "${PATH_B:-}" ] || { echo "FAIL no test pages in the sitemap"; exit 1; }
expect "A cold (db up)" "$(probe bj-v-chaos-a 3100 "$PATH_A" "$GBOT" | cut -d' ' -f1,2)" '^200 MISS$'
docker pause bj-v-pg >/dev/null
probe bj-v-chaos-a 3100 --purge "{\"paths\":[\"$PATH_A\"],\"soft\":true}" /s/tok >/dev/null
expect "A expired, db paused, Googlebot -> STALE, instant" "$(probe bj-v-chaos-a 3100 "$PATH_A" "$GBOT")" '^200 STALE - [0-9]{1,3}$'
sleep 2
expect "A refilled in the background" "$(probe bj-v-chaos-a 3100 "$PATH_A" "$GBOT" | cut -d' ' -f1,2)" '^200 HIT$'
expect "B never cached, db paused: rendered from the in-process snapshot" "$(probe bj-v-chaos-a 3100 "$PATH_B" "$GBOT" | cut -d' ' -f1,2)" '^200 MISS$'
expect "readyz while db paused (snapshot kept)" "$(probe bj-v-chaos-a 3100 /readyz | cut -d' ' -f1)" '^200$'

expect "api readyz while db paused (healthz stays up)" "$(probe bj-v-api 8080 /readyz | cut -d' ' -f1)-$(probe bj-v-api 8080 /healthz | cut -d' ' -f1)" '^503-200$'

echo "== 2. api paused: the web does not depend on it"
docker pause bj-v-api >/dev/null
expect "A with api paused" "$(probe bj-v-chaos-a 3100 "$PATH_A" "$GBOT" | cut -d' ' -f1,2)" '^200 HIT$'
docker unpause bj-v-api >/dev/null

echo "== 3. cold start with the database unreachable: no cache, no snapshot -> 503 + Retry-After"
web bj-v-chaos-b; sleep 6
expect "readyz without db" "$(probe bj-v-chaos-b 3100 /readyz | cut -d' ' -f1)" '^(503|500)$'
expect "A without cache or snapshot (Googlebot)" "$(probe bj-v-chaos-b 3100 "$PATH_A" "$GBOT" | cut -d' ' -f1,2,3)" '^503 ERROR [0-9]+$'

echo "== 4. recovery without restart"
docker unpause bj-v-pg >/dev/null
ok=0; for _ in $(seq 40); do r=$(probe bj-v-chaos-b 3100 "$PATH_A" "$GBOT" | cut -d' ' -f1); [ "$r" = 200 ] && ok=1 && break; sleep 1; done
expect "chaos-b serves 200 after the db is back (same process)" "$ok" '^1$'
expect "chaos-b readyz" "$(probe bj-v-chaos-b 3100 /readyz | cut -d' ' -f1)" '^200$'
ok=0; for _ in $(seq 30); do [ "$(probe bj-v-api 8080 /readyz | cut -d' ' -f1)" = 200 ] && ok=1 && break; sleep 1; done
expect "api readyz recovers without restart" "$ok" '^1$'
echo "failures: $fails"
exit $((fails > 0))
