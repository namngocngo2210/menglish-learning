import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { PublicReader } from "@bj/data";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { USER_COOKIE } from "../src/accounts/auth";
import { CONSENT_TEXTS, POLICY_VERSION } from "../src/accounts/consent-texts";
import { createMemoryMailer } from "../src/accounts/mailer";
import type { Mailer } from "../src/accounts/mailer";
import { PUBLIC_ROUTES } from "../src/accounts/routes";
import { COOKIE as ADMIN_COOKIE } from "../src/admin/auth";
import { createAdmin } from "../src/admin/create";
import { ACCOUNT_OPERATIONS } from "../src/server/account-openapi";
import { buildApp, loggerOptions } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { ADMIN_URL, createMigratedDb, uname } from "./helpers";
import type { TestDb } from "./helpers";

const ORIGIN = "https://site.example.test";
const ADMIN_ORIGIN = "https://admin.example.test";
const PW = "correct-horse-battery-9";
const A = "/api/v1/account";
const USER_KEY = "u".repeat(48);
const ADMIN_KEY = "a".repeat(48);
const consent = (purpose: "account" | "child_progress") => ({
  policyVersion: POLICY_VERSION,
  textHash: CONSENT_TEXTS[purpose].textHash,
});

interface Session {
  email: string;
  cookie: string;
  csrf: string;
  ip: string;
}

describe.skipIf(ADMIN_URL === undefined)("parent accounts (PostgreSQL)", () => {
  let db: TestDb;
  let pool: pg.Pool;
  let built: BuiltApp;
  let off: BuiltApp;
  let clock = new Date();
  let logs = "";
  let n = 0;
  const mailer = createMemoryMailer();
  let failingMail = false;
  const switchable: Mailer = {
    send: (m) => (failingMail ? Promise.reject(new Error("smtp down")) : mailer.send(m)),
  };
  const sink = new Writable({
    write(chunk: Buffer, _enc, done) {
      logs += chunk.toString();
      done();
    },
  });

  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 6 });
    const common = {
      reader: {} as PublicReader,
      internalToken: undefined,
      rateLimitPerMinute: 100_000,
      trustProxy: true,
      logger: { ...loggerOptions("trace"), stream: sink },
      cms: { pool, salt: "s".repeat(32) },
      auth: {
        pool,
        hmacKey: ADMIN_KEY,
        totpKey: Buffer.alloc(32, 5),
        origin: ADMIN_ORIGIN,
        now: () => clock,
      },
    };
    built = await buildApp({
      ...common,
      accounts: { pool, hmacKey: USER_KEY, origin: ORIGIN, mailer: switchable, now: () => clock },
    });
    off = await buildApp({ ...common, logger: false });
  }, 120_000);

  afterAll(async () => {
    await built.app.close();
    await off.app.close();
    await pool.end();
    await db.remove();
  });

  beforeEach(async () => {
    clock = new Date();
    logs = "";
    failingMail = false;
    mailer.outbox.length = 0;
    await pool.query(
      `TRUNCATE users, user_sessions, login_attempts, audit_log, deletion_requests,
                admin_users, admin_sessions RESTART IDENTITY CASCADE`,
    );
  });

  const ip = (): string => {
    n += 1;
    return `10.${String(Math.floor(n / 250))}.${String(n % 250)}.1`;
  };
  const jsonHeaders = (
    from: string,
    extra: Record<string, string> = {},
  ): Record<string, string> => ({
    "content-type": "application/json",
    origin: ORIGIN,
    "x-forwarded-for": from,
    ...extra,
  });
  const post = (path: string, payload: unknown, from = ip(), extra: Record<string, string> = {}) =>
    built.app.inject({
      method: "POST",
      url: `${A}${path}`,
      payload: payload as object,
      headers: jsonHeaders(from, extra),
    });
  const authed = (
    s: Session,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    payload?: unknown,
  ) =>
    built.app.inject({
      method,
      url: `${A}${path}`,
      headers: {
        cookie: s.cookie,
        "x-csrf-token": s.csrf,
        origin: ORIGIN,
        "x-forwarded-for": s.ip,
        ...(payload === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });

  const registerBody = (email: string, password = PW) => ({
    username: uname(email),
    email,
    password,
    adult: true,
    consent: consent("account"),
  });
  const tokenOf = (email: string): string => {
    const msg = mailer.outbox.filter((m) => m.to === email).at(-1);
    return /token=([\w-]+)/.exec(msg?.text ?? "")?.[1] ?? "";
  };
  const cookieOf = (res: { headers: Record<string, unknown> }): string =>
    String(res.headers["set-cookie"]).split(";")[0] ?? "";

  async function signup(email = `parent${String((n += 1))}@example.test`): Promise<Session> {
    const from = ip();
    const res = await post("/register", registerBody(email), from);
    expect(res.statusCode).toBe(201);
    expect((await post("/verify-email", { token: tokenOf(email) }, from)).statusCode).toBe(200);
    return {
      email,
      cookie: cookieOf(res),
      csrf: res.json<{ csrfToken: string }>().csrfToken,
      ip: from,
    };
  }
  const login = async (email: string, password = PW, from = ip()): Promise<Session> => {
    const res = await post("/login", { username: uname(email), password }, from);
    expect(res.statusCode).toBe(200);
    return {
      email,
      cookie: cookieOf(res),
      csrf: res.json<{ csrfToken: string }>().csrfToken,
      ip: from,
    };
  };
  const addProfile = (s: Session, nickname = "Bông Sen", grade = 6) =>
    authed(s, "POST", "/profiles", { nickname, grade, consent: consent("child_progress") });
  const audits = async (): Promise<string[]> =>
    (await pool.query<{ action: string }>("SELECT action FROM audit_log ORDER BY id")).rows.map(
      (r) => r.action,
    );
  const strip = (r: { json: () => object }): object => ({ ...r.json(), request_id: 0 });

  describe("feature flag", () => {
    it("registers no account route and documents none when accounts are not configured", async () => {
      const res = await off.app.inject({ method: "POST", url: `${A}/register`, payload: {} });
      expect(res.statusCode).toBe(404);
      expect((await off.app.inject(`${A}/consent-texts`)).statusCode).toBe(404);
      expect(off.routes.filter((r) => r.includes("/account"))).toEqual([]);
      const doc = (await off.app.inject("/api/v1/openapi.json")).json<{ paths: object }>();
      expect(Object.keys(doc.paths).filter((p) => p.includes("/account"))).toEqual([]);
    });
  });

  describe("route inventory", () => {
    const accountRoutes = (): string[] =>
      built.routes.filter((r) => r.includes(`${A}/`) && !r.startsWith("HEAD "));

    it("guards every account route except the pinned public list (deny by default)", async () => {
      expect(accountRoutes().length).toBeGreaterThan(15);
      for (const route of PUBLIC_ROUTES) expect(accountRoutes()).toContain(route);
      for (const route of accountRoutes().filter((r) => !PUBLIC_ROUTES.includes(r))) {
        const [method, url] = route.split(" ") as [string, string];
        const res = await built.app.inject({
          method: method as "GET",
          url: url.replace(":id", "00000000-0000-4000-8000-000000000000"),
          headers: { origin: ORIGIN, "x-forwarded-for": ip() },
        });
        expect(res.statusCode, route).toBe(401);
        expect(res.json<{ code: string }>().code).toBe("unauthenticated");
      }
    });

    it("keeps the OpenAPI operations equal to the real route table", () => {
      const documented = ACCOUNT_OPERATIONS.map(
        (o) => `${o.method.toUpperCase()} ${o.path.replace(/\{id\}/g, ":id")}`,
      ).sort();
      expect(accountRoutes().sort()).toEqual(documented);
    });

    it("serves the account operations in the document when enabled", async () => {
      const doc = (await built.app.inject("/api/v1/openapi.json")).json<{
        paths: Record<string, object>;
        components: { securitySchemes: Record<string, unknown> };
      }>();
      expect(Object.keys(doc.paths)).toContain(`${A}/register`);
      expect(doc.components.securitySchemes["userSession"]).toBeDefined();
      const committed: unknown = JSON.parse(
        readFileSync(
          fileURLToPath(new URL("../openapi.accounts.v1.json", import.meta.url)),
          "utf8",
        ),
      );
      expect(committed).toEqual(doc);
    });
  });

  describe("registration and verification", () => {
    it("registers, verifies by email, logs in with a Lax host-only cookie and stores only hashes", async () => {
      const email = "mom@example.test";
      const from = ip();
      const reg = await post("/register", registerBody(email), from);
      expect(reg.statusCode).toBe(201);
      expect(reg.headers["cache-control"]).toBe("no-store");
      expect(reg.json<{ recoveryCodes: string[] }>().recoveryCodes).toHaveLength(10);
      expect(mailer.outbox).toHaveLength(1);
      expect(mailer.outbox[0]?.subject).toContain("Xác minh");
      const token = tokenOf(email);
      // unverified email: nothing is stored on the account yet
      expect(await pool.query("SELECT 1 FROM users WHERE email IS NOT NULL")).toHaveProperty(
        "rowCount",
        0,
      );
      const res = await post("/verify-email", { token }, from);
      expect(res.statusCode).toBe(200);
      const cookie = String(reg.headers["set-cookie"]);
      expect(cookie).toMatch(new RegExp(`^${USER_COOKIE}=[A-Za-z0-9_-]{43};`));
      for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
        expect(cookie).toContain(attr);
      expect(cookie).not.toContain("Domain");
      expect(cookie).not.toContain(ADMIN_COOKIE);
      const rawSession = cookie.split(";")[0]?.split("=")[1] ?? "";
      const sessions = await pool.query<{ id: string }>("SELECT id FROM user_sessions");
      expect(sessions.rows.map((r) => r.id)).toEqual([
        createHash("sha256").update(rawSession).digest("hex"),
      ]);
      const tokens = await pool.query<{ token_sha256: string; used_at: Date | null }>(
        "SELECT * FROM user_tokens",
      );
      expect(tokens.rows[0]?.token_sha256).toBe(createHash("sha256").update(token).digest("hex"));
      expect(tokens.rows[0]?.used_at).not.toBeNull();
      const row = await pool.query<{ status: string; password_hash: string }>(
        "SELECT status, password_hash FROM users",
      );
      expect(row.rows[0]?.status).toBe("active");
      expect(row.rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
      const consents = await pool.query<{
        purpose: string;
        policy_version: string;
        text_hash: string;
      }>("SELECT purpose, policy_version, text_hash FROM consents");
      expect(consents.rows).toEqual([
        {
          purpose: "account",
          policy_version: POLICY_VERSION,
          text_hash: CONSENT_TEXTS.account.textHash,
        },
      ]);
      const s: Session = {
        email,
        cookie: cookieOf(reg),
        csrf: reg.json<{ csrfToken: string }>().csrfToken,
        ip: from,
      };
      expect((await authed(s, "GET", "/me")).json()).toMatchObject({
        username: uname(email),
        emailVerified: true,
        recoveryCodesLeft: 10,
        email,
        hasPassword: true,
        googleLinked: false,
        profileCount: 0,
        profileLimit: 5,
      });
    });

    it("refuses a verification token that is reused, unknown or expired", async () => {
      const email = "late@example.test";
      await post("/register", registerBody(email));
      const token = tokenOf(email);
      expect((await post("/verify-email", { token: "x".repeat(43) })).statusCode).toBe(422);
      clock = new Date(clock.getTime() + 25 * 3600_000);
      expect((await post("/verify-email", { token })).statusCode).toBe(422);
      clock = new Date();
      expect((await post("/verify-email", { token })).statusCode).toBe(200);
      expect((await post("/verify-email", { token })).statusCode).toBe(422);
    });

    it("rejects weak passwords, a missing adult tick and a stale consent text", async () => {
      const email = "weak@example.test";
      for (const password of ["short", "password123", "1111111111", email, "x".repeat(129)]) {
        const res = await post("/register", registerBody(email, password));
        expect(res.statusCode, password).toBe(422);
      }
      expect((await post("/register", { ...registerBody(email), adult: false })).statusCode).toBe(
        422,
      );
      const stale = { ...registerBody(email), consent: { policyVersion: "old", textHash: "x" } };
      const res = await post("/register", stale);
      expect(res.statusCode).toBe(409);
      expect(res.json<{ detail: string }>().detail).toBe("consent_text_outdated");
      expect(mailer.outbox).toHaveLength(0);
    });

    it("never reveals through register whether an email is already registered", async () => {
      await signup("same@example.test");
      mailer.outbox.length = 0;
      const dup = await post("/register", {
        ...registerBody("other@example.test"),
        email: "same@example.test",
      });
      expect(dup.statusCode).toBe(201);
      expect(dup.json<object>()).toMatchObject({ emailPending: true });
      const notice = mailer.outbox.filter((m) => m.to === "same@example.test").at(-1);
      expect(notice?.subject).toContain("đã có tài khoản");
      expect(notice?.text).not.toContain("token=");
      expect(
        await pool.query("SELECT 1 FROM users WHERE email = 'same@example.test'"),
      ).toHaveProperty("rowCount", 1);
    });

    it("answers a taken username with 409 and never overwrites the existing account", async () => {
      await signup("taken@example.test");
      const res = await post("/register", { ...registerBody("x@example.test"), username: "TAKEN" });
      expect(res.statusCode).toBe(409);
      expect(res.json<{ detail: string }>().detail).toBe("username_taken");
      expect((await login("taken@example.test")).email).toBe("taken@example.test");
    });

    it("lets a later verification link replace the pending one", async () => {
      const email = "again@example.test";
      const s = await signup("again2@example.test");
      await authed(s, "POST", "/email", { email });
      const oldToken = tokenOf(email);
      await authed(s, "POST", "/email", { email });
      expect((await post("/verify-email", { token: oldToken })).statusCode).toBe(422);
      expect((await post("/verify-email", { token: tokenOf(email) })).statusCode).toBe(200);
      expect((await authed(s, "GET", "/me")).json()).toMatchObject({ email, emailVerified: true });
    });

    it("limits verification mail per address and per IP, and survives a mail outage silently", async () => {
      const email = "spam@example.test";
      const s = await signup("spamer@example.test");
      for (let i = 0; i < 3; i++)
        expect((await authed(s, "POST", "/email", { email })).statusCode).toBe(202);
      const blocked = await authed(s, "POST", "/email", { email });
      expect(blocked.statusCode).toBe(429);
      expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
      failingMail = true;
      const res = await post("/register", registerBody("down@example.test"));
      expect(res.statusCode).toBe(201);
      await new Promise((resolve) => setImmediate(resolve));
      expect(logs).toContain("mail_send_failed");
      expect(logs).not.toContain("down@example.test");
    });
  });

  describe("login, sessions and CSRF", () => {
    it("answers wrong password, unknown username and an email used as username identically", async () => {
      await signup("real@example.test");
      const wrong = await post("/login", {
        username: uname("real@example.test"),
        password: "nope-nope-nope",
      });
      const unknown = await post("/login", {
        username: uname("ghost@example.test"),
        password: "nope-nope-nope",
      });
      const unverified = await post("/login", { username: "real@example.test", password: PW });
      for (const r of [wrong, unknown, unverified]) {
        expect(r.statusCode).toBe(401);
        expect(r.headers["set-cookie"]).toBeUndefined();
        expect(strip(r)).toEqual(strip(wrong));
      }
    });

    it("throttles by IP (5/15 min) and by address (10/h) with Retry-After, then recovers", async () => {
      await signup("rate@example.test");
      const from = ip();
      for (let i = 0; i < 5; i++)
        expect(
          (
            await post(
              "/login",
              { username: uname("rate@example.test"), password: "bad-bad-bad-1" },
              from,
            )
          ).statusCode,
        ).toBe(401);
      const locked = await post(
        "/login",
        { username: uname("rate@example.test"), password: PW },
        from,
      );
      expect(locked.statusCode).toBe(429);
      expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
      clock = new Date(clock.getTime() + 16 * 60_000);
      expect(
        (await post("/login", { username: uname("rate@example.test"), password: PW }, from))
          .statusCode,
      ).toBe(200);

      for (let i = 0; i < 10; i++)
        await post(
          "/login",
          { username: uname("rate@example.test"), password: "bad-bad-bad-1" },
          ip(),
        );
      const byMail = await post("/login", { username: uname("rate@example.test"), password: PW });
      expect(byMail.statusCode).toBe(429);
      const ghost = await post("/login", { username: uname("ghost2@example.test"), password: "x" });
      expect(ghost.statusCode).toBe(401); // same limiter keys exist for unknown emails, only after failures
      expect(await audits()).toContain("user.login_locked");
    });

    it("rotates the session on login (old token revoked, never reused) and logs out only this session", async () => {
      const s1 = await signup("rot@example.test");
      const relog = await post("/login", { username: uname(s1.email), password: PW }, ip(), {
        cookie: s1.cookie,
      });
      const s2: Session = {
        ...s1,
        cookie: cookieOf(relog),
        csrf: relog.json<{ csrfToken: string }>().csrfToken,
      };
      expect(s2.cookie).not.toBe(s1.cookie);
      expect((await authed(s1, "GET", "/me")).statusCode).toBe(401);
      const s3 = await login(s1.email);
      expect((await authed(s2, "POST", "/logout")).statusCode).toBe(200);
      expect((await authed(s2, "GET", "/me")).statusCode).toBe(401);
      expect((await authed(s3, "GET", "/me")).statusCode).toBe(200);
      const rotated = await pool.query(
        "SELECT 1 FROM user_sessions WHERE rotated_from IS NOT NULL",
      );
      expect(rotated.rowCount).toBe(1);
    });

    it("logs out every session with logout-all", async () => {
      const a = await signup("all@example.test");
      const b = await login(a.email);
      expect((await authed(a, "POST", "/logout-all")).statusCode).toBe(200);
      expect((await authed(a, "GET", "/me")).statusCode).toBe(401);
      expect((await authed(b, "GET", "/me")).statusCode).toBe(401);
      expect(await audits()).toContain("user.logout_all");
    });

    it("expires sessions after 7 idle days and 30 absolute days, sliding on use", async () => {
      const s = await signup("exp@example.test");
      clock = new Date(clock.getTime() + 6 * 24 * 3600_000);
      expect((await authed(s, "GET", "/me")).statusCode).toBe(200);
      clock = new Date(clock.getTime() + 6 * 24 * 3600_000); // 12 days total, 6 idle: still valid
      expect((await authed(s, "GET", "/me")).statusCode).toBe(200);
      const idle = await signup("idle@example.test");
      clock = new Date(clock.getTime() + 8 * 24 * 3600_000);
      expect((await authed(idle, "GET", "/me")).statusCode).toBe(401);
      const long = await login("exp@example.test");
      for (let day = 0; day < 5; day++) {
        clock = new Date(clock.getTime() + 6 * 24 * 3600_000);
        const res = await authed(long, "GET", "/me");
        expect(res.statusCode, `day ${String(day * 6 + 6)}`).toBe(day < 4 ? 200 : 401);
      }
    });

    it("requires Origin, Sec-Fetch-Site and the CSRF token on state-changing requests", async () => {
      const s = await signup("csrf@example.test");
      const bare = (headers: Record<string, string>) =>
        built.app.inject({
          method: "POST",
          url: `${A}/logout`,
          headers: { cookie: s.cookie, "x-forwarded-for": s.ip, ...headers },
        });
      expect((await bare({ origin: ORIGIN })).statusCode).toBe(403); // no token
      expect((await bare({ origin: ORIGIN, "x-csrf-token": "wrong" })).statusCode).toBe(403);
      expect((await bare({ origin: "https://evil.test", "x-csrf-token": s.csrf })).statusCode).toBe(
        403,
      );
      expect(
        (await bare({ origin: ORIGIN, "sec-fetch-site": "cross-site", "x-csrf-token": s.csrf }))
          .statusCode,
      ).toBe(403);
      const publicCross = await post("/login", { username: uname(s.email), password: PW }, ip(), {
        origin: "https://evil.test",
      });
      expect(publicCross.statusCode).toBe(403);
      expect((await authed(s, "GET", "/me")).statusCode).toBe(200); // still alive: denial did not log out
      expect(await audits()).toContain("user.csrf_denied");
      expect((await bare({ origin: ORIGIN, "x-csrf-token": s.csrf })).statusCode).toBe(200);
    });
  });

  describe("passwords", () => {
    it("resets via a one-time emailed token, revokes every session and rejects the old password", async () => {
      const s = await signup("reset@example.test");
      const known = await post("/password-reset/request", { email: s.email });
      const unknown = await post("/password-reset/request", { email: "nobody@example.test" });
      expect(known.statusCode).toBe(202);
      expect(strip(known)).toEqual(strip(unknown));
      expect(mailer.outbox.filter((m) => m.to === "nobody@example.test")).toHaveLength(0);
      const token = tokenOf(s.email);
      expect((await post("/password-reset/confirm", { token, password: "short" })).statusCode).toBe(
        422,
      );
      expect(
        (await post("/password-reset/confirm", { token, password: "brand-new-password-1" }))
          .statusCode,
      ).toBe(200);
      expect(
        (await post("/password-reset/confirm", { token, password: "another-password-22" }))
          .statusCode,
      ).toBe(422);
      expect((await authed(s, "GET", "/me")).statusCode).toBe(401);
      expect((await post("/login", { username: uname(s.email), password: PW })).statusCode).toBe(
        401,
      );
      expect(
        (await post("/login", { username: uname(s.email), password: "brand-new-password-1" }))
          .statusCode,
      ).toBe(200);
      expect(await audits()).toContain("user.password_reset");
    });

    it("expires reset tokens after one hour and does not mail unverified accounts", async () => {
      const s = await signup("exp2@example.test");
      await post("/password-reset/request", { email: s.email });
      const token = tokenOf(s.email);
      clock = new Date(clock.getTime() + 61 * 60_000);
      expect(
        (await post("/password-reset/confirm", { token, password: "brand-new-password-1" }))
          .statusCode,
      ).toBe(422);
      await post("/register", registerBody("pend@example.test"));
      mailer.outbox.length = 0;
      await post("/password-reset/request", { email: "pend@example.test" });
      expect(mailer.outbox).toHaveLength(0);
    });

    it("changes the password after checking the current one and keeps only this session", async () => {
      const a = await signup("chg@example.test");
      const b = await login(a.email);
      const wrong = await authed(a, "POST", "/password", {
        currentPassword: "nope-nope-nope",
        newPassword: "brand-new-password-1",
      });
      expect(wrong.statusCode).toBe(403);
      const weak = await authed(a, "POST", "/password", {
        currentPassword: PW,
        newPassword: "short",
      });
      expect(weak.statusCode).toBe(422);
      const ok = await authed(a, "POST", "/password", {
        currentPassword: PW,
        newPassword: "brand-new-password-1",
      });
      expect(ok.statusCode).toBe(200);
      expect((await authed(a, "GET", "/me")).statusCode).toBe(200);
      expect((await authed(b, "GET", "/me")).statusCode).toBe(401);
    });
  });

  describe("child profiles and consent", () => {
    it("creates a profile only with the exact consent text and records it per purpose", async () => {
      const s = await signup("kid@example.test");
      const stale = await authed(s, "POST", "/profiles", {
        nickname: "Bông Sen",
        grade: 7,
        consent: { policyVersion: POLICY_VERSION, textHash: "0".repeat(64) },
      });
      expect(stale.statusCode).toBe(409);
      expect(
        (await authed(s, "POST", "/profiles", { nickname: "Bông Sen", grade: 7 })).statusCode,
      ).toBe(422);
      const created = await addProfile(s, "Bông Sen", 7);
      expect(created.statusCode).toBe(201);
      const profile = created.json<{ id: string; nickname: string; grade: number }>();
      expect(profile).toMatchObject({ nickname: "Bông Sen", grade: 7 });
      expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
      const list = await authed(s, "GET", "/consents");
      expect(list.json<{ items: object[] }>().items).toEqual([
        expect.objectContaining({ purpose: "account", profileId: null }),
        expect.objectContaining({
          purpose: "child_progress",
          profileId: profile.id,
          policyVersion: POLICY_VERSION,
        }),
      ]);
      const upd = await authed(s, "PATCH", `/profiles/${profile.id}`, { grade: 8 });
      expect(upd.json()).toMatchObject({ nickname: "Bông Sen", grade: 8 });
      expect((await authed(s, "PATCH", `/profiles/${profile.id}`, {})).statusCode).toBe(422);
    });

    it("rejects nicknames that are blocked, too short or carry contact data", async () => {
      const s = await signup("nick@example.test");
      for (const nickname of [
        "a",
        "x".repeat(21),
        "fuck you",
        "zalo 0912",
        "0912345678",
        "<b>hi</b>",
        "   ",
      ]) {
        const res = await addProfile(s, nickname);
        expect(res.statusCode, nickname).toBe(422);
      }
      expect((await addProfile(s, "Long")).statusCode).toBe(201);
    });

    it("allows at most 5 profiles even when created concurrently", async () => {
      const s = await signup("five@example.test");
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => addProfile(s, `Bé số ${String(i)}`)),
      );
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(5);
      expect(results.filter((r) => r.statusCode === 409)).toHaveLength(3);
      expect((await pool.query("SELECT 1 FROM profiles")).rowCount).toBe(5);
    });

    it("blocks reading, changing, deleting or withdrawing another parent's profile (IDOR)", async () => {
      const a = await signup("mum@example.test");
      const b = await signup("intruder@example.test");
      const profile = (await addProfile(a)).json<{ id: string }>();
      const consentId =
        (await authed(a, "GET", "/consents"))
          .json<{ items: { id: string; profileId: string | null }[] }>()
          .items.find((c) => c.profileId)?.id ?? "";
      expect((await authed(b, "GET", "/profiles")).json<{ items: object[] }>().items).toEqual([]);
      expect(
        (await authed(b, "PATCH", `/profiles/${profile.id}`, { nickname: "Hacked" })).statusCode,
      ).toBe(404);
      expect((await authed(b, "DELETE", `/profiles/${profile.id}`)).statusCode).toBe(404);
      expect((await authed(b, "POST", `/consents/${consentId}/withdraw`)).statusCode).toBe(404);
      expect((await authed(b, "DELETE", "/profiles/not-a-uuid")).statusCode).toBe(404);
      expect((await pool.query("SELECT nickname FROM profiles")).rows).toEqual([
        { nickname: "Bông Sen" },
      ]);
    });

    it("deletes a profile with its data and proof, and withdrawing child consent deletes the profile", async () => {
      const s = await signup("del@example.test");
      const p1 = (await addProfile(s, "Một")).json<{ id: string }>();
      const p2 = (await addProfile(s, "Hai")).json<{ id: string }>();
      await pool.query(
        "INSERT INTO profile_attempts (profile_id, attempt_id) SELECT id, 'attempt-0001' FROM profiles",
      );
      expect((await authed(s, "DELETE", `/profiles/${p1.id}`)).statusCode).toBe(204);
      expect((await pool.query("SELECT 1 FROM profile_attempts")).rowCount).toBe(1);
      const items = (await authed(s, "GET", "/consents")).json<{
        items: { id: string; profileId: string | null }[];
      }>().items;
      expect(items).toHaveLength(2); // account + Hai
      const hai = items.find((c) => c.profileId === p2.id);
      expect((await authed(s, "POST", `/consents/${hai?.id ?? ""}/withdraw`)).statusCode).toBe(204);
      expect((await pool.query("SELECT 1 FROM profiles")).rowCount).toBe(0);
      expect((await pool.query("SELECT 1 FROM profile_attempts")).rowCount).toBe(0);
      const account = items.find((c) => c.profileId === null);
      expect((await authed(s, "POST", `/consents/${account?.id ?? ""}/withdraw`)).statusCode).toBe(
        409,
      );
      const proofs = await pool.query<{ scope: string; user_ref: string; done_at: Date }>(
        "SELECT * FROM deletion_requests",
      );
      expect(proofs.rows.map((r) => r.scope)).toEqual(["profile", "profile"]);
      expect(
        proofs.rows.every((r) => r.done_at instanceof Date && !r.user_ref.includes("del@")),
      ).toBe(true);
    });
  });

  describe("progress import", () => {
    const item = (slug: string, best: number, last: number, at = "2026-11-01T10:00:00.000Z") => ({
      slug,
      best,
      last,
      total: 10,
      at,
    });

    it("imports the caller's local progress, keeps the better score, exports it and rejects other parents", async () => {
      const a = await signup("prog-a@example.test");
      const b = await signup("prog-b@example.test");
      const profile = (await addProfile(a)).json<{ id: string }>();
      const path = `/profiles/${profile.id}/progress`;
      expect((await authed(a, "POST", path, { items: [item("t1", 7, 5)] })).json()).toEqual({
        imported: 1,
      });
      await authed(a, "POST", path, {
        items: [item("t1", 6, 6, "2026-11-02T10:00:00.000Z"), item("t2", 3, 3)],
      });
      const rows = (
        await pool.query("SELECT test_slug, best, last FROM profile_progress ORDER BY test_slug")
      ).rows;
      expect(rows).toEqual([
        { test_slug: "t1", best: 7, last: 6 },
        { test_slug: "t2", best: 3, last: 3 },
      ]);
      const exported = (await authed(a, "GET", "/export")).json<{
        profiles: { progress: { slug: string }[] }[];
      }>();
      expect(exported.profiles[0]?.progress.map((p) => p.slug)).toEqual(["t1", "t2"]);
      expect((await authed(b, "POST", path, { items: [item("t9", 1, 1)] })).statusCode).toBe(404);
      expect((await authed(a, "POST", path, { items: [item("t1", 99, 5)] })).statusCode).toBe(422);
      expect((await authed(a, "POST", path, { items: [] })).statusCode).toBe(422);
      expect((await authed(a, "DELETE", `/profiles/${profile.id}`)).statusCode).toBe(204);
      expect((await pool.query("SELECT 1 FROM profile_progress")).rowCount).toBe(0);
    });
  });

  describe("export and account deletion", () => {
    it("exports only the caller's data, without secrets, and rate limits the export", async () => {
      const a = await signup("exp-a@example.test");
      const b = await signup("exp-b@example.test");
      await addProfile(a, "Của A");
      await addProfile(b, "Của B");
      const res = await authed(a, "GET", "/export");
      expect(res.statusCode).toBe(200);
      expect(String(res.headers["content-disposition"])).toContain("attachment");
      const data = res.json<{
        account: { email: string };
        profiles: { nickname: string; attemptIds: string[] }[];
        consents: unknown[];
      }>();
      expect(data.account.email).toBe("exp-a@example.test");
      expect(data.profiles).toEqual([
        expect.objectContaining({ nickname: "Của A", attemptIds: [] }),
      ]);
      expect(data.consents).toHaveLength(2);
      const text = res.body;
      expect(text).not.toContain("argon2");
      expect(text).not.toContain("Của B");
      expect(text).not.toContain("exp-b@");
      await authed(a, "GET", "/export");
      await authed(a, "GET", "/export");
      expect((await authed(a, "GET", "/export")).statusCode).toBe(429);
      expect((await authed(b, "GET", "/export")).statusCode).toBe(200);
    });

    it("deletes the account for real after re-authentication and keeps only a pseudonymous proof", async () => {
      const s = await signup("bye@example.test");
      const other = await signup("stay@example.test");
      await addProfile(s);
      await addProfile(other);
      expect((await authed(s, "DELETE", "/account")).statusCode).toBe(403);
      expect(
        (await authed(s, "DELETE", "/account", { password: "wrong-wrong-wrong" })).statusCode,
      ).toBe(403);
      expect((await pool.query("SELECT 1 FROM users")).rowCount).toBe(2);
      const res = await authed(s, "DELETE", "/account", { password: PW });
      expect(res.statusCode).toBe(204);
      expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");
      expect((await authed(s, "GET", "/me")).statusCode).toBe(401);
      expect((await pool.query("SELECT email FROM users")).rows).toEqual([
        { email: "stay@example.test" },
      ]);
      expect((await pool.query("SELECT 1 FROM profiles")).rowCount).toBe(1);
      expect((await pool.query("SELECT 1 FROM consents")).rowCount).toBe(2); // only stay's: account + child
      expect((await pool.query("SELECT 1 FROM user_sessions")).rowCount).toBe(1);
      const proof = await pool.query<{
        scope: string;
        user_ref: string;
        due_at: Date;
        requested_at: Date;
        done_at: Date;
      }>("SELECT * FROM deletion_requests");
      expect(proof.rows).toHaveLength(1);
      expect(proof.rows[0]?.scope).toBe("account");
      expect(JSON.stringify(proof.rows)).not.toContain("bye");
      expect(
        (proof.rows[0]?.due_at.getTime() ?? 0) - (proof.rows[0]?.requested_at.getTime() ?? 0),
      ).toBe(72 * 3600_000);
      const log = await pool.query<{ details: object; entity_id: string }>(
        "SELECT * FROM audit_log WHERE action = 'user.account_deleted'",
      );
      expect(JSON.stringify(log.rows)).not.toContain("bye@");
      expect(
        (await post("/login", { username: uname("bye@example.test"), password: PW })).statusCode,
      ).toBe(401);
    });
  });

  describe("admin and parent are different principals", () => {
    it("rejects an admin cookie on parent routes and a parent cookie on admin routes", async () => {
      await createAdmin(db.url, "mum@example.test", PW);
      const adminLogin = await built.app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
        payload: { email: "mum@example.test", password: PW },
        headers: {
          "content-type": "application/json",
          origin: ADMIN_ORIGIN,
          "x-forwarded-for": ip(),
        },
      });
      expect(adminLogin.statusCode).toBe(200);
      const adminCookie = cookieOf(adminLogin);
      const adminCsrf = adminLogin.json<{ csrfToken: string }>().csrfToken;
      expect(adminCookie.startsWith(`${ADMIN_COOKIE}=`)).toBe(true);
      const asAdmin: Session = { email: "x", cookie: adminCookie, csrf: adminCsrf, ip: ip() };
      expect((await authed(asAdmin, "GET", "/me")).statusCode).toBe(401);
      expect((await authed(asAdmin, "GET", "/export")).statusCode).toBe(401);
      expect((await authed(asAdmin, "POST", "/logout-all")).statusCode).toBe(401);
      // renaming the admin cookie to the parent cookie name must not work either (separate session tables)
      const renamed = adminCookie.replace(ADMIN_COOKIE, USER_COOKIE);
      expect((await authed({ ...asAdmin, cookie: renamed }, "GET", "/me")).statusCode).toBe(401);

      const parent = await signup("pp@example.test");
      for (const [method, url] of [
        ["GET", "/api/v1/admin/auth/me"],
        ["GET", "/api/v1/admin/audit"],
        ["POST", "/api/v1/admin/auth/logout"],
      ] as const) {
        const res = await built.app.inject({
          method,
          url,
          headers: {
            cookie: parent.cookie,
            "x-csrf-token": parent.csrf,
            origin: ADMIN_ORIGIN,
            "x-forwarded-for": ip(),
          },
        });
        expect(res.statusCode, url).toBe(401);
      }
      const parentCookieRenamed = parent.cookie.replace(USER_COOKIE, ADMIN_COOKIE);
      const res = await built.app.inject({
        method: "GET",
        url: "/api/v1/admin/auth/me",
        headers: { cookie: parentCookieRenamed, "x-forwarded-for": ip() },
      });
      expect(res.statusCode).toBe(401);
    });

    it("keeps account audit rows free of admin ids and personal data", async () => {
      const s = await signup("audit@example.test");
      await post("/login", { username: uname(s.email), password: "bad-bad-bad-1" });
      const rows = await pool.query<{
        admin_user_id: string | null;
        entity_type: string;
        entity_id: string | null;
        details: object;
        ip_hash: string;
      }>("SELECT * FROM audit_log");
      expect(rows.rows.length).toBeGreaterThan(2);
      for (const row of rows.rows) {
        expect(row.admin_user_id).toBeNull();
        expect(row.entity_type).toBe("user");
        expect(JSON.stringify(row)).not.toContain("audit@example.test");
        expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
      }
      expect(await audits()).toEqual(
        expect.arrayContaining(["user.register", "user.verify_email", "user.login_failed"]),
      );
    });
  });

  describe("privacy of logs", () => {
    it("never logs passwords, tokens, cookies, emails or IP addresses through the whole lifecycle", async () => {
      const email = "logcheck@example.test";
      const from = "198.51.100.77";
      const registered = await post("/register", registerBody(email, "s3cret-Pass-Phrase!"), from);
      const codes = registered.json<{ recoveryCodes: string[] }>().recoveryCodes;
      const verifyToken = tokenOf(email);
      await post("/verify-email", { token: verifyToken }, from);
      const s: Session = {
        email,
        cookie: cookieOf(registered),
        csrf: registered.json<{ csrfToken: string }>().csrfToken,
        ip: from,
      };
      await post("/login", { username: uname(email), password: "wrong-Pass-Phrase!" }, from);
      await post("/password-reset/request", { email }, from);
      const resetToken = tokenOf(email);
      await addProfile(s);
      await authed(s, "GET", "/export");
      await authed(s, "POST", "/password", {
        currentPassword: "s3cret-Pass-Phrase!",
        newPassword: "n3w-Pass-Phrase-77",
      });
      await post(
        "/password-reset/confirm",
        { token: resetToken, password: "r3set-Pass-Phrase-88" },
        from,
      );
      await post(
        "/password-reset/recovery",
        { username: uname(email), code: codes[0], password: "rec0ver-Pass-Phrase-99" },
        from,
      );
      failingMail = true;
      await post("/register", registerBody("second@example.test"), ip());
      await new Promise((resolve) => setImmediate(resolve));
      await authed(s, "DELETE", "/account", { password: "n3w-Pass-Phrase-77" });
      expect(logs).toContain(`${A}/login`); // requests are logged...
      const secrets = [
        "s3cret-Pass-Phrase!",
        "wrong-Pass-Phrase!",
        "n3w-Pass-Phrase-77",
        "r3set-Pass-Phrase-88",
        "rec0ver-Pass-Phrase-99",
        ...codes,
        verifyToken,
        resetToken,
        s.cookie.split("=")[1] ?? "",
        s.csrf,
        email,
        "second@example.test",
        from,
        "argon2",
      ];
      for (const secret of secrets) expect(logs, secret).not.toContain(secret); // ...but without secrets
    });
  });

  describe("fuzzing", () => {
    it("never answers 5xx or leaks a stack trace to hostile payloads on any account route", async () => {
      let seed = 1234567;
      const rand = (): number => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
      const junk = (depth = 0): unknown => {
        const leaf: unknown[] = [
          null,
          true,
          false,
          0,
          -1,
          1e308,
          "",
          " ",
          "a".repeat(600),
          "'; DROP TABLE users;--",
          "\u0000",
          "𝔘𝔫𝔦",
          "../../etc/passwd",
          "{{7*7}}",
          [],
          {},
          "00000000-0000-4000-8000-000000000000",
        ];
        if (depth > 2 || rand() < 0.5) return pick(leaf);
        if (rand() < 0.5)
          return Array.from({ length: Math.floor(rand() * 4) }, () => junk(depth + 1));
        const keys = [
          "email",
          "password",
          "token",
          "nickname",
          "grade",
          "consent",
          "adult",
          "policyVersion",
          "textHash",
          "currentPassword",
          "newPassword",
          "__proto__",
          "constructor",
          "x",
        ];
        return Object.fromEntries(
          Array.from({ length: Math.floor(rand() * 5) }, () => [pick(keys), junk(depth + 1)]),
        );
      };
      const s = await signup("fuzz@example.test");
      const profile = (await addProfile(s)).json<{ id: string }>();
      const routes = built.routes.filter(
        (r) => r.includes(`${A}/`) && !r.startsWith("HEAD ") && !r.startsWith("GET "),
      );
      let sent = 0;
      for (const route of routes) {
        const [method, template] = route.split(" ") as [string, string];
        if (
          template.endsWith("/logout") ||
          template.endsWith("/logout-all") ||
          template.endsWith("/account")
        )
          continue; // would end the session under test
        for (let i = 0; i < 25; i++) {
          const url = template.replace(
            ":id",
            pick([profile.id, "x", "00000000-0000-4000-8000-000000000000", "%00"]),
          );
          const publicRoute = PUBLIC_ROUTES.includes(route);
          const res = await built.app.inject({
            method: method as "POST",
            url,
            payload: JSON.stringify(junk()),
            headers: publicRoute
              ? jsonHeaders(ip())
              : { ...jsonHeaders(s.ip), cookie: s.cookie, "x-csrf-token": s.csrf },
          });
          sent += 1;
          expect(res.statusCode, `${route} ${res.body.slice(0, 120)}`).toBeLessThan(500);
          if (res.statusCode >= 400) {
            expect(String(res.headers["content-type"])).toContain("application/problem+json");
            expect(res.body).not.toMatch(/at \S+ \(|node_modules|SELECT |syntax error/);
          }
        }
      }
      expect(sent).toBeGreaterThan(200);
      expect((await authed(s, "GET", "/me")).statusCode).toBe(200);
    });

    it("rejects unknown fields and oversized bodies", async () => {
      const email = "strict@example.test";
      expect((await post("/register", { ...registerBody(email), role: "admin" })).statusCode).toBe(
        422,
      );
      const big = await post("/login", { username: uname(email), password: "x".repeat(70_000) });
      expect(big.statusCode).toBe(413);
    });
  });

  describe("database roles", () => {
    it("keeps account tables out of reach of bj_worker and bj_web", async () => {
      for (const role of ["bj_worker", "bj_web"]) {
        for (const table of ["users", "consents", "user_sessions", "profiles"]) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            await client.query(`SET LOCAL ROLE ${role}`);
            await expect(client.query(`SELECT 1 FROM ${table}`)).rejects.toThrow(
              /permission denied/,
            );
          } finally {
            await client.query("ROLLBACK");
            client.release();
          }
        }
      }
    });

    it("lets bj_api append to deletion_requests but never edit or delete it", async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE bj_api");
        await client.query(
          "INSERT INTO deletion_requests (user_ref, scope, due_at) VALUES ('r','profile', now())",
        );
        await expect(client.query("UPDATE deletion_requests SET done_at = now()")).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    });
  });
});
