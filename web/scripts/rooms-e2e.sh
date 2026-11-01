#!/usr/bin/env bash
# Rooms e2e. Usage: scripts/rooms-e2e.sh on|off [playwright args]
# on : needs `ROOMS_ENABLED=true ROOMS_DEV_PROXY=http://127.0.0.1:$ROOMS_PORT npm run build` first; starts the rooms server
#      (RSS cap 192 MB, non-host port) and runs the specs through the Next dev-proxy for /rt.
# off: needs a build with ROOMS_ENABLED unset; checks the coming-soon state.
set -euo pipefail
MODE="${1:?on|off}"; shift || true
cd "$(dirname "$0")/.."
export E2E_PORT="${E2E_PORT:-3101}" ROOMS_PORT="${ROOMS_PORT:-3210}" ROOMS_E2E="$MODE"
export PW_CHROME="${PW_CHROME:-$HOME/.hermes/tools/chromium-1208/chrome-linux64/chrome}"
SERVER_PID=""
if [ "$MODE" = "on" ]; then
  export ROOMS_ENABLED=true ROOMS_DEV_PROXY="http://127.0.0.1:$ROOMS_PORT"
  ROOMS_DIR="$(cd ../rooms && pwd)"
  [ -f "$ROOMS_DIR/dist/server.mjs" ] || (cd "$ROOMS_DIR" && npm run build)
  [ -f "$ROOMS_DIR/data/bank-rooms.json" ] || (cd "$ROOMS_DIR" && npm run build:bank)
  PORT="$ROOMS_PORT" HOST=127.0.0.1 ROOMS_ALLOWED_ORIGINS="http://127.0.0.1:$E2E_PORT" ROOMS_COOKIE_SECURE=false ROOMS_TRUST_PROXY=false \
    ROOMS_CREATE_PER_HOUR=1000 ROOMS_MAX_ROOMS_PER_IP=50 ROOMS_BAD_CODE_PER_MIN=1000 ROOMS_BAD_CODE_PER_HOUR=1000 ROOMS_JOIN_PER_MIN=1000 ROOMS_TICK_MS=500 \
    systemd-run --user --scope --quiet -p MemoryMax=192M -p MemorySwapMax=0 -- node "$ROOMS_DIR/dist/server.mjs" > "${TMPDIR:-/tmp}/rooms-e2e-server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 50); do curl -fs "http://127.0.0.1:$ROOMS_PORT/rt/healthz" >/dev/null && break; sleep 0.2; done
  curl -fs "http://127.0.0.1:$ROOMS_PORT/rt/healthz" >/dev/null || { echo "rooms server did not start"; exit 1; }
else
  unset ROOMS_ENABLED
fi
peak() { [ -n "$SERVER_PID" ] && pgrep -f "dist/server.mjs" | while read -r p; do grep -E '^VmHWM' "/proc/$p/status" 2>/dev/null; done | sort -u | tail -1; }
trap 'echo "rooms server peak: $(peak)"; pkill -f "dist/server.mjs" || true' EXIT
# Playwright (and the Next server it starts) is the heavy part: caller wraps this script in heavy; the rooms server stays outside the lock on purpose.
npx playwright test e2e/rooms-seo.spec.ts $( [ "$MODE" = "on" ] && echo e2e/rooms.spec.ts ) "$@"
