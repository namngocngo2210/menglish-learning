import type { PublicReader } from "@bj/data";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_TEXTS, POLICY_VERSION } from "../src/accounts/consent-texts";
import { createTurnstileVerifier } from "../src/accounts/captcha";
import { createMemoryMailer } from "../src/accounts/mailer";
import { hashCode, normalizeCode } from "../src/accounts/recovery";
import { cleanUsername, generateUsername } from "../src/accounts/username";
import { buildApp } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const ORIGIN = "https://site.example.test";
const A = "/api/v1/account";
const PW = "correct-horse-battery-9";
const NEW_PW = "another-horse-battery-7";
const consent = { policyVersion: POLICY_VERSION, textHash: CONSENT_TEXTS.account.textHash };

describe("username rules", () => {
  it("accepts plain names and lowercases them", () => {
    expect(cleanUsername("  Hoa.Mai_2012 ")).toBe("hoa.mai_2012");
    expect(cleanUsername("bé-ngoan")).toBeUndefined(); // ASCII only
  });
  it.each([
    "ab",
    "a".repeat(21),
    "has space",
    "me@mail.com",
    "name.com",
    "12345678",
    "abc1234567",
    ".dot",
    "admin",
    "Admin",
    "a.d.m.i.n",
    "support",
    "beejunior",
    "root",
    "fuck123",
  ])("rejects %s", (name) => {
    expect(cleanUsername(name)).toBeUndefined();
  });
  it("generates valid, distinct names for Google sign-ups", () => {
    const names = new Set(Array.from({ length: 50 }, generateUsername));
    expect(names.size).toBe(50);
    for (const n of names) expect(cleanUsername(n)).toBe(n);
  });
  it("normalizes recovery codes before hashing", () => {
    expect(normalizeCode("abcde-fghjk 23456-mnpqr")).toBe("ABCDEFGHJK23456MNPQR");
    expect(hashCode("abcde-fghjk-23456-mnpqr")).toBe(hashCode("ABCDEFGHJK23456MNPQR"));
  });
});

describe("turnstile verifier", () => {
  const fake = (body: object, ok = true): typeof fetch =>
    (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
  it("passes only a successful siteverify answer", async () => {
    expect(await createTurnstileVerifier("s", fake({ success: true })).verify("t", "1.1.1.1")).toBe(
      true,
    );
    expect(
      await createTurnstileVerifier("s", fake({ success: false })).verify("t", "1.1.1.1"),
    ).toBe(false);
    expect(await createTurnstileVerifier("s", fake({ success: true })).verify(undefined, "1")).toBe(
      false,
    );
    const boom = (() => Promise.reject(new Error("net"))) as unknown as typeof fetch;
    expect(await createTurnstileVerifier("s", boom).verify("t", "1.1.1.1")).toBe(false);
  });
});

describe.skipIf(ADMIN_URL === undefined)("username login and recovery (PostgreSQL)", () => {
  let db: TestDb;
  let pool: pg.Pool;
  let built: BuiltApp;
  let withCaptcha: BuiltApp;
  let captchaOk = false;
  let n = 0;
  const mailer = createMemoryMailer();

  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 6 });
    const common = {
      reader: {} as PublicReader,
      internalToken: undefined,
      rateLimitPerMinute: 100_000,
      trustProxy: true,
      logger: false as const,
    };
    const accounts = { pool, hmacKey: "u".repeat(48), origin: ORIGIN, mailer };
    built = await buildApp({ ...common, accounts });
    withCaptcha = await buildApp({
      ...common,
      accounts: { ...accounts, captcha: { verify: () => Promise.resolve(captchaOk) } },
    });
  }, 120_000);
  afterAll(async () => {
    await built.app.close();
    await withCaptcha.app.close();
    await pool.end();
    await db.remove();
  });
  beforeEach(async () => {
    mailer.outbox.length = 0;
    await pool.query("TRUNCATE users, login_attempts, audit_log RESTART IDENTITY CASCADE");
  });

  const ip = (): string => {
    n += 1;
    return `10.1.${String(Math.floor(n / 250))}.${String((n % 250) + 1)}`;
  };
  const post = (path: string, payload: object, from = ip(), app = built, cookie?: string) =>
    app.app.inject({
      method: "POST",
      url: `${A}${path}`,
      payload,
      headers: {
        origin: ORIGIN,
        "x-forwarded-for": from,
        ...(cookie ? { cookie, "x-csrf-token": csrfOf.get(cookie) ?? "" } : {}),
      },
    });
  const csrfOf = new Map<string, string>();
  const reg = (username: string, extra: object = {}, from = ip(), app = built) =>
    post("/register", { username, password: PW, adult: true, consent, ...extra }, from, app);
  async function signup(username: string) {
    const res = await reg(username);
    expect(res.statusCode).toBe(201);
    const cookie = String(res.headers["set-cookie"]).split(";")[0] ?? "";
    csrfOf.set(cookie, res.json<{ csrfToken: string }>().csrfToken);
    return { cookie, codes: res.json<{ recoveryCodes: string[] }>().recoveryCodes };
  }
  const recover = (username: string, code: string, password = NEW_PW, from = ip()) =>
    post("/password-reset/recovery", { username, code, password }, from);
  const login = (username: string, password: string, from = ip()) =>
    post("/login", { username, password }, from);

  it("registers with a username only: 10 codes, a session, no email stored, hashes only", async () => {
    const res = await reg("Hoa.Mai");
    expect(res.statusCode).toBe(201);
    const body = res.json<{ recoveryCodes: string[]; emailPending: boolean }>();
    expect(body.emailPending).toBe(false);
    expect(new Set(body.recoveryCodes).size).toBe(10);
    for (const code of body.recoveryCodes) expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    const user = await pool.query("SELECT username::text, email, status FROM users");
    expect(user.rows).toEqual([{ username: "hoa.mai", email: null, status: "active" }]);
    const stored = await pool.query<{ code_sha256: string }>(
      "SELECT code_sha256 FROM recovery_codes",
    );
    expect(stored.rowCount).toBe(10);
    expect(stored.rows.map((r) => r.code_sha256)).toContain(hashCode(body.recoveryCodes[0] ?? ""));
    expect(JSON.stringify(stored.rows)).not.toContain(normalizeCode(body.recoveryCodes[0] ?? ""));
    expect(mailer.outbox).toHaveLength(0);
  });

  it("rejects bad usernames and a missing consent/adult tick", async () => {
    for (const name of ["ab", "admin", "me@x.com", "fuck123"]) {
      const res = await reg(name);
      expect(res.statusCode, name).toBe(422);
      expect(res.json<{ detail: string }>().detail).toBe("username_rejected");
    }
    expect((await reg("okname", { adult: false })).statusCode).toBe(422);
    expect(
      (await reg("okname", { consent: { policyVersion: "x", textHash: "y" } })).statusCode,
    ).toBe(409);
    expect((await reg("okname", { password: "okname" })).statusCode).toBe(422);
  });

  it("login is by username, case-insensitive; an email is not a login", async () => {
    await reg("mother", { email: "mom@example.test" });
    expect((await login("MOTHER", PW)).statusCode).toBe(200);
    const byEmail = await login("mom@example.test", PW);
    expect(byEmail.statusCode).toBe(401);
    expect({ ...byEmail.json<object>(), request_id: 0 }).toEqual({
      ...(await login("nobody", PW)).json<object>(),
      request_id: 0,
    });
  });

  it("answers unknown user, wrong password and locked login the same way; limits per username and per IP", async () => {
    await reg("victim");
    const wrong = await login("victim", "wrong-wrong-wrong");
    const ghost = await login("ghost", "wrong-wrong-wrong");
    expect(wrong.statusCode).toBe(401);
    expect({ ...ghost.json<object>(), request_id: 0 }).toEqual({
      ...wrong.json<object>(),
      request_id: 0,
    });
    // per username: rotating IPs cannot get past 10 failures in an hour
    let blocked = 0;
    for (let i = 0; i < 14; i++)
      if ((await login("victim", `guess-number-${String(i)}`)).statusCode === 429) blocked += 1;
    expect(blocked).toBeGreaterThanOrEqual(3);
    expect((await login("victim", PW)).statusCode).toBe(429);
    // per IP: one address guessing many usernames is stopped after 5 failures
    const same = ip();
    const codes: number[] = [];
    for (let i = 0; i < 8; i++)
      codes.push((await login(`ghost${String(i)}`, "wrong-wrong-wrong", same)).statusCode);
    expect(codes.slice(5)).toContain(429);
  });

  it("limits registrations per IP: a cooldown and an hourly cap", async () => {
    const from = ip();
    expect((await reg("first1", {}, from)).statusCode).toBe(201);
    const cool = await reg("first2", {}, from);
    expect(cool.statusCode).toBe(429);
    expect(Number(cool.headers["retry-after"])).toBeGreaterThan(0);
    await pool.query(
      "UPDATE login_attempts SET created_at = now() - interval '2 minutes' WHERE key_hash LIKE 'reg-cool:%'",
    );
    expect((await reg("first2", {}, from)).statusCode).toBe(201);
    await pool.query(
      "UPDATE login_attempts SET created_at = now() - interval '2 minutes' WHERE key_hash LIKE 'reg-cool:%'",
    );
    expect((await reg("first3", {}, from)).statusCode).toBe(201);
    await pool.query(
      "UPDATE login_attempts SET created_at = now() - interval '2 minutes' WHERE key_hash LIKE 'reg-cool:%'",
    );
    expect((await reg("first4", {}, from)).statusCode).toBe(429);
  });

  it("asks for a Turnstile token only when the hook is configured", async () => {
    captchaOk = false;
    expect((await reg("bot1", {}, ip(), withCaptcha)).json<{ detail: string }>().detail).toBe(
      "captcha_failed",
    );
    captchaOk = true;
    expect((await reg("human1", { captchaToken: "ok" }, ip(), withCaptcha)).statusCode).toBe(201);
    expect((await reg("plain1")).statusCode).toBe(201); // default build: hook off
  });

  it("resets the password with a recovery code exactly once and revokes sessions", async () => {
    const { cookie, codes } = await signup("kidmum");
    const ok = await recover("kidmum", codes[0]?.toLowerCase().replaceAll("-", " ") ?? "");
    expect(ok.statusCode).toBe(200);
    expect((await login("kidmum", PW)).statusCode).toBe(401);
    expect((await login("kidmum", NEW_PW)).statusCode).toBe(200);
    const me = await built.app.inject({ method: "GET", url: `${A}/me`, headers: { cookie } });
    expect(me.statusCode).toBe(401); // old session revoked
    const again = await recover("kidmum", codes[0] ?? "", "third-horse-battery-5");
    expect(again.statusCode).toBe(422);
    expect(again.json<{ detail: string }>().detail).toBe("invalid_recovery");
    expect((await recover("kidmum", codes[1] ?? "", "third-horse-battery-5")).statusCode).toBe(200);
  });

  it("gives unknown user and wrong code the same answer, and rate limits guessing per IP and per username", async () => {
    await signup("target");
    const wrong = await recover("target", "AAAAA-BBBBB-CCCCC-DDDDD");
    const ghost = await recover("ghost", "AAAAA-BBBBB-CCCCC-DDDDD");
    expect(wrong.statusCode).toBe(422);
    expect({ ...ghost.json<object>(), request_id: 0 }).toEqual({
      ...wrong.json<object>(),
      request_id: 0,
    });
    const same = ip();
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++)
      statuses.push((await recover("target", `WRONG-CODE-${String(i)}`, NEW_PW, same)).statusCode);
    expect(statuses.slice(5)).toContain(429);
    let blocked = 0;
    for (let i = 0; i < 14; i++)
      if ((await recover("target", `OTHER-CODE-${String(i)}`)).statusCode === 429) blocked += 1;
    expect(blocked).toBeGreaterThanOrEqual(2);
  });

  it("rejects a weak new password without burning the recovery code", async () => {
    const { codes } = await signup("weakling");
    expect((await recover("weakling", codes[0] ?? "", "short")).statusCode).toBe(422);
    expect((await recover("weakling", codes[0] ?? "")).statusCode).toBe(200);
  });

  it("regenerates codes only with the password and invalidates the old ones", async () => {
    const { cookie, codes } = await signup("regen");
    expect(
      (await post("/recovery-codes", { password: "nope-nope-nope" }, ip(), built, cookie))
        .statusCode,
    ).toBe(403);
    const res = await post("/recovery-codes", { password: PW }, ip(), built, cookie);
    expect(res.statusCode).toBe(200);
    const fresh = res.json<{ recoveryCodes: string[] }>().recoveryCodes;
    expect(fresh).toHaveLength(10);
    expect((await recover("regen", codes[0] ?? "")).statusCode).toBe(422);
    expect((await recover("regen", fresh[0] ?? "")).statusCode).toBe(200);
  });

  it("never lets an unverified email reset a password; a verified one can", async () => {
    const { cookie } = await signup("mailer1");
    await post("/email", { email: "Real@Example.test" }, ip(), built, cookie);
    expect((await pool.query("SELECT email FROM users")).rows[0]).toEqual({ email: null });
    await post("/password-reset/request", { email: "real@example.test" });
    expect(mailer.outbox.filter((m) => m.subject.includes("Đặt lại"))).toHaveLength(0);
    const link = /token=([\w-]+)/.exec(mailer.outbox.at(-1)?.text ?? "")?.[1] ?? "";
    expect((await post("/verify-email", { token: link })).statusCode).toBe(200);
    expect((await pool.query("SELECT email FROM users")).rows[0]).toEqual({
      email: "real@example.test",
    });
    await post("/password-reset/request", { email: "real@example.test" });
    const reset = mailer.outbox.filter((m) => m.subject.includes("Đặt lại")).at(-1);
    const token = /token=([\w-]+)/.exec(reset?.text ?? "")?.[1] ?? "";
    expect((await post("/password-reset/confirm", { token, password: NEW_PW })).statusCode).toBe(
      200,
    );
    expect((await login("mailer1", NEW_PW)).statusCode).toBe(200);
  });

  it("lets a Google-style generated username be changed exactly once", async () => {
    const user = await pool.query<{ id: string }>(
      "INSERT INTO users (username, username_generated, email, email_verified_at, status) VALUES ($1,true,'g@example.test',now(),'active') RETURNING id::text",
      [generateUsername()],
    );
    expect(user.rowCount).toBe(1);
    const token = "g".repeat(43);
    const { createHash } = await import("node:crypto");
    await pool.query(
      "INSERT INTO user_sessions (id, user_id, csrf_secret, ip_hash, user_agent_hash, last_seen_at, expires_at, absolute_expires_at) VALUES ($1,$2,'csrf','i','u',now(),now()+interval '1 day',now()+interval '1 day')",
      [createHash("sha256").update(token).digest("hex"), user.rows[0]?.id],
    );
    const cookie = `__Host-bj_user=${token}`;
    csrfOf.set(cookie, "csrf");
    await signup("takenname");
    expect(
      (await post("/username", { username: "TakenName" }, ip(), built, cookie)).statusCode,
    ).toBe(409);
    expect((await post("/username", { username: "admin" }, ip(), built, cookie)).statusCode).toBe(
      422,
    );
    expect(
      (await post("/username", { username: "my.new.name" }, ip(), built, cookie)).statusCode,
    ).toBe(200);
    const second = await post("/username", { username: "another.one" }, ip(), built, cookie);
    expect(second.statusCode).toBe(409);
    expect(second.json<{ detail: string }>().detail).toBe("username_not_changeable");
  });
});
