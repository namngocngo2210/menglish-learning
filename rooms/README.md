# rooms — BeeJunior group practice service (Sprints S1 core + S2 realtime/safety)

Node 22+/TypeScript, `node:http` only, all state in RAM (no DB/Redis/accounts, no outbound network). Design: `docs/group-practice*.md`. **Off by default**: `ROOMS_ENABLED` must be `true`/`1`, otherwise every `/rt/*` route except `/rt/healthz` returns 503. Not deployed by this package (S4, needs owner approval).

S1 = room core + HTTP API. S2 (this README) adds SSE, polling fallback, liveness, rate limits, graceful drain, `/rt/healthz`, security headers, load and chaos tests. No UI yet.

## Environment
| Var | Default | Meaning |
|-----|---------|---------|
| `ROOMS_ENABLED` | `false` | Feature flag (legal check NĐ 13 pending, D10) |
| `PORT` / `HOST` | `3100` / `127.0.0.1` | Listener |
| `ROOMS_BANK_PATH` | `rooms/data/bank-rooms.json` | Server-side bank **with answers** |
| `ROOMS_ALLOWED_ORIGINS` | `https://beejunior.meducation.vn` | Comma list; required `Origin` on POST/PUT |
| `ROOMS_COOKIE_SECURE` | `true` | `Secure` flag on the token cookie |
| `ROOMS_MAX_ROOMS` | `300` | Live room cap (503 `busy`) |
| `ROOMS_MAX_PLAYERS_CAP` | `45` | Upper bound for `maxPlayers` (default per room 10) |
| `ROOMS_TRUST_PROXY` | `true` | Client IP = rightmost `X-Forwarded-For` entry (set by Caddy); `false` = socket address |
| `ROOMS_CREATE_PER_HOUR` / `ROOMS_MAX_ROOMS_PER_IP` | `10` / `3` | Room creation per IP per hour / live rooms per IP |
| `ROOMS_BAD_CODE_PER_MIN` / `_PER_HOUR` | `20` / `60` | Unknown-code lookups per IP (429 + `Retry-After`) |
| `ROOMS_JOIN_PER_MIN` | `120` | Joins per IP per minute |
| `ROOMS_ANSWER_PER_MIN` / `ROOMS_ACTION_PER_MIN` | `120` / `30` | `PUT /answers` / other POSTs per player per minute |
| `ROOMS_SSE_PER_IP` / `ROOMS_SSE_GLOBAL` | `60` / `2000` | Concurrent event streams per IP / in total (429 / 503) |
| `ROOMS_DRAIN_MS` | `30000` | Max wait for `playing` rooms on SIGTERM |
| `ROOMS_TICK_MS` | `5000` | Sweep interval (deadlines, disconnects, expiry, tombstones) |

All limits are per hashed IP (salted, rotated daily, never logged) or per player id, sliding windows in RAM. They are deliberately generous for school NAT; tune via env.

## Realtime
- `GET /rt/rooms/{code}/events` (cookie auth): `retry: 3000`, then `snapshot`, then `player_joined`, `player_left`, `player_kicked`, `player_connection`, `host_changed`, `settings_changed`, `game_started`, `progress`, `results_ready`, `rematch` (per-player snapshot), `room_closed{reason}`, `superseded`, `server_restarting`; `: ping` every 20 s. Event `id` = room version. Broadcasts are identical for everybody and carry no scores/answers (scanned in tests and in the load test).
- A second stream for the same token replaces the first (`superseded`). Slow consumers (>64 KB buffered) are dropped; EventSource reconnects and gets a fresh snapshot.
- Fallback: `GET /snapshot` every 3 s with `If-None-Match` (ETag `W/"<version>-<playerId>"`, 304 when unchanged). Any authenticated request counts as liveness; a player without a stream and silent for 15 s is marked disconnected (host transfer after 60 s, auto-submit after 120 s).
- A join request that carries a cookie token already active in that room is refused (`409 already_joined`).
- SIGTERM: new rooms refused (`503 busy`), `server_restarting` broadcast, waits up to `ROOMS_DRAIN_MS` for `playing` rooms, then closes the rest with `room_closed{maintenance}` and exits 0.

## Tests
- `npm test`: unit, API, realtime (SSE over real sockets, injected clock), names, chaos (seeded random ops + invariants) and a SIGTERM test (needs `npm run build`; skipped if `dist/` is missing).
- Load test (spawns `dist/server.mjs` on an ephemeral 127.0.0.1 port, child RSS sampled from `/proc`, aborts above 192 MB): `npm run build && ~/.local/bin/heavy -m 900M -- npm run load-test` (300 rooms x 6 and 20 rooms x 30); `-- --quick` = 20 x 6; `-- --scenario a|b`. The test raises `ROOMS_SSE_GLOBAL` to 3000 (default 2000 is below the 2400 streams of the full run).

## Blocklist (owner review)
`src/blocklist.json` is a DRAFT (D12) for the owner to review before enabling. Rules: entries of 4+ letters match anywhere in the normalized name (accents removed, separators removed, leetspeak `0 3 4 5 @` folded, `1` as i or l); shorter entries only match as a whole word or whole name, so names like "Long", "Du", "Ngư" stay allowed (`tests/names.test.ts` lists ~48 accepted names and ~28 rejected ones). It also blocks impersonation words (admin, giáo viên, BeeJunior) and contact-sharing patterns (zalo, fb, links, 6+ digits).

## Commands (run in `rooms/`; heavy ones via `~/.local/bin/heavy -m <cap> --`)
- `npm ci`, `npm run build:bank` → `data/bank-rooms.json` (published questions only, with `correctKey` + `explanation`; git-ignored, never under `web/public`)
- `npm test`, `npm run typecheck`, `npm run build` (→ `dist/server.mjs`), `npm run mem-check` (300 rooms × 6 players)

## Rules implemented
Per-player option permutation (HMAC), server-side scoring, ranking with shared ranks (ties by join order, never by speed), 1v1: leaving in the lobby cancels the match, leaving while playing makes the opponent win, 6-char codes (31-char alphabet, tombstones), SHA-256-hashed tokens in an HttpOnly `SameSite=Strict` cookie, no answer/score data in any response before `results`.

`src/blocklist.json` is a **draft** name blocklist (D12): the owner must review it before enabling.
