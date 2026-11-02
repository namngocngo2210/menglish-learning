import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PublicReader } from "@bj/data";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_TEXTS, POLICY_VERSION } from "../src/accounts/consent-texts";
import { createMemoryMailer } from "../src/accounts/mailer";
import { buildApp, loggerOptions } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { loadServerConfig } from "../src/server/config";
import { ADMIN_URL, createMigratedDb } from "./helpers";
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

  it("does not create an account without the ticked consent", async () => {
    expectRejected((await flow("")).res, "consent_required");
    expectRejected(
      (await flow(`policyVersion=old&textHash=${CONSENT_TEXTS.account.textHash}`)).res,
      "consent_required",
    );
    expect(await count("users")).toBe(0);
  });

  it("never merges into an existing account with the same email", async () => {
    await pool.query(
      "INSERT INTO users (email, status, password_hash) VALUES ('Parent@Example.test','active','x')",
    );
    expectRejected((await flow()).res, "email_exists");
    expect(await count("identities")).toBe(0);
    expect(await count("user_sessions")).toBe(0);
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
});
