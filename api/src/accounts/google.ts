import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { hmacHex, newToken, safeEqual } from "../admin/crypto";
import { HttpProblem } from "../server/problems";
import { readCookie } from "./auth";
import type { UserAuth, UserPrincipal } from "./auth";
import { consentMatches } from "./consent-texts";
import { generateUsername } from "./username";
import type { GoogleConfig } from "./google-config";
import { googleLinkBody, googleRegisterBody } from "./schemas";

/** Parent-only cookie for the in-flight login; never the session cookie, never an admin cookie. */
export const OAUTH_COOKIE = "__Host-bj_oauth";
/** Holds a verified Google identity that is not yet an account or a link; nothing is stored server-side. */
export const PENDING_COOKIE = "__Host-bj_gpend";
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

/** `register`: new email, waiting for the ticked boxes. `link`: needs a logged-in parent to confirm. */
interface Pending {
  k: "register" | "link";
  sub: string;
  email: string;
  e: number;
}

type Failure = "failed" | "denied";

const b64 = (value: string | Buffer): string => Buffer.from(value).toString("base64url");
const clearCookie = (name: string): string =>
  `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
const clearOauthCookie = clearCookie(OAUTH_COOKIE);

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
    principal: (request: FastifyRequest) => UserPrincipal;
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
  const sign = (payload: string): string => hmacHex(deps.hmacKey, `oauth:${payload}`);
  const fail = (reply: FastifyReply, code: Failure): FastifyReply =>
    reply
      .code(302)
      .header("set-cookie", clearOauthCookie)
      .header("location", `${deps.origin}/dang-nhap?loi=google_${code}`)
      .send();

  /** A signed, unexpired cookie payload; `purpose` keeps the two cookies from standing in for each other. */
  function readSigned(
    request: FastifyRequest,
    cookie: string,
    purpose: string,
  ): { e: number } | undefined {
    for (const part of (request.headers.cookie ?? "").split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name !== cookie) continue;
      const [payload, mac] = rest.join("=").split(".");
      if (!payload || !mac || !safeEqual(mac, sign(`${purpose}:${payload}`))) return undefined;
      try {
        const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
          e: number;
        };
        return value.e * 1000 > now().getTime() ? value : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  const readFlow = (request: FastifyRequest): Flow | undefined =>
    readSigned(request, OAUTH_COOKIE, "flow") as Flow | undefined;
  const readPending = (request: FastifyRequest): Pending | undefined => {
    const pending = readSigned(request, PENDING_COOKIE, "pending") as Pending | undefined;
    return pending?.k === "register" || pending?.k === "link" ? pending : undefined;
  };
  const signedCookie = (name: string, purpose: string, value: object): string => {
    const payload = b64(JSON.stringify(value));
    return `${name}=${payload}.${sign(`${purpose}:${payload}`)}; Max-Age=${String(STATE_TTL_S)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  };

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

  /** New parent + Google identity + the ticked consent, atomically. Undefined when the email or `sub` is already taken. */
  async function createParent(
    request: FastifyRequest,
    claims: { sub: string; email: string },
  ): Promise<string | undefined> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Generated username (40 random bits; the parent may change it once). A clash is a 23505 handled below.
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (username, username_generated, email, email_verified_at, status) VALUES ($1,true,$2,$3,'active')
         ON CONFLICT (lower(email)) DO NOTHING RETURNING id::text`,
        [generateUsername(), claims.email, now()],
      );
      const userId = user.rows[0]?.id;
      if (userId === undefined) {
        await client.query("ROLLBACK");
        return undefined;
      }
      await client.query(
        "INSERT INTO identities (user_id, provider, subject, email_at_link) VALUES ($1,'google',$2,$3)",
        [userId, claims.sub, claims.email],
      );
      await deps.insertConsent(client, request, userId);
      await client.query("COMMIT");
      return userId;
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") return undefined; // concurrent callback, same sub or email
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sign in by Google `sub`. Never merges by email: an unknown `sub` either becomes a new parent (boxes already
   * ticked, email free, nobody logged in) or waits as a pending identity for the register/link confirmation.
   */
  async function resolveUser(
    request: FastifyRequest,
    claims: { sub: string; email: string },
    consented: boolean,
  ): Promise<{ userId: string; created: boolean } | { pending: Pending["k"] }> {
    const known = await pool.query<{ user_id: string }>(
      "SELECT user_id::text FROM identities WHERE provider = 'google' AND subject = $1",
      [claims.sub],
    );
    if (known.rows[0]) return { userId: known.rows[0].user_id, created: false };
    const taken = await pool.query("SELECT 1 FROM users WHERE lower(email) = $1", [claims.email]);
    if (taken.rowCount || readCookie(request) !== undefined) return { pending: "link" };
    if (!consented) return { pending: "register" };
    const userId = await createParent(request, claims);
    return userId === undefined ? { pending: "link" } : { userId, created: true };
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
      .header("set-cookie", signedCookie(OAUTH_COOKIE, "flow", flow))
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
    if ("pending" in outcome) {
      const pending: Pending = {
        k: outcome.pending,
        ...claims,
        e: Math.floor(now().getTime() / 1000) + STATE_TTL_S,
      };
      await auth.audit("user.google_pending", request, null, { kind: outcome.pending });
      const page =
        outcome.pending === "register" ? "dang-ky?google=xac-nhan" : "dang-nhap?google=lien-ket";
      return reply
        .code(302)
        .header("set-cookie", [clearOauthCookie, signedCookie(PENDING_COOKIE, "pending", pending)])
        .header("location", `${deps.origin}/${page}`)
        .send();
    }
    await deps.startSession(request, reply, outcome.userId);
    await auth.audit(
      outcome.created ? "user.google_register" : "user.google_login",
      request,
      outcome.userId,
    );
    void reply.header("set-cookie", clearOauthCookie); // appended to the session cookie set above
    return reply.code(302).header("location", `${deps.origin}/tai-khoan`).send();
  });

  // What the confirmation page shows: the parent's own verified Google email, nothing else.
  app.get("/oauth/google/pending", deps.openRoute(30), (request) => {
    const pending = readPending(request);
    if (!pending) throw new HttpProblem("not_found");
    return { kind: pending.k, email: pending.email };
  });

  // New parent: only here, after the >=18 and consent boxes, is an account created.
  app.post("/oauth/google/register", deps.openRoute(10), async (request, reply) => {
    const body = googleRegisterBody.parse(request.body);
    const pending = readPending(request);
    if (!pending) throw new HttpProblem("not_found");
    if (pending.k !== "register") throw new HttpProblem("conflict", "email_exists");
    if (!consentMatches("account", body.consent))
      throw new HttpProblem("conflict", "consent_text_outdated");
    const userId = await createParent(request, pending);
    if (userId === undefined) throw new HttpProblem("conflict", "email_exists");
    const session = await deps.startSession(request, reply, userId);
    await auth.audit("user.google_register", request, userId);
    void reply.header("set-cookie", clearCookie(PENDING_COOKIE));
    return reply.code(201).send(session);
  });

  // Link to the logged-in parent (session + CSRF via the account guard) after an explicit confirmation.
  app.post("/oauth/google/link", async (request, reply) => {
    const me = deps.principal(request);
    googleLinkBody.parse(request.body);
    const pending = readPending(request);
    if (!pending) throw new HttpProblem("not_found");
    try {
      await pool.query(
        "INSERT INTO identities (user_id, provider, subject, email_at_link) VALUES ($1,'google',$2,$3)",
        [me.userId, pending.sub, pending.email],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new HttpProblem("conflict", "google_already_linked");
      throw error;
    }
    await auth.audit("user.google_linked", request, me.userId);
    void reply.header("set-cookie", clearCookie(PENDING_COOKIE));
    return { status: "linked" };
  });
}
