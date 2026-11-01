import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import type { PublicReader } from "@bj/data";
import type { InjectOptions } from "fastify";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdmin } from "../src/admin/create";
import { buildApp, loggerOptions } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const ORIGIN = "https://admin.example.test";
const EMAIL = "sec@example.test";
const PASSWORD = "correct-horse-battery-9";
const ADMIN = "/api/v1/admin";
const JSON_H = { "content-type": "application/json", origin: ORIGIN };
/** Route prefixes that may be reachable without a session; anything else must sit behind the admin guard. */
const PUBLIC = [
  /^\/(healthz|readyz)$/,
  /^\/api\/v1\/(public|internal|openapi\.json)/,
  /^\/api\/v1\/admin\/auth\/login$/,
];

const openapiFile = new URL("../openapi.v1.json", import.meta.url);

describe.skipIf(ADMIN_URL === undefined)("security suite (PostgreSQL)", () => {
  let db: TestDb;
  let pool: pg.Pool;
  let built: BuiltApp;
  let clock = new Date();
  let logs = "";
  let ipN = 0;
  const sink = new Writable({
    write(chunk: Buffer, _enc, done) {
      logs += chunk.toString();
      done();
    },
  });
  let cookie = "";
  let token = "";
  let csrf = "";

  const ip = (): string => `10.77.${String(Math.floor(++ipN / 250))}.${String(ipN % 250)}`;
  const inject = (opts: InjectOptions) =>
    built.app.inject({
      ...opts,
      headers: { "x-forwarded-for": ip(), ...(opts.headers as Record<string, string>) },
    });
  const authed = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
    inject({
      method,
      url,
      headers: { ...JSON_H, cookie, "x-csrf-token": csrf },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });

  /** Every real admin route as {method, url} with params filled in. */
  const adminRoutes = (): { method: string; url: string }[] =>
    built.routes
      .flatMap((r) => {
        const space = r.indexOf(" ");
        return r
          .slice(0, space)
          .split(",")
          .map((method) => ({ method, url: r.slice(space + 1) }));
      })
      .filter((r) => r.method !== "HEAD" && r.method !== "OPTIONS")
      .filter((r) => r.url.startsWith(ADMIN) && !r.url.endsWith("/auth/login"))
      .map((r) => ({ ...r, url: r.url.replace(/:[A-Za-z]+/g, "1") }));

  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 4 });
    built = await buildApp({
      reader: {} as PublicReader,
      internalToken: undefined,
      rateLimitPerMinute: 100_000,
      logger: { ...loggerOptions("trace"), stream: sink },
      cms: { pool, salt: "s".repeat(32) },
      auth: {
        pool,
        hmacKey: "h".repeat(48),
        totpKey: Buffer.alloc(32, 5),
        origin: ORIGIN,
        now: () => clock,
      },
    });
    await createAdmin(db.url, EMAIL, PASSWORD);
    const res = await inject({
      method: "POST",
      url: `${ADMIN}/auth/login`,
      payload: { email: EMAIL, password: PASSWORD },
      headers: JSON_H,
    });
    expect(res.statusCode).toBe(200);
    cookie = String(res.headers["set-cookie"]).split(";")[0] ?? "";
    token = cookie.split("=")[1] ?? "";
    csrf = res.json<{ csrfToken: string }>().csrfToken;
  }, 120_000);

  afterAll(async () => {
    await built.app.close();
    await pool.end();
    await db.remove();
  });

  it("route inventory: every route is either on the public allowlist or behind the admin guard", async () => {
    const routes = adminRoutes();
    expect(routes.length).toBeGreaterThan(30);
    // A route registered outside the allowlist and outside /api/v1/admin would be unguarded by construction.
    const stray = built.routes
      .map((r) => r.slice(r.indexOf(" ") + 1))
      .filter((url) => !url.startsWith(ADMIN) && !PUBLIC.some((p) => p.test(url)));
    expect(stray).toEqual([]);
    for (const route of routes) {
      const res = await inject({
        method: route.method,
        url: route.url,
        headers: JSON_H,
        ...(route.method === "GET" ? {} : { payload: {} }),
      });
      expect(`${route.method} ${route.url} -> ${String(res.statusCode)}`).toMatch(/-> (401|403)$/);
      expect(res.body).not.toContain("stack");
    }
  });

  it("rejects missing, garbage, tampered, foreign-name, revoked and expired credentials", async () => {
    const url = `${ADMIN}/sources`;
    const flipped = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    const variants: Record<string, string | undefined> = {
      none: undefined,
      empty: "__Host-bj_admin=",
      garbage: "__Host-bj_admin=not-a-session",
      tampered: `__Host-bj_admin=${flipped}`,
      truncated: `__Host-bj_admin=${token.slice(0, 10)}`,
      wrongName: `bj_admin=${token}`,
      doubled: `__Host-bj_admin=garbage; __Host-bj_admin=garbage2`,
      sqlish: `__Host-bj_admin=' OR '1'='1`,
    };
    for (const [name, value] of Object.entries(variants)) {
      const res = await inject({
        method: "GET",
        url,
        headers: value === undefined ? {} : { cookie: value },
      });
      expect(`${name}:${String(res.statusCode)}`).toBe(`${name}:401`);
    }
    // The genuine cookie still works (the attempts above did not burn it).
    expect((await authed("GET", url)).statusCode).toBe(200);

    // Expiry: 8 h idle -> dead.
    const before = clock;
    clock = new Date(before.getTime() + 8 * 3600_000 + 1000);
    expect((await authed("GET", url)).statusCode).toBe(401);
    clock = before;
    // Revoke in the database: dead immediately.
    await pool.query("UPDATE admin_sessions SET revoked_at = now()");
    expect((await authed("GET", url)).statusCode).toBe(401);
    await pool.query("UPDATE admin_sessions SET revoked_at = NULL");
  });

  it("path and method variants never bypass the guard", async () => {
    const paths = [
      `${ADMIN}/sources/`,
      `${ADMIN}//sources`,
      `${ADMIN}/SOURCES`,
      `${ADMIN}/Sources`,
      `${ADMIN}/sources;x=1`,
      `${ADMIN}/sources%2F`,
      `${ADMIN}/%73ources`,
      `${ADMIN}/./sources`,
      `${ADMIN}/../admin/sources`,
      `/api/v1/public/../admin/sources`,
      `/api/v1//admin/sources`,
      `/API/V1/ADMIN/sources`,
      `${ADMIN}/sources?cookie=1&session=1`,
      `${ADMIN}/auth/me/`,
      `${ADMIN}/auth/login/../me`,
    ];
    for (const url of paths) {
      const res = await inject({ method: "GET", url, headers: JSON_H });
      expect(`${url}:${String(res.statusCode)}`).toMatch(/:(401|403|404)$/);
      expect(res.body).not.toContain('"items"');
    }
    // Methods that are not registered must not succeed, with or without a session.
    for (const method of ["PUT", "DELETE", "PATCH", "TRACE", "PROPFIND"] as const) {
      for (const url of [`${ADMIN}/sources`, `${ADMIN}/audit`, `${ADMIN}/auth/me`]) {
        const anon = await inject({ method, url, headers: JSON_H, payload: {} });
        expect(`${method} ${url}:${String(anon.statusCode)}`).toMatch(/:(400|401|403|404|405)$/);
        const real = await authed(method as "GET", url, {});
        expect(real.statusCode, `${method} ${url} with session`).toBeGreaterThanOrEqual(400);
        expect(real.statusCode).toBeLessThan(500);
      }
    }
    // HEAD must not leak list data without a session.
    const head = await inject({ method: "HEAD", url: `${ADMIN}/sources` });
    expect(head.statusCode).toBe(401);
  });

  it("CSRF: every state-changing CMS route needs the token and a same-origin request", async () => {
    const writes = adminRoutes().filter((r) => !["GET", "HEAD"].includes(r.method));
    expect(writes.length).toBeGreaterThan(10);
    for (const route of writes) {
      const base = { method: route.method as "POST", url: route.url, payload: {} };
      const noToken = await inject({ ...base, headers: { ...JSON_H, cookie } });
      const badToken = await inject({
        ...base,
        headers: { ...JSON_H, cookie, "x-csrf-token": "x".repeat(43) },
      });
      const evil = await inject({
        ...base,
        headers: { ...JSON_H, cookie, "x-csrf-token": csrf, origin: "https://evil.test" },
      });
      const form = await inject({
        ...base,
        headers: {
          cookie,
          "x-csrf-token": csrf,
          "sec-fetch-site": "cross-site",
          "content-type": "application/json",
          origin: ORIGIN,
        },
      });
      for (const res of [noToken, badToken, evil, form])
        expect(`${route.method} ${route.url}:${String(res.statusCode)}`).toMatch(/:403$/);
    }
    // Safe methods need no token but still need the session.
    const get = await inject({ method: "GET", url: `${ADMIN}/sources`, headers: { cookie } });
    expect(get.statusCode).toBe(200);
  });

  describe("input validation fuzz", () => {
    const hostile: unknown[] = [
      null,
      [],
      [[]],
      "string",
      42,
      true,
      {},
      { __proto__: { admin: true } },
      JSON.parse('{"__proto__":{"polluted":1},"constructor":{"prototype":{"p":1}}}'),
      { external_id: "x".repeat(10_000) },
      { id: "1; DROP TABLE questions;--", stem: "' OR 1=1 --" },
      {
        stem: "\u0000\u202e\ud83d",
        options: "nope",
        grade: "6",
        difficulty: Number.POSITIVE_INFINITY,
      },
      { grade: -1, skill: ["ngu-phap"], topic_id: { $ne: 1 }, correct_key: "Z" },
      { slug: "../../etc/passwd", name: "<script>alert(1)</script>", enabled: "yes" },
      { to: "published", note: 5 },
      { ids: Array.from({ length: 5000 }, (_, i) => String(i)), to: "published" },
      { status: "resolved", handled_note: "y".repeat(100_000) },
    ];
    const badIds = [
      "abc",
      "-1",
      "0x1",
      "1e3",
      "99999999999999999999",
      "1%00",
      "' OR 1=1",
      "%",
      "../1",
      " ",
    ];

    it("CMS write routes answer 4xx (never 5xx) to hostile bodies and keep the database intact", async () => {
      // Auth routes are fuzzed in admin-auth.test.ts; logout here would kill the shared session.
      const writes = adminRoutes().filter(
        (r) => !["GET", "HEAD"].includes(r.method) && !r.url.includes("/auth/"),
      );
      const statuses = new Set<number>();
      for (const route of writes) {
        for (const body of hostile) {
          const res = await inject({
            method: route.method,
            url: route.url,
            headers: { ...JSON_H, cookie, "x-csrf-token": csrf },
            payload: body as object,
          });
          statuses.add(res.statusCode);
          expect(`${route.method} ${route.url}:${String(res.statusCode)}`).toMatch(/:4\d\d$/);
          expect(res.body).not.toMatch(/at .*\.(ts|js):\d+|SELECT |pg_|syntax error/i);
        }
      }
      expect(statuses.has(500)).toBe(false);
      // Nothing hostile got stored or executed.
      expect((await pool.query("SELECT count(*)::int AS n FROM questions")).rows[0]).toEqual({
        n: 0,
      });
      expect((await pool.query("SELECT to_regclass('public.questions') AS t")).rows[0]).toEqual({
        t: "questions",
      });
      // JSON that is not JSON.
      const broken = await inject({
        method: "POST",
        url: `${ADMIN}/sources`,
        headers: { ...JSON_H, cookie, "x-csrf-token": csrf },
        payload: '{"a":',
      });
      expect(broken.statusCode).toBe(422);
    });

    it("CMS read routes reject hostile ids, limits and cursors with 4xx", async () => {
      for (const id of badIds) {
        for (const path of [
          `sources/${encodeURIComponent(id)}`,
          `questions/${encodeURIComponent(id)}`,
        ]) {
          const res = await authed("GET", `${ADMIN}/${path}`);
          expect(`${path}:${String(res.statusCode)}`).toMatch(/:(400|404|422)$/);
        }
      }
      for (const qs of [
        "limit=0",
        "limit=-5",
        "limit=abc",
        "limit=1000000",
        "cursor=zzz",
        "limit[]=1",
        "status=%00",
      ]) {
        const res = await authed("GET", `${ADMIN}/questions?${qs}`);
        expect(`${qs}:${String(res.statusCode)}`).toMatch(/:(200|400|422)$/);
      }
    });

    it("public report endpoint: hostile bodies get 4xx/202, never 5xx; oversized body 413", async () => {
      for (const body of [...hostile, { question_id: "q", reason: "typo", note: "\u0000" }]) {
        const res = await inject({
          method: "POST",
          url: "/api/v1/public/reports",
          headers: { "content-type": "application/json", "user-agent": "fuzz" },
          payload: body as object,
        });
        expect(res.statusCode, JSON.stringify(body).slice(0, 80)).toBeLessThan(500);
        expect(res.statusCode).not.toBe(200);
      }
      const huge = await inject({
        method: "POST",
        url: "/api/v1/public/reports",
        headers: { "content-type": "application/json" },
        payload: { question_id: "q", reason: "typo", note: "x".repeat(5000) },
      });
      expect(huge.statusCode).toBe(413);
      const wrongType = await inject({
        method: "POST",
        url: "/api/v1/public/reports",
        headers: { "content-type": "text/plain" },
        payload: "question_id=q",
      });
      expect(wrongType.statusCode).toBeGreaterThanOrEqual(400);
      expect(wrongType.statusCode).toBeLessThan(500);
      expect((await pool.query("SELECT count(*)::int AS n FROM question_reports")).rows[0]).toEqual(
        { n: 0 },
      );
    });
  });

  it("logs hold no cookie, session token, CSRF token, password or raw request body after all of the above", () => {
    expect(logs.length).toBeGreaterThan(1000);
    for (const secret of [PASSWORD, token, csrf, "x".repeat(43)])
      expect(logs).not.toContain(secret);
    expect(logs).not.toContain("__Host-bj_admin");
    expect(logs).not.toContain("DROP TABLE");
    expect(logs).not.toContain("<script>");
    expect(logs).not.toMatch(/password_hash|\$argon2/);
  });

  it("api/openapi.v1.json is exactly what the route specs generate (CI-style check)", async () => {
    const { allSpecs } = await import("../src/server/app");
    const { buildOpenApi } = await import("../src/server/openapi");
    const unused = (): Promise<never> => Promise.reject(new Error("unused"));
    const specs = allSpecs({
      reader: {
        loadBundle: unused,
        ping: unused,
        close: unused,
        grades: unused,
        topics: unused,
        test: unused,
      },
      internalToken: undefined,
    });
    expect(`${JSON.stringify(buildOpenApi(specs), null, 2)}\n`).toBe(
      readFileSync(openapiFile, "utf8"),
    );
  });
});
