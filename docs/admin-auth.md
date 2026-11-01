# Admin auth (S-C)

Single owner. Code: `api/src/admin/`. Routes under `/api/v1/admin/auth`: `POST login`, `POST logout`, `GET me`, `POST totp/enroll`, `POST totp/verify`, `POST totp/disable`. Every other `/api/v1/admin/*` route goes through the same guard (`createAdminAuth().guard`); without auth configured the CMS routes stay deny-all.

- Password: argon2id (m=19456 KiB, t=2, p=1), generic error, dummy hash for unknown email.
- Session: 32-byte token, DB keeps sha256 only. Cookie `__Host-bj_admin` (HttpOnly, Secure, SameSite=Strict, Path=/). Idle 8 h (slides), absolute 7 d. Every login issues a new token and revokes an incoming one (`rotated_from`).
- CSRF (non-GET): `Origin` must equal `ADMIN_ORIGIN`, `Sec-Fetch-Site` same-origin/none, header `X-CSRF-Token` = `csrfToken` from login/`me`. Failure: 403 + audit `auth.csrf_denied`.
- Limits: 5 failures / 15 min / IP and 10 / h / account (`login_attempts`, HMAC keys) -> 429 + `Retry-After`; 10 consecutive failures lock the account 15 min.
- TOTP (optional): enroll -> verify (returns 8 recovery codes once, stored as argon2id hashes) -> login needs `totp` (6 digits or a recovery code, single use). Secret encrypted with AES-256-GCM (`TOTP_ENC_KEY`). Enabling/disabling revokes other sessions.
- Config (names only): `SESSION_HMAC_KEY[_FILE]`, `TOTP_ENC_KEY[_FILE]` (base64, 32 bytes), `ADMIN_ORIGIN`; all three are required to enable auth. `deploy/gen-secrets.sh` creates the two keys.
- Create the owner: `npm run cli -w @bj/api -- admin:create <email>`; the password is typed at the TTY (no echo, never argv/env/file).
- Audit actions: `admin.created`, `auth.login_success|login_failed|login_locked`, `auth.logout`, `auth.totp_enrolled|totp_verified|totp_disabled`, `auth.recovery_code_used`, `auth.csrf_denied`.
- Logs: pino redacts cookie, set-cookie, x-csrf-token, request body, password/token/totp/code fields; a test proves no secret reaches the log.
- Known limit: TOTP verify/disable are behind a session but have no extra attempt counter.
