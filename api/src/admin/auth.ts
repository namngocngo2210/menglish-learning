import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { HttpProblem } from "../server/problems";
import {
  DUMMY_HASH,
  RECOVERY_CODE,
  decrypt,
  encrypt,
  hashSecret,
  hmacHex,
  newRecoveryCodes,
  newToken,
  newTotpSecret,
  safeEqual,
  sha256Hex,
  totpValid,
  verifySecret,
} from "./crypto";

export const COOKIE = "__Host-bj_admin";
export const IDLE_MS = 8 * 3600_000;
export const ABSOLUTE_MS = 7 * 24 * 3600_000;
const IP_LIMIT = { max: 5, windowMs: 15 * 60_000 };
const ACCOUNT_LIMIT = { max: 10, windowMs: 3600_000 };
const LOCK_AFTER = 10;
const LOCK_MS = 15 * 60_000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface AuthDeps {
  pool: pg.Pool;
  /** HMAC key for ip/email hashes (SESSION_HMAC_KEY). */
  hmacKey: string;
  /** 32 raw bytes, encrypts TOTP secrets (TOTP_ENC_KEY). */
  totpKey: Buffer;
  /** Exact allowed Origin, e.g. https://beejunior.meducation.vn */
  origin: string;
  now?: () => Date;
}

export interface Principal {
  adminUserId: string;
  sessionId: string;
  csrfSecret: string;
}

const loginBody = z.strictObject({
  email: z.string().min(3).max(254),
  password: z.string().min(1).max(256),
  totp: z.string().min(6).max(16).optional(),
});
const codeBody = z.strictObject({ code: z.string().min(6).max(16) });
const disableBody = z.strictObject({
  password: z.string().min(1).max(256),
  code: z.string().min(6).max(16),
});

const cookieHeader = (value: string, maxAgeS: number): string =>
  `${COOKIE}=${value}; Max-Age=${String(maxAgeS)}; Path=/; HttpOnly; Secure; SameSite=Strict`;

function readCookie(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return undefined;
}

export function createAdminAuth(deps: AuthDeps) {
  const { pool, hmacKey, totpKey } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const ipHash = (request: FastifyRequest): string => hmacHex(hmacKey, request.ip);

  async function audit(
    action: string,
    request: FastifyRequest,
    adminUserId: string | null,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await pool.query(
      "INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, details, ip_hash) VALUES ($1::bigint,$2,'admin_user',$1::text,$3,$4)",
      [adminUserId, action, JSON.stringify(details), ipHash(request)],
    );
  }

  /** Origin and Sec-Fetch-Site must say "same origin" (blueprint 5.2). Applies to every state-changing request. */
  function checkOrigin(request: FastifyRequest): boolean {
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== deps.origin) return false;
    const site = request.headers["sec-fetch-site"];
    return site === undefined || site === "same-origin" || site === "none";
  }

  async function denyCsrf(request: FastifyRequest, adminUserId: string | null): Promise<never> {
    await audit("auth.csrf_denied", request, adminUserId, { method: request.method });
    throw new HttpProblem("forbidden", "CSRF check failed");
  }

  /** The one admin guard: valid session (idle + absolute expiry, slid on use) and CSRF for unsafe methods. */
  async function guard(request: FastifyRequest): Promise<Principal> {
    const token = readCookie(request);
    if (!token) throw new HttpProblem("unauthenticated");
    const t = now();
    const { rows } = await pool.query<{
      id: string;
      admin_user_id: string;
      csrf_secret: string;
    }>(
      `UPDATE admin_sessions SET last_seen_at = $2, expires_at = LEAST($2::timestamptz + $3 * interval '1 millisecond', absolute_expires_at)
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > $2 AND absolute_expires_at > $2
       RETURNING id, admin_user_id::text, csrf_secret`,
      [sha256Hex(token), t, IDLE_MS],
    );
    const row = rows[0];
    if (!row) throw new HttpProblem("unauthenticated");
    const principal: Principal = {
      adminUserId: row.admin_user_id,
      sessionId: row.id,
      csrfSecret: row.csrf_secret,
    };
    if (!SAFE_METHODS.has(request.method)) {
      const sent = request.headers["x-csrf-token"];
      if (!checkOrigin(request) || typeof sent !== "string" || !safeEqual(sent, row.csrf_secret))
        await denyCsrf(request, principal.adminUserId);
    }
    return principal;
  }

  async function createSession(
    adminUserId: string,
    request: FastifyRequest,
    rotatedFrom: string | null,
  ): Promise<{ token: string; csrfToken: string }> {
    const t = now();
    const token = newToken();
    const csrfToken = newToken();
    await pool.query(
      `INSERT INTO admin_sessions (id, admin_user_id, csrf_secret, ip_hash, user_agent_hash, last_seen_at, expires_at, absolute_expires_at, rotated_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        sha256Hex(token),
        adminUserId,
        csrfToken,
        ipHash(request),
        hmacHex(hmacKey, request.headers["user-agent"] ?? ""),
        t,
        new Date(t.getTime() + IDLE_MS),
        new Date(t.getTime() + ABSOLUTE_MS),
        rotatedFrom,
      ],
    );
    return { token, csrfToken };
  }

  const revokeOthers = (adminUserId: string, keepId: string): Promise<unknown> =>
    pool.query(
      "UPDATE admin_sessions SET revoked_at = now() WHERE admin_user_id = $1 AND id <> $2 AND revoked_at IS NULL",
      [adminUserId, keepId],
    );

  /** Failed attempts inside a window; also returns seconds until the oldest one ages out. */
  async function failures(
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

  const record = (keyHash: string, success: boolean): Promise<unknown> =>
    pool.query("INSERT INTO login_attempts (key_hash, success, created_at) VALUES ($1,$2,$3)", [
      keyHash,
      success,
      now(),
    ]);

  async function login(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    if (!checkOrigin(request)) await denyCsrf(request, null);
    const body = loginBody.parse(request.body);
    const email = body.email.trim().toLowerCase();
    const ipKey = `ip:${ipHash(request)}`;
    const mailKey = `mail:${hmacHex(hmacKey, email)}`;
    const [byIp, byMail] = await Promise.all([
      failures(ipKey, IP_LIMIT.windowMs),
      failures(mailKey, ACCOUNT_LIMIT.windowMs),
    ]);
    const { rows } = await pool.query<{
      id: string;
      password_hash: string;
      totp_secret_enc: string | null;
      locked_until: Date | null;
    }>(
      "SELECT id::text, password_hash, totp_secret_enc, locked_until FROM admin_users WHERE lower(email) = $1",
      [email],
    );
    const user = rows[0];
    const lockedUntil =
      user?.locked_until && user.locked_until > now() ? user.locked_until : undefined;
    if (byIp.n >= IP_LIMIT.max || byMail.n >= ACCOUNT_LIMIT.max || lockedUntil) {
      // Same 429 whether or not the account exists; the audit row tells the owner.
      const retry = lockedUntil
        ? Math.ceil((lockedUntil.getTime() - now().getTime()) / 1000)
        : Math.max(
            byIp.n >= IP_LIMIT.max ? byIp.retry : 1,
            byMail.n >= ACCOUNT_LIMIT.max ? byMail.retry : 1,
          );
      await audit("auth.login_locked", request, user?.id ?? null);
      throw new HttpProblem("rate_limited", `Retry after ${String(retry)} s`, undefined, retry);
    }

    const passwordOk = await verifySecret(user?.password_hash ?? DUMMY_HASH, body.password);
    let secondFactor: "ok" | "missing" | "bad" = "ok";
    let usedRecovery = false;
    if (
      user &&
      passwordOk &&
      user.totp_secret_enc &&
      !user.totp_secret_enc.startsWith("pending:")
    ) {
      if (body.totp === undefined) secondFactor = "missing";
      else if (RECOVERY_CODE.test(body.totp)) {
        usedRecovery = await consumeRecoveryCode(user.id, body.totp);
        secondFactor = usedRecovery ? "ok" : "bad";
      } else
        secondFactor = totpValid(decrypt(totpKey, user.totp_secret_enc), body.totp, now().getTime())
          ? "ok"
          : "bad";
    }
    if (secondFactor === "missing") throw new HttpProblem("unauthenticated", "totp_required"); // password was right, so this leaks nothing new

    if (!user || !passwordOk || secondFactor !== "ok") {
      await Promise.all([record(ipKey, false), record(mailKey, false)]);
      if (user) {
        await pool.query(
          `UPDATE admin_users SET failed_login_count = failed_login_count + 1,
             locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN $3::timestamptz ELSE locked_until END WHERE id = $1`,
          [user.id, LOCK_AFTER, new Date(now().getTime() + LOCK_MS)],
        );
      }
      await audit("auth.login_failed", request, user?.id ?? null);
      throw new HttpProblem("unauthenticated", "Invalid credentials");
    }

    await Promise.all([record(ipKey, true), record(mailKey, true)]);
    await pool.query(
      "UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = $2 WHERE id = $1",
      [user.id, now()],
    );
    // Anti-fixation: always a brand-new token; an incoming one is revoked and recorded.
    const old = readCookie(request);
    const oldId = old ? sha256Hex(old) : null;
    if (oldId)
      await pool.query(
        "UPDATE admin_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
        [oldId],
      );
    const session = await createSession(user.id, request, oldId);
    await audit("auth.login_success", request, user.id);
    if (usedRecovery) await audit("auth.recovery_code_used", request, user.id);
    void reply.header("set-cookie", cookieHeader(session.token, ABSOLUTE_MS / 1000));
    return { csrfToken: session.csrfToken };
  }

  /** Marks one unused recovery code as used; true when it matched. */
  async function consumeRecoveryCode(adminUserId: string, code: string): Promise<boolean> {
    const { rows } = await pool.query<{ id: string; code_hash: string }>(
      "SELECT id::text, code_hash FROM admin_recovery_codes WHERE admin_user_id = $1 AND used_at IS NULL",
      [adminUserId],
    );
    for (const row of rows) {
      if (await verifySecret(row.code_hash, code)) {
        const done = await pool.query(
          "UPDATE admin_recovery_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL",
          [row.id],
        );
        return done.rowCount === 1;
      }
    }
    return false;
  }

  /**
   * TOTP verify/disable share the login failure counter and lockout, so a stolen session cannot
   * brute-force the code or password. Lockout-DoS note: only the account's own sessions can trigger
   * it here, and an admin can clear it with the CLI; login lockout is the same trade-off.
   */
  async function assertNotLocked(id: string): Promise<void> {
    const { rows } = await pool.query<{ locked_until: Date | null }>(
      "SELECT locked_until FROM admin_users WHERE id = $1",
      [id],
    );
    const until = rows[0]?.locked_until;
    if (until && until > now()) {
      const retry = Math.ceil((until.getTime() - now().getTime()) / 1000);
      throw new HttpProblem("rate_limited", `Retry after ${String(retry)} s`, undefined, retry);
    }
  }

  async function failAttempt(id: string): Promise<void> {
    await pool.query(
      `UPDATE admin_users SET failed_login_count = failed_login_count + 1,
         locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN $3::timestamptz ELSE locked_until END WHERE id = $1`,
      [id, LOCK_AFTER, new Date(now().getTime() + LOCK_MS)],
    );
  }

  async function userRow(
    id: string,
  ): Promise<{ email: string; password_hash: string; totp_secret_enc: string | null }> {
    const { rows } = await pool.query<{
      email: string;
      password_hash: string;
      totp_secret_enc: string | null;
    }>("SELECT email, password_hash, totp_secret_enc FROM admin_users WHERE id = $1", [id]);
    const row = rows[0];
    if (!row) throw new HttpProblem("unauthenticated");
    return row;
  }

  /** Routes under /api/v1/admin/auth. Every one passes the same guard except login. */
  function plugin(app: FastifyInstance, _opts: unknown, done: () => void): void {
    const principals = new WeakMap<FastifyRequest, Principal>();
    const me = (request: FastifyRequest): Principal => {
      const p = principals.get(request);
      if (!p) throw new HttpProblem("unauthenticated");
      return p;
    };
    app.addHook("onRequest", async (request) => {
      if (request.method === "POST" && request.url.split("?")[0]?.endsWith("/auth/login")) return;
      principals.set(request, await guard(request));
    });
    const send = (reply: FastifyReply, body: unknown, status = 200): FastifyReply =>
      reply.code(status).header("cache-control", "no-store").send(body);

    app.post(
      "/login",
      { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
      async (request, reply) => send(reply, await login(request, reply)),
    );

    app.post("/logout", async (request, reply) => {
      const p = me(request);
      await pool.query("UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [p.sessionId]);
      await audit("auth.logout", request, p.adminUserId);
      void reply.header("set-cookie", cookieHeader("", 0));
      return send(reply, { status: "ok" });
    });

    app.get("/me", async (request, reply) => {
      const p = me(request);
      const user = await userRow(p.adminUserId);
      return send(reply, {
        email: user.email,
        totpEnabled: !!user.totp_secret_enc && !user.totp_secret_enc.startsWith("pending:"),
        csrfToken: p.csrfSecret,
      });
    });

    app.post("/totp/enroll", async (request, reply) => {
      const p = me(request);
      const user = await userRow(p.adminUserId);
      if (user.totp_secret_enc && !user.totp_secret_enc.startsWith("pending:"))
        throw new HttpProblem("conflict", "TOTP is already enabled");
      const secret = newTotpSecret();
      await pool.query("UPDATE admin_users SET totp_secret_enc = $2 WHERE id = $1", [
        p.adminUserId,
        `pending:${encrypt(totpKey, secret)}`,
      ]);
      await audit("auth.totp_enrolled", request, p.adminUserId);
      const label = encodeURIComponent(`BeeJunior:${user.email}`);
      return send(reply, {
        secret,
        otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=BeeJunior&digits=6&period=30`,
      });
    });

    app.post("/totp/verify", async (request, reply) => {
      const p = me(request);
      const { code } = codeBody.parse(request.body);
      const user = await userRow(p.adminUserId);
      if (!user.totp_secret_enc?.startsWith("pending:"))
        throw new HttpProblem("conflict", "No pending TOTP enrollment");
      await assertNotLocked(p.adminUserId);
      const secret = decrypt(totpKey, user.totp_secret_enc.slice(8));
      if (!totpValid(secret, code, now().getTime())) {
        await failAttempt(p.adminUserId);
        throw new HttpProblem("validation_failed", "Invalid code");
      }
      const codes = newRecoveryCodes();
      const hashes = await Promise.all(codes.map(hashSecret));
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("UPDATE admin_users SET totp_secret_enc = $2 WHERE id = $1", [
          p.adminUserId,
          encrypt(totpKey, secret),
        ]);
        await client.query("DELETE FROM admin_recovery_codes WHERE admin_user_id = $1", [
          p.adminUserId,
        ]);
        for (const h of hashes)
          await client.query(
            "INSERT INTO admin_recovery_codes (admin_user_id, code_hash) VALUES ($1,$2)",
            [p.adminUserId, h],
          );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      await revokeOthers(p.adminUserId, p.sessionId);
      await audit("auth.totp_verified", request, p.adminUserId);
      return send(reply, { recoveryCodes: codes });
    });

    app.post("/totp/disable", async (request, reply) => {
      const p = me(request);
      const body = disableBody.parse(request.body);
      const user = await userRow(p.adminUserId);
      if (!user.totp_secret_enc || user.totp_secret_enc.startsWith("pending:"))
        throw new HttpProblem("conflict", "TOTP is not enabled");
      await assertNotLocked(p.adminUserId);
      const passwordOk = await verifySecret(user.password_hash, body.password);
      // Password first so a wrong password never burns a recovery code.
      const codeOk =
        passwordOk &&
        (RECOVERY_CODE.test(body.code)
          ? await consumeRecoveryCode(p.adminUserId, body.code)
          : totpValid(decrypt(totpKey, user.totp_secret_enc), body.code, now().getTime()));
      if (!passwordOk || !codeOk) {
        await failAttempt(p.adminUserId);
        throw new HttpProblem("forbidden", "Invalid credentials");
      }
      await pool.query("UPDATE admin_users SET totp_secret_enc = NULL WHERE id = $1", [
        p.adminUserId,
      ]);
      await pool.query("DELETE FROM admin_recovery_codes WHERE admin_user_id = $1", [
        p.adminUserId,
      ]);
      await revokeOthers(p.adminUserId, p.sessionId);
      await audit("auth.totp_disabled", request, p.adminUserId);
      return send(reply, { status: "ok" });
    });
    done();
  }

  return { guard, plugin, audit };
}

export type AdminAuth = ReturnType<typeof createAdminAuth>;
