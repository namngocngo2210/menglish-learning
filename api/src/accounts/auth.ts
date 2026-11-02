import type { FastifyRequest } from "fastify";
import type pg from "pg";
import { hmacHex, newToken, safeEqual, sha256Hex } from "../admin/crypto";
import { HttpProblem } from "../server/problems";
import type { Captcha } from "./captcha";
import type { GoogleConfig } from "./google-config";
import type { Mailer } from "./mailer";

/** Parent cookie. Never the admin cookie (__Host-bj_admin): the two principals share nothing. */
export const USER_COOKIE = "__Host-bj_user";
export const IDLE_MS = 7 * 24 * 3600_000;
export const ABSOLUTE_MS = 30 * 24 * 3600_000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface AccountsDeps {
  pool: pg.Pool;
  /** USER_SESSION_HMAC_KEY: ip / email / user-id hashes. Must differ from the admin SESSION_HMAC_KEY. */
  hmacKey: string;
  /** Exact site Origin allowed on state-changing requests, e.g. https://beejunior.meducation.vn */
  origin: string;
  mailer: Mailer;
  /** Google sign-in; undefined = the /oauth/google routes answer 404. */
  google?: GoogleConfig;
  /** Turnstile on registration; undefined = off (default). */
  captcha?: Captcha;
  now?: () => Date;
}

export interface UserPrincipal {
  userId: string;
  sessionId: string;
  csrfSecret: string;
}

export const cookieHeader = (value: string, maxAgeS: number): string =>
  `${USER_COOKIE}=${value}; Max-Age=${String(maxAgeS)}; Path=/; HttpOnly; Secure; SameSite=Lax`;

export function readCookie(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === USER_COOKIE) return rest.join("=");
  }
  return undefined;
}

export function createUserAuth(deps: AccountsDeps) {
  const { pool, hmacKey } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const ipHash = (request: FastifyRequest): string => hmacHex(hmacKey, request.ip);
  /** Stable pseudonym of a user for audit_log / deletion_requests, which must hold no personal data. */
  const userRef = (userId: string): string => hmacHex(hmacKey, `user:${userId}`);
  /** Same idea for a deleted profile (its external id), so a restored old backup can be purged again. */
  const profileRef = (externalId: string): string => hmacHex(hmacKey, `profile:${externalId}`);

  async function audit(
    action: string,
    request: FastifyRequest,
    userId: string | null,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await pool.query(
      "INSERT INTO audit_log (action, entity_type, entity_id, details, ip_hash) VALUES ($1,'user',$2,$3,$4)",
      [action, userId === null ? null : userRef(userId), JSON.stringify(details), ipHash(request)],
    );
  }

  /** Origin and Sec-Fetch-Site must say "same origin"; applies to every state-changing request. */
  function originOk(request: FastifyRequest): boolean {
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== deps.origin) return false;
    const site = request.headers["sec-fetch-site"];
    return site === undefined || site === "same-origin" || site === "none";
  }

  async function denyCsrf(request: FastifyRequest, userId: string | null): Promise<never> {
    await audit("user.csrf_denied", request, userId, { method: request.method });
    throw new HttpProblem("forbidden", "CSRF check failed");
  }

  /** The one parent guard: valid session (idle + absolute expiry, slid on use) and CSRF for unsafe methods. */
  async function guard(request: FastifyRequest): Promise<UserPrincipal> {
    const token = readCookie(request);
    if (!token) throw new HttpProblem("unauthenticated");
    const t = now();
    const { rows } = await pool.query<{ id: string; user_id: string; csrf_secret: string }>(
      `UPDATE user_sessions SET last_seen_at = $2, expires_at = LEAST($2::timestamptz + $3 * interval '1 millisecond', absolute_expires_at)
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > $2 AND absolute_expires_at > $2
       RETURNING id, user_id::text, csrf_secret`,
      [sha256Hex(token), t, IDLE_MS],
    );
    const row = rows[0];
    if (!row) throw new HttpProblem("unauthenticated");
    const principal: UserPrincipal = {
      userId: row.user_id,
      sessionId: row.id,
      csrfSecret: row.csrf_secret,
    };
    if (!SAFE_METHODS.has(request.method)) {
      const sent = request.headers["x-csrf-token"];
      if (!originOk(request) || typeof sent !== "string" || !safeEqual(sent, row.csrf_secret))
        await denyCsrf(request, principal.userId);
    }
    return principal;
  }

  /** Always a brand-new token (anti-fixation); a token the client presented is revoked and recorded. */
  async function createSession(
    userId: string,
    request: FastifyRequest,
  ): Promise<{ token: string; csrfToken: string }> {
    const t = now();
    const old = readCookie(request);
    const oldId = old ? sha256Hex(old) : null;
    if (oldId)
      await pool.query(
        "UPDATE user_sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL",
        [oldId, t],
      );
    const token = newToken();
    const csrfToken = newToken();
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, csrf_secret, ip_hash, user_agent_hash, last_seen_at, expires_at, absolute_expires_at, rotated_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        sha256Hex(token),
        userId,
        csrfToken,
        ipHash(request),
        hmacHex(hmacKey, request.headers["user-agent"] ?? ""),
        t,
        new Date(t.getTime() + IDLE_MS),
        new Date(t.getTime() + ABSOLUTE_MS),
        oldId,
      ],
    );
    return { token, csrfToken };
  }

  /** Revokes all sessions of a user, or all but `keepId`. */
  const revokeSessions = (userId: string, keepId?: string): Promise<unknown> =>
    pool.query(
      "UPDATE user_sessions SET revoked_at = $3 WHERE user_id = $1 AND ($2::text IS NULL OR id <> $2) AND revoked_at IS NULL",
      [userId, keepId ?? null, now()],
    );

  /** Counted events inside a window (login failures, email sends, exports); also seconds until the oldest ages out. */
  async function countEvents(
    keyHash: string,
    windowMs: number,
  ): Promise<{ n: number; retry: number }> {
    const { rows } = await pool.query<{ n: string; oldest: Date | null }>(
      "SELECT count(*) AS n, min(created_at) AS oldest FROM login_attempts WHERE key_hash = $1 AND success = false AND created_at > $2",
      [keyHash, new Date(now().getTime() - windowMs)],
    );
    const n = Number(rows[0]?.n ?? 0);
    const oldest = rows[0]?.oldest;
    const retry = oldest
      ? Math.max(1, Math.ceil((oldest.getTime() + windowMs - now().getTime()) / 1000))
      : 1;
    return { n, retry };
  }

  const recordEvent = (keyHash: string, success = false): Promise<unknown> =>
    pool.query("INSERT INTO login_attempts (key_hash, success, created_at) VALUES ($1,$2,$3)", [
      keyHash,
      success,
      now(),
    ]);

  /** 429 + Retry-After once `max` events were counted for the key inside the window. */
  async function limit(key: string, max: number, windowMs: number): Promise<void> {
    const { n, retry } = await countEvents(key, windowMs);
    if (n >= max)
      throw new HttpProblem("rate_limited", `Retry after ${String(retry)} s`, undefined, retry);
  }

  return {
    now,
    ipHash,
    userRef,
    profileRef,
    audit,
    originOk,
    denyCsrf,
    guard,
    createSession,
    revokeSessions,
    countEvents,
    recordEvent,
    limit,
  };
}

export type UserAuth = ReturnType<typeof createUserAuth>;
