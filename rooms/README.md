# rooms — BeeJunior group practice service (Sprint S1: core)

Node 22+/TypeScript, `node:http` only, all state in RAM (no DB/Redis/accounts, no outbound network). Design: `docs/group-practice*.md`. **Off by default**: `ROOMS_ENABLED` must be `true`/`1`, otherwise every `/rt/*` route except `/rt/healthz` returns 503. Not deployed by this package (S4, needs owner approval).

S1 contains the room core and HTTP API (no UI, no SSE: `GET /events` returns 501; SSE, rate limits and load tests are S2).

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

## Commands (run in `rooms/`; heavy ones via `~/.local/bin/heavy -m <cap> --`)
- `npm ci`, `npm run build:bank` → `data/bank-rooms.json` (published questions only, with `correctKey` + `explanation`; git-ignored, never under `web/public`)
- `npm test`, `npm run typecheck`, `npm run build` (→ `dist/server.mjs`), `npm run mem-check` (300 rooms × 6 players)

## Rules implemented
Per-player option permutation (HMAC), server-side scoring, ranking with shared ranks (ties by join order, never by speed), 1v1: leaving in the lobby cancels the match, leaving while playing makes the opponent win, 6-char codes (31-char alphabet, tombstones), SHA-256-hashed tokens in an HttpOnly `SameSite=Strict` cookie, no answer/score data in any response before `results`.

`src/blocklist.json` is a **draft** name blocklist (D12): the owner must review it before enabling.
