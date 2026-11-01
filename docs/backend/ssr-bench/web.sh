#!/usr/bin/env bash
# usage: web.sh <name> <ttl_ms> [cpus] [mem]  -> starts SSR prototype container, prints IP
set -euo pipefail
S=~/.hermes/profiles/dev/cache/scratch/ssr
docker run -d --rm --name "$1" --label hermes.task=t_cbe773ed --memory "${4:-384m}" --memory-swap "${4:-384m}" --cpus="${3:-1}" --network bj-m-net \
  -v $S/.next/standalone:/app:ro -w /app \
  -e NODE_ENV=production -e PORT=3000 -e HOSTNAME=0.0.0.0 -e NEXT_TELEMETRY_DISABLED=1 \
  -e DATABASE_URL=postgres://postgres:${BENCH_PW:-bench}@bj-m-pg:5432/bj -e PG_POOL_MAX=5 -e CACHE_TTL_MS="$2" -e CACHE_STALE_MS=600000 -e HTML_TTL_MS=${HTML_TTL_MS:-60000} \
  node:22 sh -c "${5:-node server.js}" >/dev/null
for i in $(seq 1 40); do
  IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "bj-m-net").IPAddress}}' "$1")
  curl -s -o /dev/null -m 2 "http://$IP:3000/" && break; sleep 1
done
echo "$IP"
