import { readFileSync } from "node:fs";
import { z } from "zod";

const flag = z.enum(["true", "false"]).transform((v) => v === "true");

const EnvSchema = z.strictObject({
  EDGE_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  UPSTREAM_URL: z.url().default("http://127.0.0.1:3000"),
  INTERNAL_TOKEN: z.string().min(16).optional(),
  INTERNAL_TOKEN_FILE: z.string().min(1).optional(),
  HTML_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(64 * 1024 * 1024),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  MAX_CONCURRENT_RENDERS: z.coerce.number().int().positive().default(16),
  MAX_RENDER_QUEUE: z.coerce.number().int().min(0).default(64),
  WARM_ENABLED: flag.default(true),
  SPAWN_NEXT: flag.default(true),
});

export interface EdgeConfig {
  port: number;
  upstream: URL;
  /** Bearer/refresh token for /_purge; undefined disables purge (403). */
  token: string | undefined;
  maxBytes: number;
  upstreamTimeoutMs: number;
  maxConcurrentRenders: number;
  maxRenderQueue: number;
  warmEnabled: boolean;
  spawnNext: boolean;
}

/**
 * Reads the edge configuration once at startup. Errors name the variables, never their values.
 * Only the variables listed in EnvSchema are looked at (the process environment holds many others).
 */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EdgeConfig {
  const picked: Record<string, string> = {};
  for (const key of Object.keys(EnvSchema.shape)) {
    const value = env[key];
    if (value !== undefined && value !== "") picked[key] = value;
  }
  const parsed = EnvSchema.safeParse(picked);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${names}`);
  }
  const v = parsed.data;
  const token = v.INTERNAL_TOKEN_FILE
    ? readFileSync(v.INTERNAL_TOKEN_FILE, "utf8").trim()
    : v.INTERNAL_TOKEN;
  return {
    port: v.EDGE_PORT,
    upstream: new URL(v.UPSTREAM_URL),
    token: token === "" ? undefined : token,
    maxBytes: v.HTML_MAX_BYTES,
    upstreamTimeoutMs: v.UPSTREAM_TIMEOUT_MS,
    maxConcurrentRenders: v.MAX_CONCURRENT_RENDERS,
    maxRenderQueue: v.MAX_RENDER_QUEUE,
    warmEnabled: v.WARM_ENABLED,
    spawnNext: v.SPAWN_NEXT,
  };
}
