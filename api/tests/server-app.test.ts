import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { ContentBundleSchema } from "@bj/core";
import type { PublicReader, PublicTest } from "@bj/data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, loggerOptions } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";
import { buildOpenApi, breakingChanges } from "../src/server/openapi";
import type { OpenApiDocument } from "../src/server/openapi";
import {
  GradesResponseSchema,
  ProblemSchema,
  PublicTestSchema,
  TopicsResponseSchema,
} from "../src/server/schemas";

const TOKEN = "internal-token-0123456789";

const sampleTest: PublicTest = {
  slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
  title: "Đề 1",
  grade: 6,
  skill: "ngu-phap",
  topicSlug: "thi-hien-tai-don",
  kind: "topic",
  publishedAt: "2026-01-01T00:00:00.000Z",
  questions: [
    {
      id: "q1",
      stem: "She ___ to school.",
      options: [
        { key: "A", text: "go" },
        { key: "B", text: "goes" },
        { key: "C", text: "going" },
        { key: "D", text: "gone" },
      ],
      correctKey: "B",
      explanation: "Ngôi thứ ba số ít.",
      difficulty: 1,
    },
  ],
  passages: [],
};

function fakeReader(overrides: Partial<PublicReader> = {}): PublicReader {
  return {
    grades: () => Promise.resolve([{ grade: 6, tests: 2, questions: 40 }]),
    topics: (filter) =>
      Promise.resolve(
        filter.skill === "tu-vung"
          ? []
          : [
              {
                grade: 6,
                skill: "ngu-phap",
                slug: "thi-hien-tai-don",
                name: "Thì hiện tại đơn",
                description: "Mô tả",
                tests: 2,
              },
            ],
      ),
    test: (slug) => Promise.resolve(slug === sampleTest.slug ? sampleTest : undefined),
    loadBundle: () =>
      Promise.resolve({ sources: [], passages: [], topics: [], questions: [], tests: [] }),
    ping: () => Promise.resolve(),
    close: () => Promise.resolve(),
    ...overrides,
  };
}

const apps: BuiltApp[] = [];
async function start(
  reader: PublicReader = fakeReader(),
  extra: {
    rateLimitPerMinute?: number;
    internalToken?: string | undefined;
    logger?: Writable;
  } = {},
): Promise<BuiltApp> {
  const built = await buildApp({
    reader,
    internalToken: "internalToken" in extra ? extra.internalToken : TOKEN,
    rateLimitPerMinute: extra.rateLimitPerMinute ?? 1000,
    trustProxy: true,
    logger: extra.logger ? { ...loggerOptions("info"), stream: extra.logger } : false,
  });
  apps.push(built);
  return built;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((b) => b.app.close()));
});

describe("health", () => {
  it("serves /healthz without touching the database", async () => {
    const ping = vi.fn(() => Promise.reject(new Error("never")));
    const { app } = await start(fakeReader({ ping }));
    const res = await app.inject("/healthz");
    expect([res.statusCode, res.json()]).toEqual([200, { status: "ok" }]);
    expect(ping).not.toHaveBeenCalled();
  });

  it("reports /readyz 200 when the database answers and 503 + Retry-After when it does not", async () => {
    const ok = await start();
    expect((await ok.app.inject("/readyz")).statusCode).toBe(200);
    const down = await start(
      fakeReader({ ping: () => Promise.reject(new Error("password=secret host=db")) }),
    );
    const res = await down.app.inject("/readyz");
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBe("30");
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).not.toContain("secret");
    expect(ProblemSchema.parse(res.json()).code).toBe("unavailable");
  });
});

describe("public read endpoints", () => {
  it("lists grades with caching headers and a schema-valid body", async () => {
    const { app } = await start();
    const res = await app.inject("/api/v1/public/grades");
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(GradesResponseSchema.parse(res.json()).items[0]?.grade).toBe(6);
  });

  it("filters topics and rejects unknown or invalid query parameters with 422", async () => {
    const { app } = await start();
    const ok = await app.inject("/api/v1/public/topics?grade=6&skill=ngu-phap");
    expect(TopicsResponseSchema.parse(ok.json()).items).toHaveLength(1);
    expect((await app.inject("/api/v1/public/topics?skill=tu-vung")).json()).toEqual({ items: [] });
    for (const bad of ["?foo=1", "?grade=5", "?skill=toan"]) {
      const res = await app.inject(`/api/v1/public/topics${bad}`);
      expect(res.statusCode).toBe(422);
      const problem = ProblemSchema.parse(res.json());
      expect(problem.code).toBe("validation_failed");
      expect(problem.errors?.length).toBeGreaterThan(0);
    }
  });

  it("returns a public test, 404 for unknown slugs and 422 for malformed ones", async () => {
    const { app } = await start();
    const res = await app.inject(`/api/v1/public/tests/${sampleTest.slug}`);
    expect(res.statusCode).toBe(200);
    expect(PublicTestSchema.parse(res.json()).questions[0]?.correctKey).toBe("B");
    const missing = await app.inject("/api/v1/public/tests/lop-6/ngu-phap/khong-co/de-9");
    expect(missing.statusCode).toBe(404);
    expect(ProblemSchema.parse(missing.json()).code).toBe("not_found");
    expect((await app.inject("/api/v1/public/tests/Lop_6/x")).statusCode).toBe(422);
    expect(
      (await app.inject("/api/v1/public/tests/..%2F..%2Fetc")).statusCode,
    ).toBeGreaterThanOrEqual(400);
  });

  it("turns a database failure into 503 without leaking details", async () => {
    const { app } = await start(
      fakeReader({ grades: () => Promise.reject(new Error("relation v_public_x does not exist")) }),
    );
    const res = await app.inject("/api/v1/public/grades");
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain("v_public_x");
    expect(res.headers["retry-after"]).toBe("30");
  });

  it("answers unknown routes with a problem+json 404", async () => {
    const { app } = await start();
    const res = await app.inject("/api/v1/nope");
    expect(res.statusCode).toBe(404);
    expect(ProblemSchema.parse(res.json()).instance).toBe("/api/v1/nope");
  });

  it("does not accept writes on read-only routes", async () => {
    const { app } = await start();
    expect(
      (await app.inject({ method: "POST", url: "/api/v1/public/grades", payload: {} })).statusCode,
    ).toBe(404);
  });
});

describe("internal snapshot", () => {
  it("requires the bearer token (401 missing, 403 wrong) and returns a valid bundle", async () => {
    const { app } = await start();
    expect((await app.inject("/api/v1/internal/snapshot")).statusCode).toBe(401);
    const wrong = await app.inject({
      url: "/api/v1/internal/snapshot",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.statusCode).toBe(403);
    expect(
      (
        await app.inject({
          url: "/api/v1/internal/snapshot",
          headers: { authorization: "Basic abc" },
        })
      ).statusCode,
    ).toBe(403);
    const ok = await app.inject({
      url: "/api/v1/internal/snapshot",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["cache-control"]).toBe("no-store");
    ContentBundleSchema.parse(ok.json());
  });

  it("is disabled (403) when no internal token is configured", async () => {
    const { app } = await start(fakeReader(), { internalToken: undefined });
    const res = await app.inject({
      url: "/api/v1/internal/snapshot",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("platform behaviour", () => {
  it("sets security headers and echoes or generates a request id", async () => {
    const { app } = await start();
    const res = await app.inject({ url: "/healthz", headers: { "x-request-id": "abcdef12-3456" } });
    expect(res.headers["x-request-id"]).toBe("abcdef12-3456");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    const generated = await app.inject({ url: "/healthz", headers: { "x-request-id": "bad id" } });
    expect(String(generated.headers["x-request-id"])).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rate-limits with RateLimit headers and a problem+json 429", async () => {
    const { app } = await start(fakeReader(), { rateLimitPerMinute: 2 });
    const first = await app.inject("/api/v1/public/grades");
    expect(first.headers["ratelimit-limit"]).toBe("2");
    expect(first.headers["ratelimit-remaining"]).toBe("1");
    await app.inject("/api/v1/public/grades");
    const limited = await app.inject("/api/v1/public/grades");
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(ProblemSchema.parse(limited.json()).code).toBe("rate_limited");
    expect((await app.inject("/healthz")).statusCode).toBe(200);
  });

  it("logs neither secrets, query strings nor IP addresses", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString("utf8"));
        done();
      },
    });
    const { app } = await start(fakeReader(), { logger: stream });
    await app.inject({
      url: "/api/v1/public/topics?grade=6&secret=hunter2",
      headers: { authorization: "Bearer very-secret-token", cookie: "sid=cookie-secret" },
      remoteAddress: "203.0.113.9",
    });
    const text = lines.join("");
    expect(text).toContain("/api/v1/public/topics");
    for (const forbidden of ["very-secret-token", "cookie-secret", "hunter2", "203.0.113.9"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("registers exactly the routes in the specs and every spec has a response schema (no unvalidated route)", async () => {
    const { specs, routes } = await start();
    expect([...routes].sort()).toEqual(
      specs.flatMap((s) => [`${s.method} ${s.url}`, `HEAD ${s.url}`]).sort(),
    );
    for (const spec of specs) {
      expect(spec.responses[200]).toBeDefined();
      if (spec.url.includes("*") || spec.url.includes("topics"))
        expect(spec.params ?? spec.query).toBeDefined();
    }
  });
});

describe("OpenAPI", () => {
  it("serves the generated document and it matches the committed api/openapi.v1.json", async () => {
    const { app, specs } = await start();
    const served = (await app.inject("/api/v1/openapi.json")).json();
    expect(served).toEqual(JSON.parse(JSON.stringify(buildOpenApi(specs))));
    const committed: unknown = JSON.parse(
      readFileSync(fileURLToPath(new URL("../openapi.v1.json", import.meta.url)), "utf8"),
    );
    expect(committed).toEqual(served);
  });

  it("flags removed paths, methods and status codes but allows additions", () => {
    const base: OpenApiDocument = {
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      components: {},
      paths: {
        "/a": { get: { responses: { "200": {}, "404": {} } } },
        "/b": { get: { responses: {} } },
      },
    };
    const next: OpenApiDocument = {
      ...base,
      paths: {
        "/a": { get: { responses: { "200": {} } }, post: { responses: {} } },
        "/c": { get: { responses: {} } },
      },
    };
    expect(breakingChanges(base, next).map((i) => `${i.kind}:${i.where}`)).toEqual([
      "status_removed:GET /a 404",
      "path_removed:/b",
    ]);
    expect(
      breakingChanges(base, { ...base, paths: { ...base.paths, "/a": {} } }).map((i) => i.kind),
    ).toEqual(["method_removed"]);
    expect(breakingChanges(base, base)).toEqual([]);
  });
});
