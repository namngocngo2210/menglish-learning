import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { hmacHex, newToken, sha256Hex } from "../admin/crypto";
import { HttpProblem } from "../server/problems";
import { ABSOLUTE_MS, cookieHeader, createUserAuth } from "./auth";
import type { AccountsDeps, UserPrincipal } from "./auth";
import { CONSENT_PURPOSES, CONSENT_TEXTS, POLICY_VERSION, consentMatches } from "./consent-texts";
import type { ConsentPurpose } from "./consent-texts";
import { existingAccountMessage, resetPasswordMessage, verifyEmailMessage } from "./mailer";
import type { MailMessage } from "./mailer";
import { cleanNickname } from "./nickname";
import { checkPasswordHash, hashPassword, passwordProblem } from "./password";
import {
  changePasswordBody,
  deleteAccountBody,
  idParam,
  loginBody,
  profileCreateBody,
  progressImportBody,
  profileUpdateBody,
  registerBody,
  resetConfirmBody,
  resetRequestBody,
  verifyBody,
} from "./schemas";

export const PROFILE_LIMIT = 5;
const VERIFY_TTL_MS = 24 * 3600_000;
const RESET_TTL_MS = 3600_000;
const DELETE_DUE_MS = 72 * 3600_000;
const LOGIN_IP = { max: 5, windowMs: 15 * 60_000 };
const LOGIN_MAIL = { max: 10, windowMs: 3600_000 };
const SEND_MAIL = { max: 3, windowMs: 3600_000 };
const SEND_IP = { max: 10, windowMs: 3600_000 };
const EXPORT = { max: 3, windowMs: 3600_000 };
const PASSWORD_FAILS = { max: 10, windowMs: 3600_000 };

declare module "fastify" {
  interface FastifyContextConfig {
    /** Account routes are guarded by default; a route opts out only with this flag (see PUBLIC_ROUTES). */
    accountPublic?: boolean;
  }
}

/** The only account routes reachable without a parent session. The route inventory test pins this list. */
export const PUBLIC_ROUTES: readonly string[] = [
  "GET /api/v1/account/consent-texts",
  "POST /api/v1/account/login",
  "POST /api/v1/account/password-reset/confirm",
  "POST /api/v1/account/password-reset/request",
  "POST /api/v1/account/register",
  "POST /api/v1/account/verify-email",
];

interface ProfileRow {
  external_id: string;
  nickname: string;
  grade: number;
  created_at: Date;
}
const profileJson = (row: ProfileRow): object => ({
  id: row.external_id,
  nickname: row.nickname,
  grade: row.grade,
  createdAt: row.created_at,
});

export function accountsPlugin(deps: AccountsDeps) {
  const { pool } = deps;
  const auth = createUserAuth(deps);
  const { now } = auth;
  const generic = (): object => ({ status: "ok" });

  async function tx<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Fire and forget so a response never reveals whether mail was sent; failures are logged without the address. */
  function sendMail(request: FastifyRequest, message: MailMessage): void {
    void deps.mailer.send(message).catch((error: unknown) => {
      request.log.error({ err: { name: (error as Error).name } }, "mail_send_failed");
    });
  }

  /** Per-address and per-IP send budget; counted whether or not the address has an account (no enumeration). */
  async function sendBudget(request: FastifyRequest, email: string): Promise<void> {
    const mailKey = `send-mail:${hmacHex(deps.hmacKey, email)}`;
    const ipKey = `send-ip:${auth.ipHash(request)}`;
    await auth.limit(mailKey, SEND_MAIL.max, SEND_MAIL.windowMs);
    await auth.limit(ipKey, SEND_IP.max, SEND_IP.windowMs);
    await Promise.all([auth.recordEvent(mailKey), auth.recordEvent(ipKey)]);
  }

  /** Stores only the sha256; older unused tokens of the same purpose stop working. */
  async function issueToken(
    client: pg.PoolClient,
    userId: string,
    purpose: "verify_email" | "reset_password",
    ttlMs: number,
  ): Promise<string> {
    const raw = newToken();
    await client.query(
      "UPDATE user_tokens SET used_at = $3 WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL",
      [userId, purpose, now()],
    );
    await client.query(
      "INSERT INTO user_tokens (user_id, purpose, token_sha256, expires_at) VALUES ($1,$2,$3,$4)",
      [userId, purpose, sha256Hex(raw), new Date(now().getTime() + ttlMs)],
    );
    return raw;
  }

  /** Marks a one-time token used and returns its user, or undefined when unknown, used or expired. */
  async function consumeToken(
    client: pg.PoolClient,
    raw: string,
    purpose: "verify_email" | "reset_password",
  ): Promise<string | undefined> {
    const { rows } = await client.query<{ user_id: string }>(
      `UPDATE user_tokens SET used_at = $3
       WHERE token_sha256 = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > $3 RETURNING user_id::text`,
      [sha256Hex(raw), purpose, now()],
    );
    return rows[0]?.user_id;
  }

  const insertConsent = (
    client: pg.PoolClient,
    request: FastifyRequest,
    userId: string,
    purpose: ConsentPurpose,
    profileId: string | null,
  ): Promise<unknown> =>
    client.query(
      "INSERT INTO consents (user_id, profile_id, purpose, policy_version, text_hash, given_at, ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        userId,
        profileId,
        purpose,
        POLICY_VERSION,
        CONSENT_TEXTS[purpose].textHash,
        now(),
        auth.ipHash(request),
      ],
    );

  /** Opens a session for a user whose identity was just proven; returns the CSRF token for the SPA. */
  async function startSession(
    request: FastifyRequest,
    reply: FastifyReply,
    userId: string,
  ): Promise<{ csrfToken: string }> {
    const session = await auth.createSession(userId, request);
    await pool.query("UPDATE users SET last_login_at = $2 WHERE id = $1", [userId, now()]);
    void reply.header("set-cookie", cookieHeader(session.token, ABSOLUTE_MS / 1000));
    return { csrfToken: session.csrfToken };
  }

  async function register(request: FastifyRequest): Promise<object> {
    const body = registerBody.parse(request.body);
    const problem = passwordProblem(body.password, body.email);
    if (problem) throw new HttpProblem("validation_failed", problem);
    if (!consentMatches("account", body.consent))
      throw new HttpProblem("conflict", "consent_text_outdated");
    await sendBudget(request, body.email);
    const hash = await hashPassword(body.password); // always hashed so new and existing emails cost the same
    const origin = deps.origin;
    const outcome = await tx(async (client) => {
      const created = await client.query<{ id: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1,$2) ON CONFLICT (lower(email)) DO NOTHING RETURNING id::text",
        [body.email, hash],
      );
      let userId = created.rows[0]?.id;
      let kind: "new" | "pending" | "existing" = "new";
      if (userId === undefined) {
        const found = await client.query<{ id: string; status: string }>(
          "SELECT id::text, status FROM users WHERE lower(email) = $1 FOR UPDATE",
          [body.email],
        );
        const user = found.rows[0];
        if (!user) return undefined;
        userId = user.id;
        kind = user.status === "pending" ? "pending" : "existing";
        // A pending signup re-submitted by its owner replaces the password (the latest registrant wins).
        if (kind === "pending")
          await client.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, hash]);
      }
      if (kind === "existing") return { kind, userId, token: undefined };
      await client.query("DELETE FROM consents WHERE user_id = $1 AND purpose = 'account'", [
        userId,
      ]);
      await insertConsent(client, request, userId, "account", null);
      return {
        kind,
        userId,
        token: await issueToken(client, userId, "verify_email", VERIFY_TTL_MS),
      };
    });
    if (outcome) {
      if (outcome.token !== undefined)
        sendMail(
          request,
          verifyEmailMessage(body.email, `${origin}/xac-minh-email?token=${outcome.token}`),
        );
      else sendMail(request, existingAccountMessage(body.email, `${origin}/dat-lai-mat-khau`));
      await auth.audit("user.register", request, outcome.userId, { outcome: outcome.kind });
    }
    return generic();
  }

  async function verifyEmail(request: FastifyRequest, reply: FastifyReply): Promise<object> {
    const { token } = verifyBody.parse(request.body);
    const userId = await tx(async (client) => {
      const id = await consumeToken(client, token, "verify_email");
      if (id === undefined) return undefined;
      await client.query(
        "UPDATE users SET status = 'active', email_verified_at = COALESCE(email_verified_at, $2) WHERE id = $1",
        [id, now()],
      );
      return id;
    });
    if (userId === undefined) throw new HttpProblem("validation_failed", "invalid_token");
    const session = await startSession(request, reply, userId);
    await auth.audit("user.verify_email", request, userId);
    return session;
  }

  async function login(request: FastifyRequest, reply: FastifyReply): Promise<object> {
    const body = loginBody.parse(request.body);
    const ipKey = `user-ip:${auth.ipHash(request)}`;
    const mailKey = `user-mail:${hmacHex(deps.hmacKey, body.email)}`;
    const [byIp, byMail] = await Promise.all([
      auth.countEvents(ipKey, LOGIN_IP.windowMs),
      auth.countEvents(mailKey, LOGIN_MAIL.windowMs),
    ]);
    const { rows } = await pool.query<{ id: string; password_hash: string | null; status: string }>(
      "SELECT id::text, password_hash, status FROM users WHERE lower(email) = $1",
      [body.email],
    );
    const user = rows[0];
    if (byIp.n >= LOGIN_IP.max || byMail.n >= LOGIN_MAIL.max) {
      // Same 429 whether or not the account exists. Soft lock: no stored lock flag, so nobody can be locked out for good.
      const retry = Math.max(
        byIp.n >= LOGIN_IP.max ? byIp.retry : 1,
        byMail.n >= LOGIN_MAIL.max ? byMail.retry : 1,
      );
      await auth.audit("user.login_locked", request, user?.id ?? null);
      throw new HttpProblem("rate_limited", `Retry after ${String(retry)} s`, undefined, retry);
    }
    const passwordOk = await checkPasswordHash(user?.password_hash, body.password);
    if (user?.status !== "active" || !passwordOk) {
      await Promise.all([auth.recordEvent(ipKey), auth.recordEvent(mailKey)]);
      await auth.audit("user.login_failed", request, user?.id ?? null);
      throw new HttpProblem("unauthenticated", "Invalid credentials");
    }
    await Promise.all([auth.recordEvent(ipKey, true), auth.recordEvent(mailKey, true)]);
    const session = await startSession(request, reply, user.id);
    await auth.audit("user.login_success", request, user.id);
    return session;
  }

  async function requestReset(request: FastifyRequest): Promise<object> {
    const { email } = resetRequestBody.parse(request.body);
    await sendBudget(request, email);
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id::text FROM users WHERE lower(email) = $1 AND status = 'active'",
      [email],
    );
    const user = rows[0];
    if (user) {
      const token = await tx((client) =>
        issueToken(client, user.id, "reset_password", RESET_TTL_MS),
      );
      sendMail(
        request,
        resetPasswordMessage(email, `${deps.origin}/dat-lai-mat-khau?token=${token}`),
      );
      await auth.audit("user.password_reset_requested", request, user.id);
    }
    return generic();
  }

  async function confirmReset(request: FastifyRequest): Promise<object> {
    const body = resetConfirmBody.parse(request.body);
    const preview = await pool.query<{ email: string }>(
      `SELECT u.email FROM user_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_sha256 = $1 AND t.purpose = 'reset_password' AND t.used_at IS NULL AND t.expires_at > $2`,
      [sha256Hex(body.token), now()],
    );
    const email = preview.rows[0]?.email;
    if (email === undefined) throw new HttpProblem("validation_failed", "invalid_token");
    const problem = passwordProblem(body.password, email);
    if (problem) throw new HttpProblem("validation_failed", problem);
    const hash = await hashPassword(body.password);
    const userId = await tx(async (client) => {
      const id = await consumeToken(client, body.token, "reset_password");
      if (id === undefined) return undefined;
      await client.query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, hash]);
      return id;
    });
    if (userId === undefined) throw new HttpProblem("validation_failed", "invalid_token");
    await auth.revokeSessions(userId);
    await auth.audit("user.password_reset", request, userId);
    return generic();
  }

  async function changePassword(request: FastifyRequest, me: UserPrincipal): Promise<object> {
    const body = changePasswordBody.parse(request.body);
    const key = `user-pw:${auth.userRef(me.userId)}`;
    await auth.limit(key, PASSWORD_FAILS.max, PASSWORD_FAILS.windowMs);
    const { rows } = await pool.query<{ email: string; password_hash: string | null }>(
      "SELECT email, password_hash FROM users WHERE id = $1",
      [me.userId],
    );
    const user = rows[0];
    if (!user) throw new HttpProblem("unauthenticated");
    if (!(await checkPasswordHash(user.password_hash, body.currentPassword))) {
      await auth.recordEvent(key);
      throw new HttpProblem("forbidden", "Invalid credentials");
    }
    const problem = passwordProblem(body.newPassword, user.email);
    if (problem) throw new HttpProblem("validation_failed", problem);
    const hash = await hashPassword(body.newPassword);
    await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [me.userId, hash]);
    await auth.revokeSessions(me.userId, me.sessionId);
    await auth.audit("user.password_changed", request, me.userId);
    return generic();
  }

  /** Public id from the path; a malformed one is a plain 404. Queries then filter by the session's user_id (no IDOR). */
  function paramId(request: FastifyRequest): string {
    const parsed = idParam.safeParse(request.params);
    if (!parsed.success) throw new HttpProblem("not_found");
    return parsed.data.id;
  }

  async function createProfile(request: FastifyRequest, me: UserPrincipal): Promise<object> {
    const body = profileCreateBody.parse(request.body);
    const nickname = cleanNickname(body.nickname);
    if (nickname === undefined) throw new HttpProblem("validation_failed", "nickname_rejected");
    if (!consentMatches("child_progress", body.consent))
      throw new HttpProblem("conflict", "consent_text_outdated");
    const row = await tx(async (client) => {
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [me.userId]); // serializes the limit check
      const count = await client.query<{ n: string }>(
        "SELECT count(*) AS n FROM profiles WHERE user_id = $1",
        [me.userId],
      );
      if (Number(count.rows[0]?.n ?? 0) >= PROFILE_LIMIT)
        throw new HttpProblem("conflict", "profile_limit_reached");
      const inserted = await client.query<ProfileRow & { id: string }>(
        "INSERT INTO profiles (user_id, nickname, grade) VALUES ($1,$2,$3) RETURNING id::text, external_id, nickname, grade, created_at",
        [me.userId, nickname, body.grade],
      );
      const profile = inserted.rows[0];
      if (!profile) throw new HttpProblem("internal");
      await insertConsent(client, request, me.userId, "child_progress", profile.id);
      return profile;
    });
    await auth.audit("user.profile_created", request, me.userId, { grade: body.grade });
    return profileJson(row);
  }

  /** Deletes one profile of the caller (rows cascade) and records the deletion; false when it is not theirs. */
  async function deleteProfile(
    request: FastifyRequest,
    me: UserPrincipal,
    externalId: string,
  ): Promise<boolean> {
    const deleted = await tx(async (client) => {
      const result = await client.query(
        "DELETE FROM profiles WHERE external_id = $1 AND user_id = $2",
        [externalId, me.userId],
      );
      if (result.rowCount !== 1) return false;
      await client.query(
        "INSERT INTO deletion_requests (user_ref, scope, requested_at, due_at, done_at) VALUES ($1,'profile',$2,$3,$2)",
        [auth.userRef(me.userId), now(), new Date(now().getTime() + DELETE_DUE_MS)],
      );
      return true;
    });
    if (deleted) await auth.audit("user.profile_deleted", request, me.userId);
    return deleted;
  }

  async function exportData(request: FastifyRequest, me: UserPrincipal): Promise<object> {
    const key = `export:${auth.userRef(me.userId)}`;
    await auth.limit(key, EXPORT.max, EXPORT.windowMs);
    await auth.recordEvent(key);
    const q = <T extends pg.QueryResultRow>(sql: string): Promise<T[]> =>
      pool.query<T>(sql, [me.userId]).then((result) => result.rows);
    const [account, identities, profiles, consents] = await Promise.all([
      q(
        'SELECT email, email_verified_at AS "emailVerifiedAt", created_at AS "createdAt" FROM users WHERE id = $1',
      ),
      q(
        'SELECT provider, email_at_link AS "emailAtLink", created_at AS "createdAt" FROM identities WHERE user_id = $1 ORDER BY id',
      ),
      q(
        `SELECT p.external_id AS id, p.nickname, p.grade, p.created_at AS "createdAt",
                COALESCE((SELECT array_agg(a.attempt_id ORDER BY a.created_at) FROM profile_attempts a WHERE a.profile_id = p.id), '{}') AS "attemptIds",
                COALESCE((SELECT json_agg(json_build_object('slug', g.test_slug, 'best', g.best, 'last', g.last, 'total', g.total, 'at', g.played_at) ORDER BY g.test_slug) FROM profile_progress g WHERE g.profile_id = p.id), '[]') AS progress
         FROM profiles p WHERE p.user_id = $1 ORDER BY p.id`,
      ),
      q(
        `SELECT c.external_id AS id, c.purpose, p.external_id AS "profileId", c.policy_version AS "policyVersion",
                c.text_hash AS "textHash", c.given_at AS "givenAt", c.withdrawn_at AS "withdrawnAt"
         FROM consents c LEFT JOIN profiles p ON p.id = c.profile_id WHERE c.user_id = $1 ORDER BY c.id`,
      ),
    ]);
    await auth.audit("user.export", request, me.userId);
    return { exportedAt: now(), account: account[0], identities, profiles, consents };
  }

  async function deleteAccount(request: FastifyRequest, me: UserPrincipal): Promise<void> {
    const body = deleteAccountBody.parse(request.body ?? {});
    const { rows } = await pool.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [me.userId],
    );
    const hash = rows[0]?.password_hash ?? null;
    if (hash !== null) {
      // Re-authenticate before the irreversible step; wrong guesses share the password-change budget.
      const key = `user-pw:${auth.userRef(me.userId)}`;
      await auth.limit(key, PASSWORD_FAILS.max, PASSWORD_FAILS.windowMs);
      if (body.password === undefined || !(await checkPasswordHash(hash, body.password))) {
        await auth.recordEvent(key);
        throw new HttpProblem("forbidden", "Invalid credentials");
      }
    }
    await tx(async (client) => {
      await client.query(
        "INSERT INTO deletion_requests (user_ref, scope, requested_at, due_at, done_at) VALUES ($1,'account',$2,$3,$2)",
        [auth.userRef(me.userId), now(), new Date(now().getTime() + DELETE_DUE_MS)],
      );
      await client.query("DELETE FROM users WHERE id = $1", [me.userId]); // cascades to every account table
    });
    await auth.audit("user.account_deleted", request, me.userId);
  }

  return function plugin(app: FastifyInstance, _opts: unknown, done: () => void): void {
    const principals = new WeakMap<FastifyRequest, UserPrincipal>();
    const me = (request: FastifyRequest): UserPrincipal => {
      const principal = principals.get(request);
      if (!principal) throw new HttpProblem("unauthenticated");
      return principal;
    };
    // Deny by default: only routes flagged accountPublic skip the session guard (CSRF origin still applies).
    app.addHook("onRequest", async (request) => {
      if (request.routeOptions.config.accountPublic === true) {
        if (request.method !== "GET" && !auth.originOk(request)) await auth.denyCsrf(request, null);
        return;
      }
      principals.set(request, await auth.guard(request));
    });
    app.addHook("onSend", (_request, reply, payload, finish) => {
      void reply.header("cache-control", "no-store");
      finish(null, payload);
    });
    const open = (max: number) => ({
      config: { accountPublic: true, rateLimit: { max, timeWindow: "1 minute" } },
    });

    app.get("/consent-texts", { config: { accountPublic: true } }, () => ({
      policyVersion: POLICY_VERSION,
      texts: CONSENT_TEXTS,
    }));
    app.post("/register", open(10), async (request, reply) =>
      reply.code(202).send(await register(request)),
    );
    app.post("/verify-email", open(10), (request, reply) => verifyEmail(request, reply));
    app.post("/login", open(10), (request, reply) => login(request, reply));
    app.post("/password-reset/request", open(10), async (request, reply) =>
      reply.code(202).send(await requestReset(request)),
    );
    app.post("/password-reset/confirm", open(10), (request) => confirmReset(request));

    app.post("/logout", async (request, reply) => {
      const p = me(request);
      await pool.query("UPDATE user_sessions SET revoked_at = $2 WHERE id = $1", [
        p.sessionId,
        now(),
      ]);
      await auth.audit("user.logout", request, p.userId);
      void reply.header("set-cookie", cookieHeader("", 0));
      return generic();
    });
    app.post("/logout-all", async (request, reply) => {
      const p = me(request);
      await auth.revokeSessions(p.userId);
      await auth.audit("user.logout_all", request, p.userId);
      void reply.header("set-cookie", cookieHeader("", 0));
      return generic();
    });
    app.get("/me", async (request) => {
      const p = me(request);
      const { rows } = await pool.query<{
        email: string;
        has_password: boolean;
        google: boolean;
        profiles: string;
      }>(
        `SELECT u.email, u.password_hash IS NOT NULL AS has_password,
                EXISTS (SELECT 1 FROM identities i WHERE i.user_id = u.id AND i.provider = 'google') AS google,
                (SELECT count(*) FROM profiles WHERE user_id = u.id) AS profiles
         FROM users u WHERE u.id = $1`,
        [p.userId],
      );
      const row = rows[0];
      if (!row) throw new HttpProblem("unauthenticated");
      return {
        email: row.email,
        hasPassword: row.has_password,
        googleLinked: row.google,
        profileCount: Number(row.profiles),
        profileLimit: PROFILE_LIMIT,
        csrfToken: p.csrfSecret,
      };
    });
    app.post("/password", (request) => changePassword(request, me(request)));

    app.get("/profiles", async (request) => {
      const { rows } = await pool.query<ProfileRow>(
        "SELECT external_id, nickname, grade, created_at FROM profiles WHERE user_id = $1 ORDER BY id",
        [me(request).userId],
      );
      return { items: rows.map(profileJson) };
    });
    app.post("/profiles", async (request, reply) =>
      reply.code(201).send(await createProfile(request, me(request))),
    );
    app.patch("/profiles/:id", async (request) => {
      const p = me(request);
      const id = paramId(request);
      const body = profileUpdateBody.parse(request.body);
      const nickname = body.nickname === undefined ? undefined : cleanNickname(body.nickname);
      if (body.nickname !== undefined && nickname === undefined)
        throw new HttpProblem("validation_failed", "nickname_rejected");
      const { rows } = await pool.query<ProfileRow>(
        `UPDATE profiles SET nickname = COALESCE($3, nickname), grade = COALESCE($4, grade)
         WHERE external_id = $1 AND user_id = $2 RETURNING external_id, nickname, grade, created_at`,
        [id, p.userId, nickname ?? null, body.grade ?? null],
      );
      const row = rows[0];
      if (!row) throw new HttpProblem("not_found");
      await auth.audit("user.profile_updated", request, p.userId);
      return profileJson(row);
    });
    app.delete("/profiles/:id", async (request, reply) => {
      if (!(await deleteProfile(request, me(request), paramId(request))))
        throw new HttpProblem("not_found");
      return reply.code(204).send();
    });

    // Parent-confirmed import of the child's browser progress; keeps the better score per test.
    app.post("/profiles/:id/progress", async (request) => {
      const p = me(request);
      const id = paramId(request);
      const { items } = progressImportBody.parse(request.body);
      const owned = await pool.query<{ id: string }>(
        "SELECT id FROM profiles WHERE external_id = $1 AND user_id = $2",
        [id, p.userId],
      );
      const profileId = owned.rows[0]?.id;
      if (profileId === undefined) throw new HttpProblem("not_found");
      await pool.query(
        `INSERT INTO profile_progress (profile_id, test_slug, best, last, total, played_at)
         SELECT $1, s, b, l, t, a::timestamptz
         FROM unnest($2::text[], $3::int[], $4::int[], $5::int[], $6::text[]) AS x(s, b, l, t, a)
         ON CONFLICT (profile_id, test_slug) DO UPDATE SET
           best = CASE WHEN EXCLUDED.total = profile_progress.total THEN GREATEST(profile_progress.best, EXCLUDED.best) ELSE EXCLUDED.best END,
           last = EXCLUDED.last, total = EXCLUDED.total, played_at = EXCLUDED.played_at
         WHERE EXCLUDED.played_at >= profile_progress.played_at`,
        [
          profileId,
          items.map((i) => i.slug),
          items.map((i) => i.best),
          items.map((i) => i.last),
          items.map((i) => i.total),
          items.map((i) => i.at),
        ],
      );
      await auth.audit("user.progress_imported", request, p.userId);
      return { imported: items.length };
    });

    app.get("/consents", async (request) => {
      const { rows } = await pool.query(
        `SELECT c.external_id AS id, c.purpose, p.external_id AS "profileId", c.policy_version AS "policyVersion",
                c.given_at AS "givenAt", c.withdrawn_at AS "withdrawnAt"
         FROM consents c LEFT JOIN profiles p ON p.id = c.profile_id WHERE c.user_id = $1 ORDER BY c.id`,
        [me(request).userId],
      );
      return { items: rows };
    });
    app.post("/consents/:id/withdraw", async (request, reply) => {
      const p = me(request);
      const id = paramId(request);
      const { rows } = await pool.query<{ purpose: string; profile_external_id: string | null }>(
        `SELECT c.purpose, pr.external_id AS profile_external_id FROM consents c
         LEFT JOIN profiles pr ON pr.id = c.profile_id WHERE c.external_id = $1 AND c.user_id = $2`,
        [id, p.userId],
      );
      const consent = rows[0];
      if (!consent) throw new HttpProblem("not_found");
      const purpose = consent.purpose as ConsentPurpose;
      if (
        !CONSENT_PURPOSES.includes(purpose) ||
        purpose === "account" ||
        !consent.profile_external_id
      )
        throw new HttpProblem("conflict", "delete_account_instead");
      // Withdrawing the child's consent stops processing: the profile and its data are deleted.
      await deleteProfile(request, p, consent.profile_external_id);
      await auth.audit("user.consent_withdrawn", request, p.userId, { purpose });
      return reply.code(204).send();
    });

    app.get("/export", async (request, reply) => {
      const data = await exportData(request, me(request));
      void reply.header("content-disposition", 'attachment; filename="beejunior-du-lieu.json"');
      return data;
    });
    app.delete("/account", async (request, reply) => {
      await deleteAccount(request, me(request));
      void reply.header("set-cookie", cookieHeader("", 0));
      return reply.code(204).send();
    });
    done();
  };
}
