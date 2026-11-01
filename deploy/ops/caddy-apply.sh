#!/usr/bin/env bash
# Applies a candidate Caddyfile to the SHARED Caddy with validation, probes and automatic rollback (decision D10).
#   caddy-apply.sh <live-caddyfile> <candidate-caddyfile> <probe-url>...
# 1. `caddy validate` the candidate inside the Caddy container (nothing changes if it is invalid)
# 2. keep <live>.bak-<UTC stamp>, install the candidate, `caddy reload`
# 3. every probe URL must answer 2xx/3xx within 10 s; otherwise the backup is restored and reloaded (exit 1)
# Run by the OWNER or ops after approving that exact change; agents never run it on the host.
set -euo pipefail
live="${1:?live Caddyfile path}"; cand="${2:?candidate Caddyfile path}"; shift 2
[ "$#" -ge 1 ] || { echo "give at least one probe URL" >&2; exit 2; }
C="${CADDY_CONTAINER:-menglish-proxy-caddy-1}"

# Where the live file appears inside the container (bind mount), so `reload` reads the same file.
inside="$(docker inspect -f '{{range .Mounts}}{{.Source}}={{.Destination}}{{"\n"}}{{end}}' "$C" | awk -F= -v p="$(readlink -f "$live")" '$1==p{print $2; exit}')"
[ -n "$inside" ] || { echo "cannot find $live among the mounts of $C (single-file bind mount?)" >&2; exit 2; }

docker cp "$cand" "$C:/tmp/Caddyfile.candidate"
docker exec "$C" caddy validate --config /tmp/Caddyfile.candidate --adapter caddyfile || { echo "candidate INVALID, nothing changed" >&2; exit 1; }

bak="$live.bak-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$live" "$bak"
# Write in place (same inode): a single-file bind mount does not follow a renamed file.
cat "$cand" > "$live"
rollback() {
  echo "ROLLBACK: restoring $bak" >&2
  cat "$bak" > "$live"
  docker exec "$C" caddy reload --config "$inside" --adapter caddyfile
}
docker exec "$C" caddy reload --config "$inside" --adapter caddyfile || { rollback; exit 1; }
sleep 3
for url in "$@"; do
  code="$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' "$url" || echo 000)"
  case "$code" in 2* | 3*) echo "probe ok  $code $url" ;; *) echo "probe BAD $code $url" >&2; rollback; exit 1 ;; esac
done
echo "applied; previous config kept at $bak"
