# docs/backend — supporting files for the blueprint

Design-only artifacts for [../backend-blueprint.md](../backend-blueprint.md). **Not migrations, not deployed code.**

| File | What |
|---|---|
| `schema.sql` | Draft Postgres 16 schema; loaded successfully into a throwaway container |
| `import.sql`, `prep.py` | Idempotent importer prototype over the current `web/content` JSON (see blueprint §3.6 for measured counts) |
| `openapi-sketch.yaml` | API contract sketch |
| `compose.sketch.yml` | Container layout / limits / networks sketch |
| `ssr-bench/` | SSR measurement scripts, prototype sources and [raw results](ssr-bench/RESULTS.md) |

## Reproduce the DB/importer measurement

```sh
python3 -I prep.py ../../web/content stg.tsv          # stage JSON (quarantine layer first, published layer second)
docker network create --internal bj-bp-net
docker run -d --rm --name bj-bp-pg --label hermes.task=$HERMES_KANBAN_TASK --memory 512m --cpus=1 --network bj-bp-net \
  -e POSTGRES_PASSWORD=throwaway -v "$PWD":/work:ro postgres:16-alpine -c shared_buffers=128MB -c max_connections=20
docker exec bj-bp-pg psql -U postgres -c "CREATE DATABASE t2"
docker exec bj-bp-pg psql -U postgres -d t2 -v ON_ERROR_STOP=1 -f /work/schema.sql
docker exec bj-bp-pg psql -U postgres -d t2 -v ON_ERROR_STOP=1 -f /work/import.sql   # run twice: second run must change nothing
```

Expected report: 2,698 published (2,587 VOA + 111 gov), 2 quarantine, 50 passages, 316 tests, 4,590 test_items, 2 sources, 146 topics. Afterwards stop the container and remove the network `bj-bp-net`.
