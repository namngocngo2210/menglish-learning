import { z } from "zod";
import { ProblemSchema } from "./schemas";
import type { RouteSpec } from "./routes";

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: Record<string, unknown>;
}

const json = (schema: z.ZodType): unknown =>
  z.toJSONSchema(schema, { io: "output", unrepresentable: "any" });

/** OpenAPI 3.1 document generated from the route specs (zod is the single source; no hand-written file). */
export function buildOpenApi(specs: readonly RouteSpec[], version = "1.0.0"): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  for (const spec of specs) {
    const parameters: unknown[] = [];
    if (spec.query) {
      const schema = json(spec.query) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      for (const [name, value] of Object.entries(schema.properties ?? {})) {
        parameters.push({
          name,
          in: "query",
          required: schema.required?.includes(name) ?? false,
          schema: value,
        });
      }
    }
    if (spec.params) {
      parameters.push({ name: "slug", in: "path", required: true, schema: { type: "string" } });
    }
    const responses: Record<string, unknown> = {};
    for (const [status, response] of Object.entries(spec.responses)) {
      const isError = Number(status) >= 400;
      const schema = isError
        ? { $ref: "#/components/schemas/Problem" }
        : response.schema
          ? json(response.schema)
          : undefined;
      responses[status] = {
        description: response.description,
        ...(schema === undefined
          ? {}
          : {
              content: { [isError ? "application/problem+json" : "application/json"]: { schema } },
            }),
      };
    }
    const path = (paths[spec.openapiPath] ??= {});
    path[spec.method.toLowerCase()] = {
      summary: spec.summary,
      tags: [spec.tag],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(spec.auth === "internal-token" ? { security: [{ internalToken: [] }] } : {}),
      responses,
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "BeeJunior API", version },
    paths,
    components: {
      securitySchemes: { internalToken: { type: "http", scheme: "bearer" } },
      schemas: { Problem: json(ProblemSchema) },
    },
  };
}

export interface CompatIssue {
  kind: "path_removed" | "method_removed" | "status_removed";
  where: string;
}

/**
 * Additive-only rule for /api/v1 (standards §3): reports removed paths, methods and response
 * status codes between a baseline document (from main) and the current one.
 */
export function breakingChanges(
  baseline: OpenApiDocument,
  current: OpenApiDocument,
): CompatIssue[] {
  const issues: CompatIssue[] = [];
  for (const [path, methods] of Object.entries(baseline.paths)) {
    const now = current.paths[path];
    if (!now) {
      issues.push({ kind: "path_removed", where: path });
      continue;
    }
    for (const [method, operation] of Object.entries(methods)) {
      const next = now[method] as { responses?: Record<string, unknown> } | undefined;
      if (!next) {
        issues.push({ kind: "method_removed", where: `${method.toUpperCase()} ${path}` });
        continue;
      }
      const before = (operation as { responses?: Record<string, unknown> }).responses ?? {};
      for (const status of Object.keys(before)) {
        if (!(status in (next.responses ?? {}))) {
          issues.push({
            kind: "status_removed",
            where: `${method.toUpperCase()} ${path} ${status}`,
          });
        }
      }
    }
  }
  return issues;
}
