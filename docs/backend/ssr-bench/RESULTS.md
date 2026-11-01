# SSR benchmark — raw results (2026-11-01, measured on the shared host)

Throwaway prototype, not product code. The repo's real Next build (Next 16.4.3, Node 22 Debian image) with ONLY the test page
(`app/[grade]/[skill]/[topic]/[test]/page.tsx`) switched to `dynamic = "force-dynamic"` and reading Postgres 16 (schema/data from `../schema.sql` + `../import.sql`).
Everything ran in `--rm` containers labelled `hermes.task`, on a `--internal` Docker network, with memory caps (`--memory-swap` = `--memory`).
Load generator = `load.js` (Node, keep-alive, round-robin over 80 distinct test URLs, identity encoding) running on the SAME host, so it competes for CPU: numbers are conservative.

Containers: Postgres 16-alpine `256m / 0.5 CPU` (`shared_buffers=96MB`, `max_connections=30`); web `384m / 1 CPU`; API prototype `160m / 0.5 CPU`.
Page: ~118 KB HTML (20+ questions, 4 JSON-LD blocks, `<h1>`, canonical, no JS required to read).

| Scenario | conc | req/s | TTFB p50 | p95 | p99 | web peak MiB | pg peak MiB |
|---|---|---|---|---|---|---|---|
| SSR, no cache | 1 | 30.7 | 25.6 | 69.3 | 120.7 | 183 | 89 |
| SSR, no cache | 10 | 27.7 | 347.8 | 527.2 | 713.0 | 132 | 97 |
| SSR, no cache | 50 | 27.7 | 1706.0 | 2491.6 | 2602.1 | 149 | 97 |
| SSR + in-process data cache 60 s | 10 | 21.6 | 413.7 | 642.6 | 2105.0 | 87 | 97 |
| SSR + in-process data cache 60 s | 50 | 26.5 | 1727.1 | 2357.9 | 3292.0 | 114 | 86 |
| SSR + HTML edge-cache (warm) | 1 | 1391.9 | 0.3 | 0.9 | 2.4 | 104 | 89 |
| SSR + HTML edge-cache (warm) | 10 | 3885.9 | 1.9 | 5.0 | 7.8 | 90 | 89 |
| SSR + HTML edge-cache (warm) | 50 | 2333.8 | 15.9 | 49.8 | 84.7 | 146 | 97 |
| SSR + HTML edge-cache (warm) | 200 | 3472.1 | 51.8 | 96.3 | 155.0 | 131 | 97 |
| Static (current production image, copy) | 10 | 83.4 | 34.9 | 893.1 | 1585.4 | 160 | — |
| Static (current production image, copy) | 50 | 254.1 | 167.3 | 327.4 | 472.8 | 166 | — |

All scenarios: 0 non-200 responses. First render after process start: 0.78–0.93 s.
API prototype (Fastify + helmet + cookie + rate-limit + pino + pg, 1–2 queries per request): RSS idle 22 MiB, 35 MiB after 50-concurrent load; 282 req/s, TTFB p50 153 ms / p95 316 ms (5.9 KB JSON).

## DB outage (`docker pause` Postgres = hang, the worst case), edge-cache TTL 2 s

```
1 warm A (proxy):      200 0.93s  x-cache: MISS
3 A stale (proxy):     200 0.005s x-cache: STALE        (DB paused)
4 B cold (proxy):      503 3.08s  retry-after: 30       (clean HTML maintenance page)
5 A again (proxy):     200 0.004s x-cache: STALE
6 B direct to Next:    500 3.04s                          (what Caddy would see without the edge-cache)
7 DB back, B (proxy):  200 0.13s  x-cache: MISS
```

## Lighthouse (mobile, 1 run each, `http://` on an internal network, loaded host)

| Mode | Perf | SEO | A11y | BP | LCP | server response |
|---|---|---|---|---|---|---|
| SSR + edge-cache | 87 | 100 | 100 | 79 | 3.3 s | 10 ms |
| SSR no cache | 78 | 100 | 100 | 79 | 3.0 s | 40 ms |
| Static (today's image) | 77 | 100 | 100 | 79 | 3.0 s | 20 ms |

Absolute values fail the CI gate even for today's static build (loaded host, `http://`, one run) — they are only useful as a RELATIVE comparison. The real gate is Lighthouse CI in sprint S-B.

## Reproduce

`up.sh` (network + Postgres + schema + import + slug list), `web.sh <name> <data_ttl_ms> <cpus> <mem> "<cmd>"` (SSR container; `HTML_TTL_MS` env for the edge-cache),
`scen.sh <label> <container> <conc> <secs> [port]`, `degrade.sh`, `lh.sh`. Prototype sources: `db-proto.ts` (pool + data cache), `patch_page.py` (page switch), `proxy.cjs` (edge-cache), `api-proto.cjs`.
Paths inside the scripts point to the dev scratch dir; adjust before reuse. Note: agent sessions cannot stop containers directly; they were ended with `kill -TERM 1` where PID 1 honours it.
