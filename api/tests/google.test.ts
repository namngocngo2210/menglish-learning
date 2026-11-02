import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PublicReader } from "@bj/data";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_TEXTS, POLICY_VERSION } from "../src/accounts/consent-texts";
import { hmacHex } from "../src/admin/crypto";
import { createMemoryMailer } from "../src/accounts/mailer";
import { hashPassword } from "../src/accounts/password";
import { buildApp, loggerOptions } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { loadServerConfig } from "../src/server/config";
import { ADMIN_URL, createMigratedDb, uname } from "./helpers";
import type { TestDb } from "./helpers";

const ORIGIN = "https://site.example.test";
const A = "/api/v1/account";
const CALLBACK = `${ORIGIN}${A}/oauth/google/callback`;
const CLIENT_ID = "client-id-123";
const ISS = "https://fake-issuer.example.test";
const KID = "k1";
const consentQuery = `policyVersion=${POLICY_VERSION}&textHash=${CONSENT_TEXTS.account.textHash}`;

const good = generateKeyPairSync("rsa", { modulusLength: 2048 });
const evil = generateKeyPairSync("rsa", { modulusLength: 2048 });

const b64 = (value: object | Buffer): string =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString("base64url");
function makeJwt(
  claims: object,
  key = good.privateKey,
  header: object = { alg: "RS256", kid: KID },
) {
  const input = `${b64(header)}.${b64(claims)}`;
  return `${input}.${b64(createSign("RSA-SHA256").update(input).sign(key))}`;
}

describe("Google OIDC config", () => {
  const base = {
    DATABASE_URL: "postgres://x/y",
    ACCOUNTS_ENABLED: "true",
    USER_SESSION_HMAC_KEY: "u".repeat(40),
    ACCOUNTS_ORIGIN: ORIGIN,
  };
  const google = {
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "s".repeat(10),
    GOOGLE_REDIRECT_URI: CALLBACK,
  };
  it("is off unless all three variables are set", () => {
    expect(loadServerConfig(base).accounts?.google).toBeUndefined();
    expect(() => loadServerConfig({ ...base, GOOGLE_CLIENT_ID: CLIENT_ID })).toThrow(
      /set all or none/,
    );
    const cfg = loadServerConfig({ ...base, ...google }).accounts?.google;
    expect(cfg?.authUrl).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  });
  it("rejects a redirect URI that is not the callback of ACCOUNTS_ORIGIN", () => {
    for (const uri of [
      `${ORIGIN}/other`,
      "https://evil.example.test" + `${A}/oauth/google/callback`,
    ])
      expect(() => loadServerConfig({ ...base, ...google, GOOGLE_REDIRECT_URI: uri })).toThrow(
        /GOOGLE_REDIRECT_URI/,
      );
  });
  it("ignores Google variables while ACCOUNTS_ENABLED is off", () => {
    expect(
      loadServerConfig({ DATABASE_URL: "postgres://x/y", ...google }).accounts,
    ).toBeUndefined();
  });
});

describe.skipIf(ADMIN_URL === undefined)("Google sign-in against a fake OIDC provider", () => {
  let db: TestDb;
  let pool: pg.Pool;
  let on: BuiltApp;
  let noGoogle: BuiltApp;
  let off: BuiltApp;
  let provider: Server;
  let base = "";
  // Per-test knobs of the fake provider.
  let claimsOverride: Record<string, unknown> = {};
  let signWith = good.privateKey;
  let header: object = { alg: "RS256", kid: KID };
  let breakPkce = false;
  const issued = new Map<string, { challenge: string; nonce: string }>();
  let sub = "sub-1";
  let email = "parent@example.test";

  beforeAll(async () => {
    provider = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname === "/jwks") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            keys: [
              { ...good.publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" },
            ],
          }),
        );
        return;
      }
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        const form = new URLSearchParams(body);
        const entry = issued.get(form.get("code") ?? "");
        const challenge = createHash("sha256")
          .update(form.get("code_verifier") ?? "")
          .digest("base64url");
        const pkceOk = entry?.challenge === challenge;
        if (
          !entry ||
          !pkceOk ||
          form.get("client_secret") !== "secret-value" ||
          form.get("redirect_uri") !== CALLBACK ||
          form.get("client_id") !== CLIENT_ID
        ) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
        issued.delete(form.get("code") ?? ""); // authorization codes are single use
        const t = Math.floor(Date.now() / 1000);
        const claims = {
          iss: ISS,
          aud: CLIENT_ID,
          sub,
          email,
          email_verified: true,
          nonce: entry.nonce,
          iat: t,
          exp: t + 600,
          ...claimsOverride,
        };
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({ id_token: makeJwt(claims, signWith, header), access_token: "unused" }),
        );
      });
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${String((provider.address() as AddressInfo).port)}`;

    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 6 });
    const common = {
      reader: {} as PublicReader,
      internalToken: undefined,
      rateLimitPerMinute: 100_000,
      trustProxy: true,
      logger: loggerOptions("silent"),
      cms: { pool, salt: "s".repeat(32) },
    };
    const accounts = {
      pool,
      hmacKey: "u".repeat(48),
      origin: ORIGIN,
      mailer: createMemoryMailer(),
    };
    on = await buildApp({
      ...common,
      accounts: {
        ...accounts,
        google: {
          clientId: CLIENT_ID,
          clientSecret: "secret-value",
          redirectUri: CALLBACK,
          authUrl: `${base}/authorize`,
          tokenUrl: `${base}/token`,
          jwksUrl: `${base}/jwks`,
          issuers: [ISS],
        },
      },
    });
    noGoogle = await buildApp({ ...common, accounts });
    off = await buildApp(common);
  }, 120_000);

  afterAll(async () => {
    await on.app.close();
    await noGoogle.app.close();
    await off.app.close();
    await pool.end();
    await db.remove();
    provider.close();
  });

  beforeEach(async () => {
    claimsOverride = {};
    signWith = good.privateKey;
    header = { alg: "RS256", kid: KID };
    breakPkce = false;
    sub = "sub-1";
    email = "parent@example.test";
    await pool.query(
      "TRUNCATE users, user_sessions, login_attempts, audit_log, deletion_requests RESTART IDENTITY CASCADE",
    );
  });

  let hits = 0;
  const ip = (): string => {
    hits += 1;
    return `10.9.${String(Math.floor(hits / 250))}.${String(hits % 250)}`;
  };
  const cookiesOf = (res: { headers: Record<string, unknown> }): string[] => {
    const raw = res.headers["set-cookie"];
    return Array.isArray(raw) ? (raw as string[]) : typeof raw === "string" ? [raw] : [];
  };
  const start = (query = consentQuery) =>
    on.app.inject({
      method: "GET",
      url: `${A}/oauth/google/start?${query}`,
      headers: { "x-forwarded-for": ip() },
    });
  /** The fake authorization endpoint: remembers the challenge and nonce, returns the redirect the browser would follow. */
  function authorize(location: string): { code: string; state: string } {
    const q = new URL(location).searchParams;
    const code = `code-${String(issued.size)}`;
    const challenge = breakPkce ? "wrong" : (q.get("code_challenge") ?? "");
    issued.set(code, { challenge, nonce: q.get("nonce") ?? "" });
    return { code, state: q.get("state") ?? "" };
  }
  const callback = (query: string, cookie: string) =>
    on.app.inject({
      method: "GET",
      url: `${A}/oauth/google/callback?${query}`,
      headers: { cookie, "x-forwarded-for": ip() },
    });
  /** Full happy path up to the callback response; `mutate` can break one step. */
  async function flow(startQuery = consentQuery) {
    const s = await start(startQuery);
    const oauthCookie = cookiesOf(s)[0]!.split(";")[0]!;
    const { code, state } = authorize(String(s.headers.location));
    const res = await callback(`code=${code}&state=${state}`, oauthCookie);
    return { s, res, oauthCookie, code, state };
  }
  const count = async (table: string): Promise<number> =>
    Number((await pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
  const expectRejected = (
    res: { statusCode: number; headers: Record<string, unknown> },
    code: string,
  ) => {
    expect(res.statusCode).toBe(302);
    expect(String(res.headers["location"])).toBe(`${ORIGIN}/dang-nhap?loi=google_${code}`);
    expect(cookiesOf(res).join(";")).not.toContain("__Host-bj_user=");
  };

  it("starts with PKCE S256, state, nonce and exactly the three scopes", async () => {
    const res = await start();
    expect(res.statusCode).toBe(302);
    const url = new URL(String(res.headers.location));
    expect(url.origin + url.pathname).toBe(`${base}/authorize`);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(CALLBACK);
    expect(url.searchParams.get("state")?.length).toBeGreaterThan(20);
    expect(url.searchParams.get("nonce")?.length).toBeGreaterThan(20);
    expect(url.searchParams.get("client_secret")).toBeNull();
    const cookie = cookiesOf(res)[0]!;
    expect(cookie).toMatch(
      /^__Host-bj_oauth=.*Max-Age=600; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
    );
  });

  it("registers a new parent, opens a parent session and works end to end", async () => {
    const { res } = await flow();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/tai-khoan`);
    const cookies = cookiesOf(res);
    expect(cookies.some((c) => c.startsWith("__Host-bj_user=") && c.includes("HttpOnly"))).toBe(
      true,
    );
    expect(cookies.some((c) => c.startsWith("__Host-bj_oauth=;") && c.includes("Max-Age=0"))).toBe(
      true,
    );
    const user = (
      await pool.query("SELECT email, status, password_hash, email_verified_at FROM users")
    ).rows[0];
    expect(user).toMatchObject({
      email: "parent@example.test",
      status: "active",
      password_hash: null,
    });
    expect(user.email_verified_at).not.toBeNull();
    expect((await pool.query("SELECT provider, subject FROM identities")).rows).toEqual([
      { provider: "google", subject: "sub-1" },
    ]);
    expect((await pool.query("SELECT purpose FROM consents")).rows).toEqual([
      { purpose: "account" },
    ]);
    const session = cookies.find((c) => c.startsWith("__Host-bj_user="))!.split(";")[0]!;
    const me = await on.app.inject({
      method: "GET",
      url: `${A}/me`,
      headers: { cookie: session, "x-forwarded-for": ip() },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<{ email: string; googleLinked: boolean }>()).toMatchObject({
      email: "parent@example.test",
      googleLinked: true,
    });
  });

  it("logs the same parent in again by sub, even if the Google email changed", async () => {
    await flow();
    email = "renamed@example.test";
    const again = await flow(""); // no consent needed for a known sub
    expect(again.res.headers.location).toBe(`${ORIGIN}/tai-khoan`);
    expect(await count("users")).toBe(1);
    expect(await count("identities")).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT action FROM audit_log WHERE action LIKE 'user.google%' ORDER BY id",
        )
      ).rows,
    ).toEqual([{ action: "user.google_register" }, { action: "user.google_login" }]);
  });

  const cookieOf = (res: { headers: Record<string, unknown> }, name: string): string | undefined =>
    cookiesOf(res)
      .find((c) => c.startsWith(`${name}=`) && !c.includes("Max-Age=0"))
      ?.split(";")[0];
  const PENDING = "__Host-bj_gpend";
  const sealed = (pending: object): string => {
    const payload = Buffer.from(JSON.stringify(pending)).toString("base64url");
    return `${PENDING}=${payload}.${hmacHex("u".repeat(48), `oauth:pending:${payload}`)}`;
  };
  const post = (url: string, body: object, headers: Record<string, string>) =>
    on.app.inject({
      method: "POST",
      url: `${A}/oauth/google/${url}`,
      payload: body,
      headers: { "x-forwarded-for": ip(), ...headers },
    });
  const ticked = {
    adult: true,
    consent: { policyVersion: POLICY_VERSION, textHash: CONSENT_TEXTS.account.textHash },
  };
  const IN = 4_000_000_000; // far-future expiry (epoch s)
  /** Password parent + parent session cookie and CSRF token. */
  async function loggedIn(mail = "parent@example.test") {
    await pool.query(
      "INSERT INTO users (username, email, email_verified_at, status, password_hash) VALUES ($3,$1,now(),'active',$2)",
      [mail, await hashPassword("a long enough passphrase"), uname(mail)],
    );
    const res = await on.app.inject({
      method: "POST",
      url: `${A}/login`,
      payload: { username: uname(mail), password: "a long enough passphrase" },
      headers: { "x-forwarded-for": ip() },
    });
    expect(res.statusCode).toBe(200);
    return {
      cookie: cookieOf(res, "__Host-bj_user")!,
      csrf: res.json<{ csrfToken: string }>().csrfToken,
    };
  }

  it("holds an unticked sign-up as pending and creates nothing", async () => {
    for (const q of ["", `policyVersion=old&textHash=${CONSENT_TEXTS.account.textHash}`]) {
      const { res } = await flow(q);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(`${ORIGIN}/dang-ky?google=xac-nhan`);
      expect(cookieOf(res, PENDING)).toBeDefined();
      expect(cookieOf(res, "__Host-bj_user")).toBeUndefined();
    }
    expect(await count("users")).toBe(0);
    expect(await count("identities")).toBe(0);
    expect(await count("consents")).toBe(0);
  });

  it("creates the parent only when register is called with the ticked boxes", async () => {
    const pending = cookieOf((await flow("")).res, PENDING)!;
    const shown = await on.app.inject({
      method: "GET",
      url: `${A}/oauth/google/pending`,
      headers: { cookie: pending, "x-forwarded-for": ip() },
    });
    expect(shown.json()).toEqual({ kind: "register", email: "parent@example.test" });

    const unticked = await post(
      "register",
      { adult: false, consent: ticked.consent },
      { cookie: pending },
    );
    expect(unticked.statusCode).toBe(422);
    const stale = await post(
      "register",
      { adult: true, consent: { policyVersion: "old", textHash: "x" } },
      { cookie: pending },
    );
    expect(stale.statusCode).toBe(409);
    expect(await count("users")).toBe(0);

    const ok = await post("register", ticked, { cookie: pending });
    expect(ok.statusCode).toBe(201);
    expect(cookieOf(ok, "__Host-bj_user")).toBeDefined();
    expect((await pool.query("SELECT subject, email_at_link FROM identities")).rows).toEqual([
      { subject: "sub-1", email_at_link: "parent@example.test" },
    ]);
    expect(await count("consents")).toBe(1);
    expect((await post("register", ticked, { cookie: pending })).statusCode).toBe(409); // replay: email now taken
    expect(await count("users")).toBe(1);
  });

  it("rejects register without, with a forged, expired or link-kind pending cookie", async () => {
    expect((await post("register", ticked, {})).statusCode).toBe(404);
    const base = { sub: "s", email: "x@example.test" };
    const forged = `${PENDING}=${Buffer.from(JSON.stringify({ k: "register", ...base, e: IN })).toString("base64url")}.${"0".repeat(64)}`;
    expect((await post("register", ticked, { cookie: forged })).statusCode).toBe(404);
    expect(
      (await post("register", ticked, { cookie: sealed({ k: "register", ...base, e: 1 }) }))
        .statusCode,
    ).toBe(404);
    expect(
      (await post("register", ticked, { cookie: sealed({ k: "link", ...base, e: IN }) }))
        .statusCode,
    ).toBe(409);
    expect(await count("users")).toBe(0);
  });

  it("never merges by email: a matching password account gets a pending link, no session", async () => {
    await pool.query(
      "INSERT INTO users (username, email, email_verified_at, status, password_hash) VALUES ('parentx','Parent@Example.test',now(),'active','x')",
    );
    const { res } = await flow();
    expect(res.headers.location).toBe(`${ORIGIN}/dang-nhap?google=lien-ket`);
    expect(cookieOf(res, "__Host-bj_user")).toBeUndefined();
    expect(await count("identities")).toBe(0);
    expect(await count("user_sessions")).toBe(0);
    const pending = cookieOf(res, PENDING)!;
    expect((await post("register", ticked, { cookie: pending })).statusCode).toBe(409);
    expect(await count("identities")).toBe(0);
  });

  it("links only for a logged-in parent who confirms, then signs in by sub", async () => {
    const me = await loggedIn();
    const pending = cookieOf((await flow()).res, PENDING)!;
    const link = (headers: Record<string, string>, body: object = { confirm: true }) =>
      post("link", body, headers);
    const same = { origin: ORIGIN };
    // no session, no CSRF token, no confirmation: nothing is linked
    expect((await link({ cookie: pending, ...same })).statusCode).toBe(401);
    expect((await link({ cookie: `${me.cookie}; ${pending}`, ...same })).statusCode).toBe(403);
    expect(
      (
        await link(
          { cookie: `${me.cookie}; ${pending}`, "x-csrf-token": me.csrf, ...same },
          { confirm: false },
        )
      ).statusCode,
    ).toBe(422);
    expect((await link({ cookie: me.cookie, "x-csrf-token": me.csrf, ...same })).statusCode).toBe(
      404,
    ); // no pending
    expect(await count("identities")).toBe(0);

    const ok = await link({ cookie: `${me.cookie}; ${pending}`, "x-csrf-token": me.csrf, ...same });
    expect(ok.statusCode).toBe(200);
    expect((await pool.query("SELECT subject, email_at_link FROM identities")).rows).toEqual([
      { subject: "sub-1", email_at_link: "parent@example.test" },
    ]);
    // a second link of the same sub, or a second Google for the same parent, is refused
    expect(
      (await link({ cookie: `${me.cookie}; ${pending}`, "x-csrf-token": me.csrf, ...same }))
        .statusCode,
    ).toBe(409);
    // the linked sub now logs into that same parent
    const again = await flow("");
    expect(again.res.headers.location).toBe(`${ORIGIN}/tai-khoan`);
    expect(await count("users")).toBe(1);
  });

  it("refuses to link a sub that already belongs to another parent", async () => {
    await flow(); // parent A registered with sub-1
    const other = await loggedIn("other@example.test");
    const pending = sealed({ k: "link", sub: "sub-1", email: "other@example.test", e: IN });
    const res = await post(
      "link",
      { confirm: true },
      { cookie: `${other.cookie}; ${pending}`, "x-csrf-token": other.csrf, origin: ORIGIN },
    );
    expect(res.statusCode).toBe(409);
    expect(await count("identities")).toBe(1);
  });

  it("a logged-in parent signing in with a new Google gets a pending link, not a second account", async () => {
    const me = await loggedIn("mine@example.test");
    const s = await start();
    const { code, state } = authorize(String(s.headers.location));
    const res = await callback(
      `code=${code}&state=${state}`,
      `${cookieOf(s, "__Host-bj_oauth")!}; ${me.cookie}`,
    );
    expect(res.headers.location).toBe(`${ORIGIN}/dang-nhap?google=lien-ket`);
    expect(await count("users")).toBe(1);
    expect(await count("identities")).toBe(0);
  });

  it("logs no email or sub", async () => {
    await flow("");
    const rows = (await pool.query("SELECT details::text AS d FROM audit_log")).rows;
    expect(JSON.stringify(rows)).not.toMatch(/example\.test|sub-1/);
  });

  it("enforces one Google identity per parent in the database", async () => {
    await flow();
    await expect(
      pool.query(
        "INSERT INTO identities (user_id, provider, subject, email_at_link) SELECT user_id, provider, 'other', 'a@b.test' FROM identities",
      ),
    ).rejects.toThrow(/identities_user_provider_key/);
  });

  it("rejects a wrong, missing, tampered or expired state", async () => {
    const s = await start();
    const oauthCookie = cookiesOf(s)[0]!.split(";")[0]!;
    const { code, state } = authorize(String(s.headers.location));
    expectRejected(await callback(`code=${code}&state=${state}x`, oauthCookie), "failed");
    expectRejected(await callback(`code=${code}`, oauthCookie), "failed");
    expectRejected(await callback(`code=${code}&state=${state}`, "x=1"), "failed");
    const [payload, mac] = oauthCookie.split("=")[1]!.split(".") as [string, string];
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString()),
        c: true,
        s: "attacker",
      }),
    ).toString("base64url");
    expectRejected(
      await callback(`code=${code}&state=attacker`, `__Host-bj_oauth=${forged}.${mac}`),
      "failed",
    );
    expect(await count("users")).toBe(0);
  });

  it("treats a provider error as denied", async () => {
    const s = await start();
    const { state } = authorize(String(s.headers.location));
    expectRejected(
      await callback(`error=access_denied&state=${state}`, cookiesOf(s)[0]!.split(";")[0]!),
      "denied",
    );
  });

  it("rejects a PKCE mismatch at the provider", async () => {
    breakPkce = true;
    expectRejected((await flow()).res, "failed");
    expect(await count("users")).toBe(0);
  });

  const t = (): number => Math.floor(Date.now() / 1000);
  const badTokens: [string, () => void][] = [
    ["wrong nonce", () => (claimsOverride = { nonce: "other" })],
    ["wrong audience", () => (claimsOverride = { aud: "someone-else" })],
    ["extra audience", () => (claimsOverride = { aud: [CLIENT_ID, "other"] })],
    ["wrong issuer", () => (claimsOverride = { iss: "https://evil.example.test" })],
    ["expired", () => (claimsOverride = { exp: t() - 3600 })],
    ["issued in the future", () => (claimsOverride = { iat: t() + 3600 })],
    ["unverified email", () => (claimsOverride = { email_verified: false })],
    ["missing email_verified", () => (claimsOverride = { email_verified: undefined })],
    ["missing sub", () => (claimsOverride = { sub: "" })],
    ["signature by another key", () => (signWith = evil.privateKey)],
    ["alg none", () => (header = { alg: "none", kid: KID })],
    ["alg HS256", () => (header = { alg: "HS256", kid: KID })],
    ["unknown kid", () => (header = { alg: "RS256", kid: "nope" })],
  ];
  it.each(badTokens)("rejects an ID token with %s", async (_name, arrange) => {
    arrange();
    expectRejected((await flow()).res, "failed");
    expect(await count("users")).toBe(0);
    expect(await count("user_sessions")).toBe(0);
    const log = (
      await pool.query("SELECT details FROM audit_log WHERE action = 'user.google_failed'")
    ).rows;
    expect(log).toHaveLength(1);
  });

  it("accepts a one-element audience array and the string form of email_verified", async () => {
    claimsOverride = { aud: [CLIENT_ID], email_verified: "true" };
    expect((await flow()).res.headers.location).toBe(`${ORIGIN}/tai-khoan`);
  });

  it("answers 404 when Google is not configured or accounts are off", async () => {
    for (const app of [noGoogle.app, off.app])
      for (const path of ["start", "callback"]) {
        const res = await app.inject({ method: "GET", url: `${A}/oauth/google/${path}` });
        expect(res.statusCode).toBe(404);
        expect(res.headers.location).toBeUndefined();
      }
  });

  it("keeps the oauth cookie distinct from the admin and session cookies", async () => {
    const cookie = cookiesOf(await start())[0]!;
    expect(cookie).not.toContain("bj_admin");
    expect(cookie.startsWith("__Host-bj_oauth=")).toBe(true);
  });

  // ---- security and takeover cases (S-U3c) ----
  const flowOf = (oauthCookie: string): Record<string, unknown> =>
    JSON.parse(
      Buffer.from(oauthCookie.split("=")[1]!.split(".")[0]!, "base64url").toString(),
    ) as Record<string, unknown>;
  const sealFlow = (value: object): string => {
    const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
    return `__Host-bj_oauth=${payload}.${hmacHex("u".repeat(48), `oauth:flow:${payload}`)}`;
  };

  it("rejects a callback whose signed state cookie has expired", async () => {
    const s = await start();
    const { code, state } = authorize(String(s.headers.location));
    const old = sealFlow({ ...flowOf(cookiesOf(s)[0]!.split(";")[0]!), e: t() - 1 });
    expectRejected(await callback(`code=${code}&state=${state}`, old), "failed");
    expect(await count("users")).toBe(0);
  });

  it("rejects a missing or wrong PKCE verifier (the provider refuses the exchange)", async () => {
    for (const v of ["", "not-the-verifier"]) {
      const s = await start();
      const { code, state } = authorize(String(s.headers.location));
      const cookie = sealFlow({ ...flowOf(cookiesOf(s)[0]!.split(";")[0]!), v });
      expectRejected(await callback(`code=${code}&state=${state}`, cookie), "failed");
    }
    expect(await count("users")).toBe(0);
    expect(await count("user_sessions")).toBe(0);
  });

  it("rejects a callback without a code or with a code the provider never issued", async () => {
    const s = await start();
    const oauthCookie = cookiesOf(s)[0]!.split(";")[0]!;
    const { state } = authorize(String(s.headers.location));
    expectRejected(await callback(`state=${state}`, oauthCookie), "failed");
    expectRejected(await callback(`code=forged&state=${state}`, oauthCookie), "failed");
    expect(await count("users")).toBe(0);
  });

  it("does not sign in twice when the same code and state are replayed", async () => {
    const { res, oauthCookie, code, state } = await flow();
    expect(res.headers.location).toBe(`${ORIGIN}/tai-khoan`);
    const sessions = await count("user_sessions");
    // the browser dropped the cookie: replay without it
    expectRejected(await callback(`code=${code}&state=${state}`, "x=1"), "failed");
    // an attacker who kept the cookie: the provider's one-time code is spent
    expectRejected(await callback(`code=${code}&state=${state}`, oauthCookie), "failed");
    expect(await count("user_sessions")).toBe(sessions);
    expect(await count("users")).toBe(1);
  });

  it("never lets an unverified Google email reach an existing account with that email", async () => {
    await pool.query(
      "INSERT INTO users (username, email, email_verified_at, status, password_hash) VALUES ('parentx','parent@example.test',now(),'active','x')",
    );
    claimsOverride = { email_verified: false };
    const { res } = await flow();
    expectRejected(res, "failed");
    expect(await count("identities")).toBe(0);
    expect(await count("user_sessions")).toBe(0);
    expect(await count("users")).toBe(1);
  });

  it("takeover attempt: a new sub with the victim's verified email gets no session and cannot link alone", async () => {
    await pool.query(
      "INSERT INTO users (username, email, email_verified_at, status, password_hash) VALUES ('parentx','parent@example.test',now(),'active','x')",
    );
    sub = "attacker-sub";
    const { res } = await flow(); // boxes ticked, new sub, same email
    expect(res.headers.location).toBe(`${ORIGIN}/dang-nhap?google=lien-ket`);
    expect(cookieOf(res, "__Host-bj_user")).toBeUndefined();
    expect(await count("user_sessions")).toBe(0);
    expect(await count("identities")).toBe(0);
    expect(await count("users")).toBe(1);
    // the pending cookie alone cannot link: linking needs the victim's own logged-in session
    const link = await post(
      "link",
      { confirm: true },
      { cookie: cookieOf(res, PENDING)!, origin: ORIGIN },
    );
    expect(link.statusCode).toBe(401);
    expect(await count("identities")).toBe(0);
  });

  it("registers nobody from Google until the boxes are ticked and the parent is an adult", async () => {
    const pending = cookieOf((await flow("")).res, PENDING)!;
    const consent = ticked.consent;
    for (const body of [{ adult: false, consent }, { consent }, { adult: true }]) {
      const res = await post("register", body, { cookie: pending });
      expect([400, 422]).toContain(res.statusCode);
    }
    expect(await count("users")).toBe(0);
    expect(await count("identities")).toBe(0);
    expect(await count("consents")).toBe(0);
  });

  it("leaves anonymous practice and public routes untouched, with the flag on or off", async () => {
    for (const app of [on.app, noGoogle.app, off.app]) {
      const res = await app.inject({ method: "GET", url: "/healthz" });
      expect(res.statusCode).toBe(200);
      expect(cookiesOf(res)).toEqual([]);
    }
    expect(await count("users")).toBe(0);
    expect(await count("user_sessions")).toBe(0);
  });

  it("answers 404 on every Google route when the flag is off, even with a valid-looking cookie", async () => {
    for (const [method, path] of [
      ["GET", "start"],
      ["GET", "callback"],
      ["GET", "pending"],
      ["POST", "register"],
      ["POST", "link"],
    ] as const) {
      const res = await off.app.inject({
        method,
        url: `${A}/oauth/google/${path}`,
        headers: { cookie: sealed({ k: "register", sub: "s", email: "a@b.test", e: IN }) },
        ...(method === "POST" ? { payload: ticked } : {}),
      });
      expect(res.statusCode).toBe(404);
    }
  });
});
