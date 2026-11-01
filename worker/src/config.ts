import { readFileSync } from "node:fs";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_FILE: z.string().min(1).optional(),
  EDGE_PURGE_URL: z.url().optional(),
  EDGE_PURGE_TOKEN: z.string().min(16).optional(),
  EDGE_PURGE_TOKEN_FILE: z.string().min(1).optional(),
  CRAWL_DATA_DIR: z.string().min(1).default("/tmp/crawl"),
  POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(5000),
  HEARTBEAT_MS: z.coerce.number().int().min(100).default(15_000),
  JOB_STALE_SECONDS: z.coerce.number().int().min(10).default(300),
  MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(8081),
});

export interface WorkerConfig {
  databaseUrl: string;
  edgePurgeUrl: string | undefined;
  edgePurgeToken: string | undefined;
  crawlDataDir: string;
  pollIntervalMs: number;
  heartbeatMs: number;
  jobStaleSeconds: number;
  maxAttempts: number;
  healthPort: number;
}

const fromFile = (path: string | undefined, inline: string | undefined): string | undefined =>
  path === undefined ? inline : readFileSync(path, "utf8").trim();

/** Reads configuration once at startup. Errors name variables, never values. */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WorkerConfig {
  const picked: Record<string, string> = {};
  for (const key of Object.keys(EnvSchema.shape)) {
    const value = env[key];
    if (value !== undefined && value !== "") picked[key] = value;
  }
  const parsed = EnvSchema.safeParse(picked);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid environment: ${names}`);
  }
  const v = parsed.data;
  const databaseUrl = fromFile(v.DATABASE_URL_FILE, v.DATABASE_URL);
  if (!databaseUrl) throw new Error("Missing environment: DATABASE_URL or DATABASE_URL_FILE");
  return {
    databaseUrl,
    edgePurgeUrl: v.EDGE_PURGE_URL,
    edgePurgeToken: fromFile(v.EDGE_PURGE_TOKEN_FILE, v.EDGE_PURGE_TOKEN),
    crawlDataDir: v.CRAWL_DATA_DIR,
    pollIntervalMs: v.POLL_INTERVAL_MS,
    heartbeatMs: v.HEARTBEAT_MS,
    jobStaleSeconds: v.JOB_STALE_SECONDS,
    maxAttempts: v.MAX_ATTEMPTS,
    healthPort: v.HEALTH_PORT,
  };
}
