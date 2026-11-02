import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { hmacHex, newToken, safeEqual } from "../admin/crypto";
import type { UserAuth } from "./auth";
import { consentMatches } from "./consent-texts";

/** Google OIDC settings. Endpoints are configurable so tests can point at a fake provider. */
export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Must equal `${ACCOUNTS_ORIGIN}/api/v1/account/oauth/google/callback` as registered at Google. */
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  issuers: readonly string[];
}

export const GOOGLE_DEFAULTS = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
  issuers: ["https://accounts.google.com", "accounts.google.com"],
} as const;

/** Parent-only cookie for the in-flight login; never the session cookie, never an admin cookie. */
export const OAUTH_COOKIE = "__Host-bj_oauth";
const STATE_TTL_S = 600;
const CLOCK_SKEW_S = 60;
const HTTP_TIMEOUT_MS = 5000;
const JWKS_TTL_MS = 10 * 60_000;

interface Flow {
  /** state, nonce, PKCE verifier, whether the parent gave the account consent, expiry (epoch s) */
  s: string;
  n: string;
  v: string;
  c: boolean;
  e: number;
}

type Failure = "failed" | "denied" | "email_exists" | "consent_required";

const b64 = (value: string | Buffer): string => Buffer.from(value).toString("base64url");
const clearOauthCookie = `${OAUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

class IdTokenError extends Error {}

// shortcut: the only outbound calls are to operator-configured provider URLs (never user input), so the
// SSRF-guarded safeFetch (engineering-standards V12/V13, not written yet) is not needed; use it once it exists.
// eslint-disable-next-line no-restricted-globals
const providerFetch = fetch;

export function googleRoutes(
  app: FastifyInstance,
  deps: {
    pool: pg.Pool;
    hmacKey: string;
    origin: string;
    google: GoogleConfig;
    auth: UserAuth;
    now: () => Date;
    openRoute: (max: number) => { config: object };
    startSession: (
      request: FastifyRequest,
      reply: FastifyReply,
      userId: string,
    ) => Promise<unknown>;
    insertConsent: (
      client: pg.PoolClient,
      request: FastifyRequest,
      userId: string,
    ) => Promise<unknown>;
  },
): void {
  const { pool, google, auth, now } = deps;
  const sign = (payload: string): string => hmacHex(deps.hmacKey, `oauth-flow:${payload}`);
  const fail = (reply: FastifyReply, code: Failure): FastifyReply =>
    reply
      .code(302)
      .header("set-cookie", clearOauthCookie)
      .header("location", `${deps.origin}/dang-nhap?loi=google_${code}`)
      .send();

  function readFlow(request: FastifyRequest): Flow | undefined {
    for (const part of (request.headers.cookie ?? "").split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name !== OAUTH_COOKIE) continue;
      const [payload, mac] = rest.join("=").split(".");
      if (!payload || !mac || !safeEqual(mac, sign(payload))) return undefined;
      try {
        const flow = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Flow;
        return flow.e * 1000 > now().getTime() ? flow : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  const timeout = (): AbortSignal => AbortSignal.timeout(HTTP_TIMEOUT_MS);
  let jwksCache: { at: number; keys: JsonWebKey[] } | undefined;
  async function jwks(refresh: boolean): Promise<JsonWebKey[]> {
    if (!refresh && jwksCache && now().getTime() - jwksCache.at < JWKS_TTL_MS)
      return jwksCache.keys;
    const res = await providerFetch(google.jwksUrl, { signal: timeout() });
    if (!res.ok) throw new IdTokenError("jwks_unavailable");
    const body = (await res.json()) as { keys?: JsonWebKey[] };
    jwksCache = { at: now().getTime(), keys: body.keys ?? [] };
    return jwksCache.keys;
  }

  /** Signature (RS256 only, key by kid from JWKS), iss, aud, exp, nonce, verified email. */
  async function verifyIdToken(
    token: string,
    nonce: string,
  ): Promise<{ sub: string; email: string }> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new IdTokenError("malformed");
    const [h, p, s] = parts as [string, string, string];
    let header: { alg?: string; kid?: string };
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as typeof header;
      claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as typeof claims;
    } catch {
      throw new IdTokenError("malformed");
    }
    if (header.alg !== "RS256" || !header.kid) throw new IdTokenError("alg");
    let jwk = (await jwks(false)).find((k) => (k as { kid?: string }).kid === header.kid);
    jwk ??= (await jwks(true)).find((k) => (k as { kid?: string }).kid === header.kid); // key rotation
    if (!jwk) throw new IdTokenError("kid");
    const valid = verify(
      "RSA-SHA256",
      Buffer.from(`${h}.${p}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(s, "base64url"),
    );
    if (!valid) throw new IdTokenError("signature");
    const t = Math.floor(now().getTime() / 1000);
    const aud = claims["aud"];
    const audOk = Array.isArray(aud)
      ? aud.length === 1 && aud[0] === google.clientId
      : aud === google.clientId;
    if (typeof claims["iss"] !== "string" || !google.issuers.includes(claims["iss"]))
      throw new IdTokenError("iss");
    if (!audOk) throw new IdTokenError("aud");
    if (typeof claims["exp"] !== "number" || claims["exp"] + CLOCK_SKEW_S < t)
      throw new IdTokenError("exp");
    if (typeof claims["iat"] === "number" && claims["iat"] - CLOCK_SKEW_S > t)
      throw new IdTokenError("iat");
    if (typeof claims["nonce"] !== "string" || !safeEqual(claims["nonce"], nonce))
      throw new IdTokenError("nonce");
    const verified = claims["email_verified"];
    if (verified !== true && verified !== "true") throw new IdTokenError("email_unverified");
    const { sub, email } = claims;
    if (typeof sub !== "string" || sub === "" || sub.length > 255) throw new IdTokenError("sub");
    if (typeof email !== "string" || email.length < 3 || email.length > 254)
      throw new IdTokenError("email");
    return { sub, email: email.toLowerCase() };
  }

  async function exchange(code: string, verifier: string): Promise<string> {
    const res = await providerFetch(google.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: google.redirectUri,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        code_verifier: verifier,
      }),
      signal: timeout(),
    });
    const body = (await res.json().catch(() => ({}))) as { id_token?: unknown };
    if (!res.ok || typeof body.id_token !== "string") throw new IdTokenError("token_exchange");
    return body.id_token;
  }

  /** Sign in by Google `sub`; an unknown `sub` creates a parent only when the email is new. Never merges by email. */
  async function resolveUser(
    request: FastifyRequest,
    claims: { sub: string; email: string },
    consented: boolean,
  ): Promise<{ userId: string; created: boolean } | Failure> {
    const known = await pool.query<{ user_id: string }>(
      "SELECT user_id::text FROM identities WHERE provider = 'google' AND subject = $1",
      [claims.sub],
    );
    if (known.rows[0]) return { userId: known.rows[0].user_id, created: false };
    const taken = await pool.query("SELECT 1 FROM users WHERE lower(email) = $1", [claims.email]);
    if (taken.rowCount) return "email_exists";
    if (!consented) return "consent_required";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (email, email_verified_at, status) VALUES ($1,$2,'active')
         ON CONFLICT (lower(email)) DO NOTHING RETURNING id::text`,
        [claims.email, now()],
      );
      const userId = user.rows[0]?.id;
      if (userId === undefined) {
        await client.query("ROLLBACK");
        return "email_exists";
      }
      await client.query(
        "INSERT INTO identities (user_id, provider, subject, email_at_link) VALUES ($1,'google',$2,$3)",
        [userId, claims.sub, claims.email],
      );
      await deps.insertConsent(client, request, userId);
      await client.query("COMMIT");
      return { userId, created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") return "email_exists"; // concurrent callback, same sub or email
      throw error;
    } finally {
      client.release();
    }
  }

  const query = (request: FastifyRequest): Record<string, string | undefined> => {
    const out: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(request.query as Record<string, unknown>))
      if (typeof v === "string") out[k] = v;
    return out;
  };

  // Browser navigation: starts the flow. `policyVersion` + `textHash` carry the ticked account consent (new parents only).
  app.get("/oauth/google/start", deps.openRoute(10), (request, reply) => {
    const q = query(request);
    const flow: Flow = {
      s: newToken(),
      n: newToken(),
      v: randomBytes(48).toString("base64url"),
      c:
        q["policyVersion"] !== undefined &&
        q["textHash"] !== undefined &&
        consentMatches("account", { policyVersion: q["policyVersion"], textHash: q["textHash"] }),
      e: Math.floor(now().getTime() / 1000) + STATE_TTL_S,
    };
    const payload = b64(JSON.stringify(flow));
    const url = new URL(google.authUrl);
    for (const [k, v] of Object.entries({
      response_type: "code",
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      scope: "openid email profile",
      state: flow.s,
      nonce: flow.n,
      code_challenge: createHash("sha256").update(flow.v).digest("base64url"),
      code_challenge_method: "S256",
    }))
      url.searchParams.set(k, v);
    return reply
      .code(302)
      .header(
        "set-cookie",
        `${OAUTH_COOKIE}=${payload}.${sign(payload)}; Max-Age=${String(STATE_TTL_S)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      )
      .header("location", url.toString())
      .send();
  });

  app.get("/oauth/google/callback", deps.openRoute(10), async (request, reply) => {
    const q = query(request);
    const flow = readFlow(request);
    const reject = async (reason: string, code: Failure = "failed"): Promise<FastifyReply> => {
      await auth.audit("user.google_failed", request, null, { reason });
      return fail(reply, code);
    };
    if (!flow || q["state"] === undefined || !safeEqual(q["state"], flow.s)) return reject("state");
    if (q["error"] !== undefined) return reject("provider_error", "denied");
    if (q["code"] === undefined || q["code"].length > 2048) return reject("code");
    let claims: { sub: string; email: string };
    try {
      claims = await verifyIdToken(await exchange(q["code"], flow.v), flow.n);
    } catch (error) {
      request.log.warn(
        { reason: error instanceof IdTokenError ? error.message : "provider_unreachable" },
        "google_oidc_failed",
      );
      return reject(error instanceof IdTokenError ? error.message : "provider_unreachable");
    }
    const outcome = await resolveUser(request, claims, flow.c);
    if (typeof outcome === "string") return reject(outcome, outcome);
    await deps.startSession(request, reply, outcome.userId);
    await auth.audit(
      outcome.created ? "user.google_register" : "user.google_login",
      request,
      outcome.userId,
    );
    void reply.header("set-cookie", clearOauthCookie); // appended to the session cookie set above
    return reply.code(302).header("location", `${deps.origin}/tai-khoan`).send();
  });
}
