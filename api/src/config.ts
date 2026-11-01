import { readFileSync } from "node:fs";
import { z } from "zod";

/** Raw environment shape this package reads. Values are never logged. */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_FILE: z.string().min(1).optional(),
});

export interface Config {
  databaseUrl: string;
}

/**
 * Reads configuration once at startup. The connection string may come from `DATABASE_URL_FILE`
 * (Docker secret) or `DATABASE_URL` (local/dev only). Throws naming the variable, never its value.
 */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${names}`);
  }
  const { DATABASE_URL, DATABASE_URL_FILE } = parsed.data;
  const databaseUrl = DATABASE_URL_FILE
    ? readFileSync(DATABASE_URL_FILE, "utf8").trim()
    : DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing environment: DATABASE_URL or DATABASE_URL_FILE");
  return { databaseUrl };
}
