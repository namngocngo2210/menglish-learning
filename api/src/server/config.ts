import { readFileSync } from "node:fs";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_FILE: z.string().min(1).optional(),
  INTERNAL_TOKEN: z.string().min(16).optional(),
  INTERNAL_TOKEN_FILE: z.string().min(1).optional(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
});

export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
  databaseUrl: string;
  /** Bearer token for /api/v1/internal/*; undefined disables those routes (403). */
  internalToken: string | undefined;
  rateLimitPerMinute: number;
}

/** Reads the server configuration once at startup. Errors name variables, never values. */
export function loadServerConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerConfig {
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
  const databaseUrl = v.DATABASE_URL_FILE
    ? readFileSync(v.DATABASE_URL_FILE, "utf8").trim()
    : v.DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing environment: DATABASE_URL or DATABASE_URL_FILE");
  const token = v.INTERNAL_TOKEN_FILE
    ? readFileSync(v.INTERNAL_TOKEN_FILE, "utf8").trim()
    : v.INTERNAL_TOKEN;
  return {
    port: v.PORT,
    host: v.HOST,
    logLevel: v.LOG_LEVEL,
    databaseUrl,
    internalToken: token === "" ? undefined : token,
    rateLimitPerMinute: v.RATE_LIMIT_PER_MINUTE,
  };
}
