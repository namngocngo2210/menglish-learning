#!/usr/bin/env bash
# Memory soak for the capped S-B stack (decision D8: web 384 MB, api 160 MB, postgres 256 MB).
# Needs the up.sh stack (bj-v-pg, bj-v-api, bj-v-web on network bj-v-net). Moderate load for MINUTES (default 60):
# web: 4 concurrent keep-alive clients over the sitemap test pages; api: 2 concurrent clients; every 5 min a soft
# purge of the whole edge cache so the warmer re-renders all pages (the realistic worst churn).
# Every 5 min one CSV line per container: minute, docker-stats MiB, sum of process VmRSS MiB, oom_kill count.
#   SECRETS=<dir> IMAGE=bj-v-web:t MINUTES=60 bash scripts/ssr/soak.sh > soak.csv
set -u
SECRETS=${SECRETS:?set SECRETS}; IMAGE=${IMAGE:-bj-v-web:t}; NET=${NET:-bj-v-net}; MINUTES=${MINUTES:-60}
HERE=$(cd "$(dirname "$0")" && pwd)
LBL=(--label "hermes.task=${HERMES_KANBAN_TASK:-soak}")
LOG=${TMPDIR:-/tmp}
cx() { docker run --rm "${LBL[@]}" --network "$NET" --memory 128m -v "$HERE:/w:ro" -v "$SECRETS:/s:ro" "$IMAGE" node "$@"; }
trap 'docker kill bj-v-soak-w bj-v-soak-a >/dev/null 2>&1' EXIT
SECS=$((MINUTES * 60))
docker run -d "${LBL[@]}" --name bj-v-soak-w --network "$NET" --memory 128m -v "$HERE:/w:ro" "$IMAGE" node /w/load.mjs --host bj-v-web --port 3100 --conc 4 --secs "$SECS" --sample 80 >/dev/null
docker run -d "${LBL[@]}" --name bj-v-soak-a --network "$NET" --memory 128m -v "$HERE:/w:ro" "$IMAGE" node /w/load.mjs --host bj-v-api --port 8080 --conc 2 --secs "$SECS" --paths /api/v1/public/grades,/api/v1/public/topics >/dev/null
rss() { docker exec "$1" sh -c 't=0; for p in /proc/[0-9]*; do v=$(awk "/VmRSS/{print \$2}" $p/status 2>/dev/null); [ -n "$v" ] && t=$((t+v)); done; echo $((t/1024))'; }
echo "minute,container,stats_mib,rss_sum_mib,oom_kills"
for i in $(seq 0 5 "$MINUTES"); do
  for c in bj-v-web bj-v-api bj-v-pg; do
    s=$(docker stats --no-stream --format '{{.MemUsage}}' "$c" | awk '{print $1}' | sed 's/MiB//')
    o=$(docker exec "$c" sh -c 'grep oom_kill /sys/fs/cgroup/memory.events | cut -d" " -f2' 2>/dev/null)
    echo "$i,$c,$s,$(rss "$c"),${o:-?}"
  done
  [ "$i" -ge "$MINUTES" ] && break
  cx /w/probe.mjs bj-v-web 3100 --purge '{"all":true,"soft":true}' /s/tok >/dev/null
  sleep 300
done
sleep 5
docker logs bj-v-soak-w 2>&1 | tail -1
docker logs bj-v-soak-a 2>&1 | tail -1
docker rm -f bj-v-soak-w bj-v-soak-a >/dev/null 2>&1
