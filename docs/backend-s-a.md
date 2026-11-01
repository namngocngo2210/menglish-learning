# Sprint S-A — DB + migrations + importer

Deliverable of card t_e888732e (blueprint §7). Nothing here runs on the shared host: the database is a
throwaway container (`deploy/compose.dev.yml`), the site still serves static JSON until S-B.

## What exists

| Piece | Where |
|---|---|
| npm workspaces (`packages/*`, `api`, `web`); one root `package-lock.json` | root `package.json` |
| `@bj/core`: zod schemas, mixer, scoring, slug, routes, topics registry/classifier. `web/lib/*` are thin re-exports, web tests unchanged | `packages/core` ([ADR 0004](adr/0004-bundler-module-resolution.md)) |
| 21 SQL migrations with Up and Down (node-pg-migrate), roles, publish guard, public views `v_public_*` | `db/migrations` |
| Generated Kysely types (`kysely-codegen`, CI re-generates and diffs) | `packages/db-types` |
| CLI: `migrate`, `import`, `parity`, `export-snapshot` | `api/src/cli.ts` |
| Dev compose (throwaway Postgres, tmpfs, 256 MB/0.5 CPU) | `deploy/compose.dev.yml` |
| `check-migrations.mjs`: Up+Down present, gapless numbering, applied migrations are immutable vs `origin/main` | `scripts/` |

Run (dev):

```sh
export BJ_DEV_DB_PASSWORD=<throwaway>; docker compose -f deploy/compose.dev.yml up -d
export DATABASE_URL=postgres://postgres:$BJ_DEV_DB_PASSWORD@127.0.0.1:55432/postgres
npm run cli -w @bj/api -- migrate
npm run cli -w @bj/api -- import [--dry-run]
npm run cli -w @bj/api -- parity            # exit 1 on any difference
npm run cli -w @bj/api -- export-snapshot --out /tmp/snapshot
```

## Importer rules (all covered by tests)

1. Quarantine layer first, published layer second; published overrides, an absent optional field never erases an earlier value.
2. Topics referenced only through question classification are derived (115 declared + 31 derived = 146).
3. A passage is published iff one of its questions is published; `published_at` = latest `reviewedAt` of those questions.
4. One transaction, upserts by `external_id`/`slug`, no-op updates skipped (`IS DISTINCT FROM`), so a rerun changes nothing (even `updated_at`).
5. Rows edited through the CMS (`version > 1`) are never overwritten by the seed importer (D11: DB becomes the source of truth).
6. The 111 official-exam items arrive through `quarantine/gov-grade-9.json` (OCR output already merged in PR #15); the raw OCR transcripts stay in git (`crawler/ocr`), as the blueprint decided. `source_ref` is parsed into `provenance` for all 111.

## Import parity (blueprint §3.6) — measured, 0 differences

| Item | Expected | Database |
|---|---|---|
| Questions `published` | 2,698 (VOA 2,587 + gov 111) | 2,698 |
| Questions `quarantine` | 2 | 2 |
| Passages (all published) | 50 | 50 |
| Tests | 316 (238 mixed + 57 topic + 21 entrance10) | 316 |
| `test_items` | 4,590 | 4,590 |
| Sources / topics | 2 / 146 | 2 / 146 |
| Counts per grade/skill/status and per topic/status | from the JSON | equal |
| sha256 digest of the text of every question (stem, options, key, explanation) + per-test order hash | from the JSON | equal |
| Snapshot exported from the DB vs `web/content/tests/*.json` (deep compare, orders significant) | — | 0 differences |

## Permissions (tested)

`bj_worker` can insert only `quarantine` rows and cannot UPDATE/DELETE content; a role that is not a member of `bj_api`/`bj_migrate` cannot set `published` even with UPDATE; `bj_api` can; `audit_log` is append-only for `bj_api`; `bj_web` reads only `v_public_*` (a test is public only if all its questions are published). Group roles are `NOLOGIN`; deploy tooling creates login roles with Docker-secret passwords (S-F).

## Deviations from the standards (recorded)

- Import suffix `.js` replaced by Bundler resolution: [ADR 0004](adr/0004-bundler-module-resolution.md).
- node-pg-migrate marker text is `-- Up Migration` / `-- Down Migration` (the standards example shows `-- Up`/`-- Down`).
- `web` joined the root workspaces, so `web/package-lock.json` is gone and its Docker build context is the repository root. Production dependency versions were re-pinned in the new lock to the old web lock (131 prod packages, 0 version differences); `lucide-react`, `tailwind-merge` and `@types/react*` were pinned back because a fresh resolve picked newer minors.
- Core's pure test suites that predate the extraction (mixer, scoring, routes, topics) still live in `web/tests` and are included by `packages/core/vitest.config.ts` so the 90% coverage floor measures them.
