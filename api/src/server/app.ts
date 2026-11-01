import { randomUUID } from "node:crypto";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import { buildOpenApi } from "./openapi";
import { HttpProblem, problemBody, sendProblem } from "./problems";
import { buildRouteSpecs, registerRoutes } from "./routes";
import type { RouteDeps, RouteSpec } from "./routes";

export interface AppOptions extends RouteDeps {
  rateLimitPerMinute: number;
  logger: Exclude<FastifyServerOptions["logger"], undefined>;
}

export interface BuiltApp {
  app: FastifyInstance;
  specs: readonly RouteSpec[];
  /** Every route Fastify registered (method + url): tests assert it equals the specs. */
  routes: readonly string[];
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** pino settings: JSON to stdout, no IPs, no query strings, secrets redacted (standards §6). */
export function loggerOptions(
  level: string,
): Exclude<FastifyServerOptions["logger"], undefined | boolean> {
  return {
    level,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
        "*.password",
        "*.token",
        "*.secret",
        "*.api_key",
      ],
      censor: "[Redacted]",
    },
    serializers: {
      req: (req: { method?: string; url?: string; id?: string }) => ({
        method: req.method ?? "",
        url: (req.url ?? "").split("?")[0] ?? "",
        id: req.id ?? "",
      }),
    },
  };
}

export async function buildApp(options: AppOptions): Promise<BuiltApp> {
  const app: FastifyInstance = Fastify({
    logger: options.logger,
    bodyLimit: 64 * 1024,
    trustProxy: true,
    genReqId: (req) => {
      const given = req.headers["x-request-id"];
      return typeof given === "string" && REQUEST_ID.test(given) ? given : randomUUID();
    },
  });

  app.addHook("onSend", (request, reply, payload, done) => {
    void reply.header("x-request-id", request.id);
    done(null, payload);
  });

  await app.register(helmet, { global: true });
  await app.register(rateLimit, {
    global: true,
    max: options.rateLimitPerMinute,
    timeWindow: "1 minute",
    enableDraftSpec: true,
    errorResponseBuilder: (_request, context) =>
      new HttpProblem(
        "rate_limited",
        `Retry after ${String(Math.ceil(context.ttl / 1000))} s`,
        undefined,
        Math.ceil(context.ttl / 1000),
      ),
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpProblem) {
      return sendProblem(
        reply,
        error.code,
        error.message === error.code ? undefined : error.message,
        error.errors,
        error.retryAfter,
      );
    }
    if (error instanceof ZodError) {
      return sendProblem(
        reply,
        "validation_failed",
        "Request validation failed",
        error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 413) return sendProblem(reply, "payload_too_large");
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return sendProblem(reply, "validation_failed", "Malformed request");
    }
    request.log.error(
      { err: { name: (error as Error).name, message: (error as Error).message } },
      "unhandled_error",
    );
    return sendProblem(reply, "internal");
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .type("application/problem+json")
      .send(problemBody("not_found", request.url.split("?")[0] ?? "/", request.id)),
  );

  const specs = allSpecs(options);
  const routes: string[] = [];
  app.addHook("onRoute", (route) => {
    routes.push(`${String(route.method)} ${route.url}`);
  });
  registerRoutes(app, specs, options);
  await app.ready();
  return { app, specs, routes };
}

/** Every route of the app: the business routes plus the generated OpenAPI document. */
export function allSpecs(deps: RouteDeps): RouteSpec[] {
  const specs: RouteSpec[] = buildRouteSpecs(deps);
  const openapi: RouteSpec = {
    method: "GET",
    url: "/api/v1/openapi.json",
    openapiPath: "/api/v1/openapi.json",
    summary: "This document",
    tag: "meta",
    responses: { 200: { description: "OpenAPI 3.1 document" } },
    cacheControl: "public, max-age=300",
    handler: () => Promise.resolve(buildOpenApi([...specs, openapi])),
  };
  specs.push(openapi);
  return specs;
}
