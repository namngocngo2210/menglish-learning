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
  REPORT_SALT: z.string().min(16).optional(),
  REPORT_SALT_FILE: z.string().min(1).optional(),
  SESSION_HMAC_KEY: z.string().min(32).optional(),
  SESSION_HMAC_KEY_FILE: z.string().min(1).optional(),
  TOTP_ENC_KEY: z.string().min(32).optional(),
  TOTP_ENC_KEY_FILE: z.string().min(1).optional(),
  ADMIN_ORIGIN: z.url().optional(),
  ACCOUNTS_ENABLED: z.enum(["true", "false"]).default("false"),
  USER_SESSION_HMAC_KEY: z.string().min(32).optional(),
  USER_SESSION_HMAC_KEY_FILE: z.string().min(1).optional(),
  ACCOUNTS_ORIGIN: z.url().optional(),
  ADMIN_DIST: z.string().min(1).optional(),
  TRUST_PROXY: z.string().min(1).optional(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
});

export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
  databaseUrl: string;
  /** Bearer token for /api/v1/internal/*; undefined disables those routes (403). */
  internalToken: string | undefined;
  /** HMAC secret for audit/report hashes; undefined disables the CMS API. */
  reportSalt: string | undefined;
  /** Admin auth settings; undefined (any of the three missing) leaves admin routes deny-all. */
  adminAuth: { hmacKey: string; totpKey: Buffer; origin: string } | undefined;
  /** ADMIN_DIST: directory of the built admin SPA; unset = /admin is not served. */
  adminDist: string | undefined;
  /** Parent accounts; undefined unless ACCOUNTS_ENABLED=true (default off: no routes, nothing visible). */
  accounts: { hmacKey: string; origin: string } | undefined;
  rateLimitPerMinute: number;
  /** TRUST_PROXY: "true" or a proxy IP/CIDR list; unset = do not trust X-Forwarded-For. */
  trustProxy: boolean | string;
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
  const salt = v.REPORT_SALT_FILE ? readFileSync(v.REPORT_SALT_FILE, "utf8").trim() : v.REPORT_SALT;
  const read = (file: string | undefined, plain: string | undefined): string | undefined => {
    const value = file ? readFileSync(file, "utf8").trim() : plain;
    return value === "" ? undefined : value;
  };
  const hmacKey = read(v.SESSION_HMAC_KEY_FILE, v.SESSION_HMAC_KEY);
  const totpKey = read(v.TOTP_ENC_KEY_FILE, v.TOTP_ENC_KEY);
  if (totpKey !== undefined && Buffer.from(totpKey, "base64").length !== 32)
    throw new Error("Invalid environment: TOTP_ENC_KEY (base64 of 32 bytes)");
  const userKey = read(v.USER_SESSION_HMAC_KEY_FILE, v.USER_SESSION_HMAC_KEY);
  let accounts: ServerConfig["accounts"];
  if (v.ACCOUNTS_ENABLED === "true") {
    if (userKey === undefined || v.ACCOUNTS_ORIGIN === undefined)
      throw new Error(
        "Missing environment: USER_SESSION_HMAC_KEY or USER_SESSION_HMAC_KEY_FILE, ACCOUNTS_ORIGIN (required by ACCOUNTS_ENABLED)",
      );
    // Admin and parent are different principals: a shared HMAC key would make their hashes interchangeable.
    if (userKey === hmacKey)
      throw new Error(
        "Invalid environment: USER_SESSION_HMAC_KEY must differ from SESSION_HMAC_KEY",
      );
    accounts = { hmacKey: userKey, origin: new URL(v.ACCOUNTS_ORIGIN).origin };
  }
  return {
    accounts,
    adminAuth:
      hmacKey && totpKey && v.ADMIN_ORIGIN
        ? {
            hmacKey,
            totpKey: Buffer.from(totpKey, "base64"),
            origin: new URL(v.ADMIN_ORIGIN).origin,
          }
        : undefined,
    adminDist: v.ADMIN_DIST,
    port: v.PORT,
    host: v.HOST,
    logLevel: v.LOG_LEVEL,
    databaseUrl,
    internalToken: token === "" ? undefined : token,
    reportSalt: salt === "" ? undefined : salt,
    rateLimitPerMinute: v.RATE_LIMIT_PER_MINUTE,
    trustProxy:
      v.TRUST_PROXY === undefined ? false : v.TRUST_PROXY === "true" ? true : v.TRUST_PROXY,
  };
}
