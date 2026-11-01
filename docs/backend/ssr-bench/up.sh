#!/usr/bin/env bash
set -euo pipefail
B=~/.hermes/profiles/dev/cache/scratch/bp
S=~/.hermes/profiles/dev/cache/scratch/ssr
L="--label hermes.task=$HERMES_KANBAN_TASK"
docker network create --internal bj-m-net >/dev/null
docker run -d --rm --name bj-m-pg $L --memory 256m --memory-swap 256m --cpus=0.5 --network bj-m-net -e POSTGRES_PASSWORD=throwaway -v $B:/work:ro \
  postgres:16-alpine -c shared_buffers=96MB -c max_connections=30 -c work_mem=4MB -c maintenance_work_mem=32MB -c effective_cache_size=192MB \
  -c max_wal_size=512MB -c wal_compression=on -c jit=off >/dev/null
for i in $(seq 1 30); do docker exec bj-m-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec bj-m-pg psql -U postgres -q -c "CREATE DATABASE bj" 
docker exec bj-m-pg psql -U postgres -d bj -q -v ON_ERROR_STOP=1 -f /work/schema.sql
docker exec bj-m-pg psql -U postgres -d bj -v ON_ERROR_STOP=1 -f /work/import.sql 2>&1 | grep -E "published|quarantine" | head -3
cp -r $S/.next/static $S/.next/standalone/.next/static
cp -r $S/public $S/.next/standalone/public 2>/dev/null || true
docker exec bj-m-pg psql -U postgres -d bj -tAc "SELECT slug FROM tests WHERE kind='topic' OR (kind='mixed' AND slug ~ '^lop-[0-9]/[a-z-]+/[a-z0-9-]+/de-[0-9]+$') ORDER BY md5(slug) LIMIT 80" > $B/slugs.txt
wc -l $B/slugs.txt
