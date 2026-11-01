#!/usr/bin/env bash
# Rooms smoke test through the public proxy (flag must be ON): 1v1 create -> join -> start -> submit x2 -> results.
# Usage: scripts/rooms-smoke.sh [BASE_URL]   (default https://beejunior.meducation.vn; needs curl + jq)
# Local run without TLS: ROOMS_COOKIE_SECURE=false on the server and BASE_URL=http://127.0.0.1:3100 (Origin is set to match ORIGIN).
set -euo pipefail

BASE="${1:-${BASE_URL:-https://beejunior.meducation.vn}}"
ORIGIN="${ORIGIN:-https://beejunior.meducation.vn}"
DIR="$(mktemp -d)"
HOST_JAR="$DIR/host" GUEST_JAR="$DIR/guest" CODE=""

req() { # req <jar> <METHOD> <path> [json]  -> body on stdout, fails on non-2xx
  local jar="$1" method="$2" path="$3" body="${4:-}"
  curl -fsS --max-time 15 -X "$method" -b "$jar" -c "$jar" -H "Origin: $ORIGIN" \
    ${body:+-H 'Content-Type: application/json' --data "$body"} "$BASE/rt$path"
}
cleanup() { [ -n "$CODE" ] && req "$HOST_JAR" POST "/rooms/$CODE/close" '{}' >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
# Answer keys must never appear before results.
noleak() { grep -Eqi 'correctKey|explanation' <<<"$2" && fail "$1 leaks answer data" || true; }

health=$(curl -fsS --max-time 10 "$BASE/rt/healthz") || fail "healthz unreachable"
[ "$(jq -r .enabled <<<"$health")" = true ] || fail "rooms flag is OFF (ROOMS_ENABLED)"

created=$(req "$HOST_JAR" POST /rooms '{"name":"Smoke Host","maxPlayers":2,"timeLimitMinutes":null,"test":{"mode":"mix","grade":6,"skills":["ngu-phap"],"topicSlug":null,"size":10,"difficulty":"balanced"}}')
CODE=$(jq -er .code <<<"$created")
noleak "create" "$created"
echo "room $CODE created"

noleak "preview" "$(req "$GUEST_JAR" GET "/rooms/$CODE/preview")"
joined=$(req "$GUEST_JAR" POST "/rooms/$CODE/join" '{"name":"Smoke Guest"}')
noleak "join" "$joined"
req "$HOST_JAR" POST "/rooms/$CODE/start" '{}' >/dev/null

for jar in "$HOST_JAR" "$GUEST_JAR"; do
  quiz=$(req "$jar" GET "/rooms/$CODE/quiz")
  noleak "quiz" "$quiz"
  for id in $(jq -r '.questions[].id' <<<"$quiz"); do
    req "$jar" PUT "/rooms/$CODE/answers" "{\"questionId\":\"$id\",\"key\":\"A\"}" >/dev/null
  done
  noleak "snapshot" "$(req "$jar" GET "/rooms/$CODE/snapshot")"
  req "$jar" POST "/rooms/$CODE/submit" '{}' >/dev/null
done

results=$(req "$HOST_JAR" GET "/rooms/$CODE/results")
[ "$(jq '.ranking | length' <<<"$results")" = 2 ] || fail "results should rank 2 players"
req "$GUEST_JAR" GET "/rooms/$CODE/review" | jq -e 'length > 0 and all(.[]; has("correctKey"))' >/dev/null || fail "review missing after results"
echo "PASS room $CODE: $(jq -c '[.ranking[] | {name, correct, total}]' <<<"$results")"
