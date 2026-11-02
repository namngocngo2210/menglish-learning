import { timingSafeEqual, createHash } from "node:crypto";
import type { PublicReader } from "@bj/data";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { z } from "zod";
import { HttpProblem } from "./problems";
import {
  GradesResponseSchema,
  HealthSchema,
  PublicTestSchema,
  SnapshotSchema,
  TestParamsSchema,
  TopicsQuerySchema,
  TopicsResponseSchema,
} from "./schemas";

export interface RouteDeps {
  reader: PublicReader;
  internalToken: string | undefined;
  /** Include the parent-account operations in the served OpenAPI document (ACCOUNTS_ENABLED). */
  accountsDocs?: boolean;
}

export interface RouteContext {
  query: unknown;
  params: unknown;
  request: FastifyRequest;
}

/** Declarative route description: the single source for validation, OpenAPI and the route guard tests. */
export interface RouteSpec {
  method: "GET";
  /** Fastify URL pattern. */
  url: string;
  /** Same route as written in OpenAPI. */
  openapiPath: string;
  summary: string;
  tag: "health" | "public" | "internal" | "meta";
  auth?: "internal-token";
  query?: z.ZodType;
  params?: z.ZodType;
  responses: Record<number, { description: string; schema?: z.ZodType }>;
  /** Cache-Control for successful responses. */
  cacheControl: string;
  handler: (ctx: RouteContext) => Promise<unknown>;
}

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Wraps database access: any failure becomes a clean 503 with Retry-After, never a 500 with details. */
async function guarded<T>(request: FastifyRequest, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpProblem || error instanceof ZodError) throw error;
    request.log.error(
      { err: { name: (error as Error).name, message: (error as Error).message } },
      "database_error",
    );
    throw new HttpProblem(
      "unavailable",
      "The content database is temporarily unavailable",
      undefined,
      30,
    );
  }
}

export function buildRouteSpecs(deps: RouteDeps): RouteSpec[] {
  const { reader } = deps;
  return [
    {
      method: "GET",
      url: "/healthz",
      openapiPath: "/healthz",
      summary: "Liveness (does not touch the database)",
      tag: "health",
      responses: { 200: { description: "Process is alive", schema: HealthSchema } },
      cacheControl: "no-store",
      handler: () => Promise.resolve({ status: "ok" }),
    },
    {
      method: "GET",
      url: "/readyz",
      openapiPath: "/readyz",
      summary: "Readiness (database answers)",
      tag: "health",
      responses: {
        200: { description: "Ready", schema: HealthSchema },
        503: { description: "Database unavailable" },
      },
      cacheControl: "no-store",
      handler: async ({ request }) => {
        await guarded(request, () => reader.ping());
        return { status: "ok" };
      },
    },
    {
      method: "GET",
      url: "/api/v1/public/grades",
      openapiPath: "/api/v1/public/grades",
      summary: "Grades with public test and question counts",
      tag: "public",
      responses: {
        200: { description: "Grades", schema: GradesResponseSchema },
        503: { description: "Database unavailable" },
      },
      cacheControl: "public, max-age=60",
      handler: async ({ request }) => ({ items: await guarded(request, () => reader.grades()) }),
    },
    {
      method: "GET",
      url: "/api/v1/public/topics",
      openapiPath: "/api/v1/public/topics",
      summary: "Topics that have public tests, optionally by grade and skill",
      tag: "public",
      query: TopicsQuerySchema,
      responses: {
        200: { description: "Topics", schema: TopicsResponseSchema },
        422: { description: "Invalid query" },
        503: { description: "Database unavailable" },
      },
      cacheControl: "public, max-age=60",
      handler: async ({ query, request }) => {
        const q = TopicsQuerySchema.parse(query);
        const items = await guarded(request, () =>
          reader.topics({
            ...(q.grade === undefined ? {} : { grade: q.grade }),
            ...(q.skill === undefined ? {} : { skill: q.skill }),
          }),
        );
        return { items };
      },
    },
    {
      method: "GET",
      url: "/api/v1/public/tests/*",
      openapiPath: "/api/v1/public/tests/{slug}",
      summary: "A fixed test with its questions (options already re-ordered) and passages",
      tag: "public",
      params: TestParamsSchema,
      responses: {
        200: { description: "Test", schema: PublicTestSchema },
        404: { description: "No such public test" },
        422: { description: "Invalid slug" },
        503: { description: "Database unavailable" },
      },
      cacheControl: "public, max-age=60",
      handler: async ({ params, request }) => {
        const slug = TestParamsSchema.parse(params)["*"];
        const test = await guarded(request, () => reader.test(slug));
        if (!test) throw new HttpProblem("not_found", "No public test with this slug");
        return test;
      },
    },
    {
      method: "GET",
      url: "/api/v1/internal/snapshot",
      openapiPath: "/api/v1/internal/snapshot",
      summary:
        "Published content as a ContentBundle (static fallback and content backup). Internal network + token only.",
      tag: "internal",
      auth: "internal-token",
      responses: {
        200: { description: "ContentBundle", schema: SnapshotSchema },
        401: { description: "Missing token" },
        403: { description: "Wrong token or internal routes disabled" },
        503: { description: "Database unavailable" },
      },
      cacheControl: "no-store",
      handler: async ({ request }) => guarded(request, () => reader.loadBundle()),
    },
  ];
}

function checkInternalToken(request: FastifyRequest, expected: string | undefined): void {
  const header = request.headers.authorization;
  if (header === undefined) throw new HttpProblem("unauthenticated", "Bearer token required");
  if (expected === undefined || !header.startsWith("Bearer ")) throw new HttpProblem("forbidden");
  if (!timingSafeEqual(digest(header.slice(7)), digest(expected)))
    throw new HttpProblem("forbidden");
}

/** Registers every spec; the only way routes enter the app, so no route can skip validation or auth. */
export function registerRoutes(
  app: FastifyInstance,
  specs: readonly RouteSpec[],
  deps: RouteDeps,
): void {
  for (const spec of specs) {
    app.route({
      method: spec.method,
      url: spec.url,
      ...(spec.tag === "health" ? { config: { rateLimit: false as const } } : {}),
      handler: async (request, reply) => {
        if (spec.auth === "internal-token") checkInternalToken(request, deps.internalToken);
        const params = spec.params ? spec.params.parse(request.params) : request.params;
        const query = spec.query ? spec.query.parse(request.query) : request.query;
        const body = await spec.handler({ query, params, request });
        return reply.header("cache-control", spec.cacheControl).send(body);
      },
    });
  }
}
