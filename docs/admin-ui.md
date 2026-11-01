# Admin UI (S-E)

Single-owner admin SPA in `admin/` (Vite + React 19 + Tailwind v4 + lucide-react, no router library, no runtime UI kit). Built to `admin/dist` and served by the api at `/admin` (decision D5). Vietnamese UI, BeeJunior brand (CTA yellow `#ffc001` with ink text, links `#0a6590`, surface `#fffdf5`).

## Screens (hash routes)

| Route | Screen |
|---|---|
| (login) | email + password, TOTP/recovery step when the api answers 401 `totp_required`, 429 countdown |
| `#/` | dashboard (quick links) |
| `#/review` | queue by status for questions/passages, filters, bulk transition with `expected_count` confirm |
| `#/questions/:id`, `#/passages/:id` (`new`) | editor with inline validation, student preview, status stepper, transitions, revision history |
| `#/sources`, `#/crawl` | sources CRUD, enqueue/cancel crawl jobs, failures view |
| `#/tests`, `#/presets` | tests (create, rename, transition), mixer presets CRUD |
| `#/reports`, `#/audit` | wrong-answer reports (resolve/dismiss), read-only audit log |
| `#/settings` | optional 2FA enroll / disable; recovery codes shown once |

## Security properties

- Session cookie is HttpOnly (`__Host-bj_admin`); the CSRF token lives in memory only and is sent as `X-CSRF-Token` on every non-GET.
- Hash routing, no `next`/`redirect` parameter anywhere: nothing can redirect off-origin.
- No `dangerouslySetInnerHTML`; every server string renders as text (component tests with hostile content).
- CSP from the api on `/admin`: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` (`api/src/server/admin-static.ts`; same string in `admin/vite.config.ts` for e2e). Fonts are self-hosted, nothing inline.
- Static handler: no new dependency, path traversal guard (decoded segments, NUL, backslash, `..`), SPA fallback only for extensionless paths.
- No secrets in the UI. The TOTP secret is shown once, masked by default.

## Build and run

- `ADMIN_DIST=<dir>` enables `/admin` in the api (unset = not served). `api/Dockerfile` builds the SPA and sets `ADMIN_DIST=/app/admin`.
- `npm run build -w @bj/admin`, `npm test -w @bj/admin`.
- e2e: `npm run build -w @bj/admin`, then `PW_CHROME=<chrome path> npx playwright test` in `admin/` (390 and 1440 px, API mocked in `e2e/fixtures.ts`, axe on every screen, CSP and open-redirect checks; screenshots land in `e2e/screenshots/`, git-ignored).

## Notes

- The transition table is duplicated in `admin/src/lib/transitions.ts` (buttons only); a unit test asserts it equals `api/src/cms/transitions.ts`.
- `eslint.config.js` has an `admin/**` block: PascalCase components and browser globals (`fetch`) are allowed; every other strict rule applies.
- The `topic_id` fields are numeric ids typed by hand: there is no admin topics endpoint yet (out of scope, no new API).
- The crawl "failures" view shows jobs with status `failed` or `error_count > 0`; the API exposes counters only, no error text.
