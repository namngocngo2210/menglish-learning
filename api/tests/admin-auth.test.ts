import { Writable } from "node:stream";
import type { PublicReader } from "@bj/data";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { COOKIE } from "../src/admin/auth";
import { totpCode } from "../src/admin/crypto";
import { createAdmin } from "../src/admin/create";
import { buildApp, loggerOptions } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const ORIGIN = "https://admin.example.test";
const EMAIL = "owner@example.test";
const PASSWORD = "correct-horse-battery-9";
const HMAC_KEY = "h".repeat(48);
const TOTP_KEY = Buffer.alloc(32, 5);
const JSON_H = { "content-type": "application/json", origin: ORIGIN };

describe.skipIf(ADMIN_URL === undefined)("admin auth (PostgreSQL)", () => {
  let db: TestDb;
  let pool: pg.Pool;
  let built: BuiltApp;
  let clock = new Date();
  let logs = "";
  let ipCounter = 0;
  const sink = new Writable({
    write(chunk: Buffer, _enc, done) {
      logs += chunk.toString();
      done();
    },
  });

  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 4 });
    built = await buildApp({
      reader: {} as PublicReader,
      internalToken: undefined,
      rateLimitPerMinute: 10_000,
      logger: { ...loggerOptions("trace"), stream: sink },
      cms: { pool, salt: "s".repeat(32) },
      auth: { pool, hmacKey: HMAC_KEY, totpKey: TOTP_KEY, origin: ORIGIN, now: () => clock },
    });
  }, 120_000);

  afterAll(async () => {
    await built.app.close();
    await pool.end();
    await db.remove();
  });

  beforeEach(async () => {
    clock = new Date();
    logs = "";
    ipCounter += 1;
    await pool.query(
      "TRUNCATE admin_users, admin_sessions, login_attempts, audit_log RESTART IDENTITY CASCADE",
    );
    await createAdmin(db.url, EMAIL, PASSWORD);
  });

  const ip = (): string => `10.0.${String(ipCounter)}.1`;
  const post = (url: string, payload: unknown, headers: Record<string, string> = {}, from = ip()) =>
    built.app.inject({
      method: "POST",
      url,
      payload: payload as object,
      headers: { ...JSON_H, "x-forwarded-for": from, ...headers },
    });

  interface Session {
    cookie: string;
    csrf: string;
    headers: Record<string, string>;
  }

  async function login(extra: Record<string, unknown> = {}, from = ip()): Promise<Session> {
    const res = await post(
      "/api/v1/admin/auth/login",
      { email: EMAIL, password: PASSWORD, ...extra },
      {},
      from,
    );
    expect(res.statusCode).toBe(200);
    const cookie = String(res.headers["set-cookie"]).split(";")[0] ?? "";
    const csrf = res.json<{ csrfToken: string }>().csrfToken;
    return {
      cookie,
      csrf,
      headers: { ...JSON_H, cookie, "x-csrf-token": csrf, "x-forwarded-for": from },
    };
  }

  const authed = (s: Session, method: "GET" | "POST", url: string, payload?: object) =>
    built.app.inject({
      method,
      url,
      headers: s.headers,
      ...(payload ? { payload } : {}),
    });

  const audits = async (): Promise<string[]> =>
    (await pool.query<{ action: string }>("SELECT action FROM audit_log ORDER BY id")).rows.map(
      (r) => r.action,
    );

  it("logs in with a strict cookie and returns the CSRF token; me works", async () => {
    const res = await post("/api/v1/admin/auth/login", { email: EMAIL, password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(new RegExp(`^${COOKIE}=[A-Za-z0-9_-]{43};`));
    for (const attr of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"])
      expect(cookie).toContain(attr);
    expect(cookie).not.toContain("Domain");
    const s = await login();
    const me = await authed(s, "GET", "/api/v1/admin/auth/me");
    expect(me.json()).toMatchObject({ email: EMAIL, totpEnabled: false, csrfToken: s.csrf });
    const stored = await pool.query<{ id: string }>("SELECT id FROM admin_sessions");
    expect(stored.rows.every((r) => !cookie.includes(r.id))).toBe(true); // DB keeps only the hash
  });

  it("answers wrong password and unknown email identically", async () => {
    const wrong = await post("/api/v1/admin/auth/login", {
      email: EMAIL,
      password: "nope-nope-nope",
    });
    const unknown = await post("/api/v1/admin/auth/login", {
      email: "who@example.test",
      password: "nope-nope-nope",
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    const strip = (r: typeof wrong): object => ({ ...r.json<object>(), request_id: 0 });
    expect(strip(wrong)).toEqual(strip(unknown));
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("never reuses an incoming session id on login (fixation) and revokes it", async () => {
    const first = await login();
    const res = await post(
      "/api/v1/admin/auth/login",
      { email: EMAIL, password: PASSWORD },
      { cookie: first.cookie },
    );
    const second = String(res.headers["set-cookie"]).split(";")[0];
    expect(second).not.toBe(first.cookie);
    expect((await authed(first, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(401);
    const row = await pool.query(
      "SELECT rotated_from FROM admin_sessions WHERE rotated_from IS NOT NULL",
    );
    expect(row.rowCount).toBe(1);
    // A cookie value the server never issued does not become a session.
    const forged = await built.app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: { cookie: `${COOKIE}=attacker-chosen-value` },
    });
    expect(forged.statusCode).toBe(401);
  });

  it("expires sessions after 8 h idle and 7 d absolute, and slides the idle window", async () => {
    const s = await login();
    clock = new Date(clock.getTime() + 7 * 3600_000);
    expect((await authed(s, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(200); // slides
    clock = new Date(clock.getTime() + 7 * 3600_000);
    expect((await authed(s, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(200);
    clock = new Date(clock.getTime() + 9 * 3600_000);
    expect((await authed(s, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(401); // idle

    const t0 = clock;
    const s2 = await login();
    for (let step = 1; step <= 23; step += 1) {
      clock = new Date(t0.getTime() + step * 7 * 3600_000); // 7 h steps keep the idle window alive
      expect((await authed(s2, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(200);
    }
    clock = new Date(t0.getTime() + 7 * 24 * 3600_000 + 60_000); // 24 steps = 168 h; 60 s past 7 d
    expect((await authed(s2, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(401); // absolute
  });

  it("logout revokes the session and clears the cookie", async () => {
    const s = await login();
    const out = await authed(s, "POST", "/api/v1/admin/auth/logout", {});
    expect(out.statusCode).toBe(200);
    expect(String(out.headers["set-cookie"])).toContain("Max-Age=0");
    expect((await authed(s, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(401);
  });

  it("rejects state-changing requests without a valid CSRF token or same origin (403 + audit)", async () => {
    const s = await login();
    const url = "/api/v1/admin/auth/logout";
    const noToken = await built.app.inject({
      method: "POST",
      url,
      payload: {},
      headers: { ...s.headers, "x-csrf-token": "" },
    });
    const badToken = await built.app.inject({
      method: "POST",
      url,
      payload: {},
      headers: { ...s.headers, "x-csrf-token": "x".repeat(43) },
    });
    const evil = await built.app.inject({
      method: "POST",
      url,
      payload: {},
      headers: { ...s.headers, origin: "https://evil.test" },
    });
    const crossSite = await built.app.inject({
      method: "POST",
      url,
      payload: {},
      headers: { ...s.headers, "sec-fetch-site": "cross-site" },
    });
    for (const res of [noToken, badToken, evil, crossSite]) expect(res.statusCode).toBe(403);
    expect((await audits()).filter((a) => a === "auth.csrf_denied")).toHaveLength(4);
    // Login itself also checks the origin.
    const loginEvil = await post(
      "/api/v1/admin/auth/login",
      { email: EMAIL, password: PASSWORD },
      { origin: "https://evil.test" },
    );
    expect(loginEvil.statusCode).toBe(403);
    // The session survived all of that.
    expect((await authed(s, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(200);
  });

  it("guards every registered admin route: 401 without a session (except login)", async () => {
    const adminRoutes = built.routes
      .flatMap((r) => {
        const [methods, url] = [r.slice(0, r.indexOf(" ")), r.slice(r.indexOf(" ") + 1)];
        return methods.split(",").map((method) => ({ method, url }));
      })
      .filter(
        (r) => r.url.startsWith("/api/v1/admin") && r.method !== "HEAD" && r.method !== "OPTIONS",
      );
    expect(adminRoutes.length).toBeGreaterThan(8);
    for (const route of adminRoutes) {
      const res = await built.app.inject({
        method: route.method as "GET",
        url: route.url.replace(/:[A-Za-z]+/g, "1").replace(/\*/g, "x"),
        headers: { ...JSON_H, "x-csrf-token": "x" },
        ...(route.method === "GET" ? {} : { payload: {} }),
      });
      const isLogin = route.url.endsWith("/auth/login");
      expect(`${route.method} ${route.url} -> ${String(res.statusCode)}`).toBe(
        `${route.method} ${route.url} -> ${isLogin ? "422" : "401"}`,
      );
    }
  });

  it("rate-limits by IP (5/15 min) with Retry-After, even for the right password", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await post("/api/v1/admin/auth/login", {
        email: EMAIL,
        password: "bad-password-1",
      });
      expect(res.statusCode).toBe(401);
    }
    const blocked = await post("/api/v1/admin/auth/login", { email: EMAIL, password: PASSWORD });
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(await audits()).toContain("auth.login_locked");
    clock = new Date(clock.getTime() + 16 * 60_000);
    expect(
      (await post("/api/v1/admin/auth/login", { email: EMAIL, password: PASSWORD })).statusCode,
    ).toBe(200);
  });

  it("locks the account after 10 failures from many IPs, then recovers", async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await post(
        "/api/v1/admin/auth/login",
        { email: EMAIL, password: "bad-password-1" },
        {},
        `10.9.${String(ipCounter)}.${String(i + 1)}`,
      );
      expect(res.statusCode).toBe(401);
    }
    const locked = await pool.query<{ locked_until: Date | null }>(
      "SELECT locked_until FROM admin_users",
    );
    expect(locked.rows[0]?.locked_until).not.toBeNull();
    const res = await post(
      "/api/v1/admin/auth/login",
      { email: EMAIL, password: PASSWORD },
      {},
      "10.8.8.8",
    );
    expect(res.statusCode).toBe(429);
    clock = new Date(clock.getTime() + 61 * 60_000);
    expect(
      (await post("/api/v1/admin/auth/login", { email: EMAIL, password: PASSWORD }, {}, "10.8.8.9"))
        .statusCode,
    ).toBe(200);
    expect((await pool.query("SELECT failed_login_count FROM admin_users")).rows[0]).toEqual({
      failed_login_count: 0,
    });
  });

  describe("TOTP", () => {
    async function enable(s: Session): Promise<{ secret: string; codes: string[] }> {
      const enroll = await authed(s, "POST", "/api/v1/admin/auth/totp/enroll", {});
      expect(enroll.statusCode).toBe(200);
      const body = enroll.json<{ secret: string; otpauthUri: string }>();
      expect(body.otpauthUri).toContain(`secret=${body.secret}`);
      const stored = await pool.query<{ totp_secret_enc: string }>(
        "SELECT totp_secret_enc FROM admin_users",
      );
      expect(stored.rows[0]?.totp_secret_enc).not.toContain(body.secret);
      const bad = await authed(s, "POST", "/api/v1/admin/auth/totp/verify", { code: "000000" });
      expect(bad.statusCode).toBe(422);
      const ok = await authed(s, "POST", "/api/v1/admin/auth/totp/verify", {
        code: totpCode(body.secret, clock.getTime()),
      });
      expect(ok.statusCode).toBe(200);
      const codes = ok.json<{ recoveryCodes: string[] }>().recoveryCodes;
      expect(codes).toHaveLength(8);
      return { secret: body.secret, codes };
    }

    it("is not enforced until verified; afterwards login needs a code", async () => {
      const s = await login();
      await authed(s, "POST", "/api/v1/admin/auth/totp/enroll", {});
      await login(); // pending enrollment does not lock the owner out
      const { secret } = await enable(s);
      const missing = await post("/api/v1/admin/auth/login", { email: EMAIL, password: PASSWORD });
      expect(missing.statusCode).toBe(401);
      expect(missing.json()).toMatchObject({ detail: "totp_required" });
      const wrong = await post("/api/v1/admin/auth/login", {
        email: EMAIL,
        password: PASSWORD,
        totp: "123456",
      });
      expect(wrong.statusCode).toBe(401);
      const good = await login({ totp: totpCode(secret, clock.getTime()) });
      expect((await authed(good, "GET", "/api/v1/admin/auth/me")).json()).toMatchObject({
        totpEnabled: true,
      });
      expect(await audits()).toEqual(
        expect.arrayContaining(["auth.totp_enrolled", "auth.totp_verified"]),
      );
    });

    it("recovery codes are stored hashed and work exactly once", async () => {
      const s = await login();
      const { codes } = await enable(s);
      const rows = await pool.query<{ code_hash: string }>(
        "SELECT code_hash FROM admin_recovery_codes",
      );
      expect(rows.rowCount).toBe(8);
      for (const r of rows.rows) {
        expect(r.code_hash.startsWith("$argon2id$")).toBe(true);
        expect(codes).not.toContain(r.code_hash);
      }
      const code = codes[0]!;
      await login({ totp: code });
      const again = await post("/api/v1/admin/auth/login", {
        email: EMAIL,
        password: PASSWORD,
        totp: code,
      });
      expect(again.statusCode).toBe(401);
      expect(await audits()).toContain("auth.recovery_code_used");
    });

    it("disable needs password + code, revokes other sessions and removes TOTP", async () => {
      const s = await login();
      const { secret, codes } = await enable(s);
      const other = await login({ totp: totpCode(secret, clock.getTime()) });
      const wrongPw = await authed(other, "POST", "/api/v1/admin/auth/totp/disable", {
        password: "bad-password-1",
        code: codes[1],
      });
      expect(wrongPw.statusCode).toBe(403);
      const ok = await authed(other, "POST", "/api/v1/admin/auth/totp/disable", {
        password: PASSWORD,
        code: codes[1],
      });
      expect(ok.statusCode).toBe(200);
      expect((await authed(s, "GET", "/api/v1/admin/auth/me")).statusCode).toBe(401);
      expect((await authed(other, "GET", "/api/v1/admin/auth/me")).json()).toMatchObject({
        totpEnabled: false,
      });
      expect((await pool.query("SELECT 1 FROM admin_recovery_codes")).rowCount).toBe(0);
      expect(await audits()).toContain("auth.totp_disabled");
      await login(); // plain password works again
    });
  });

  it("writes audit rows for auth events without secrets", async () => {
    await post("/api/v1/admin/auth/login", { email: EMAIL, password: "bad-password-1" });
    const s = await login();
    await authed(s, "POST", "/api/v1/admin/auth/logout", {});
    expect(await audits()).toEqual([
      "admin.created",
      "auth.login_failed",
      "auth.login_success",
      "auth.logout",
    ]);
    const dump = JSON.stringify((await pool.query("SELECT * FROM audit_log")).rows);
    for (const secret of [PASSWORD, "bad-password-1", s.csrf, s.cookie.split("=")[1]!])
      expect(dump).not.toContain(secret);
    expect(dump).not.toContain("10.0."); // IPs only as HMAC hashes
  });

  it("keeps passwords, cookies, tokens, TOTP secrets and codes out of the logs", async () => {
    const s = await login();
    const enroll = await authed(s, "POST", "/api/v1/admin/auth/totp/enroll", {});
    const { secret } = enroll.json<{ secret: string }>();
    const code = totpCode(secret, clock.getTime());
    const verify = await authed(s, "POST", "/api/v1/admin/auth/totp/verify", { code });
    const recovery = verify.json<{ recoveryCodes: string[] }>().recoveryCodes;
    await post("/api/v1/admin/auth/login", { email: EMAIL, password: "bad-password-1" });
    await post("/api/v1/admin/auth/login", { email: EMAIL, password: PASSWORD, totp: recovery[0] });
    await authed(s, "POST", "/api/v1/admin/auth/logout", {});
    expect(logs.length).toBeGreaterThan(100); // the logger really ran at trace level
    const secrets = [
      PASSWORD,
      "bad-password-1",
      s.csrf,
      s.cookie.split("=")[1]!,
      secret,
      code,
      ...recovery,
    ];
    for (const value of secrets) expect(logs).not.toContain(value);
    expect(logs).not.toContain(COOKIE);
  });
});
