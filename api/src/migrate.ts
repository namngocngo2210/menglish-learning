import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations", import.meta.url));

export type Direction = "up" | "down";

export interface MigrateOptions {
  direction: Direction;
  /** Number of migrations to apply/revert; Infinity = all (up) — down requires an explicit count or "all". */
  count?: number;
  log?: (message: string) => void;
}

/** Runs the SQL migrations in db/migrations inside one transaction. Returns the migration names run. */
export async function migrate(databaseUrl: string, options: MigrateOptions): Promise<string[]> {
  const log = options.log ?? (() => undefined);
  const result = await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: options.direction,
    count: options.count ?? Infinity,
    migrationsTable: "pgmigrations",
    checkOrder: true,
    singleTransaction: true,
    // node-pg-migrate's logger interface; route to the caller instead of the console.
    log: (message: string) => {
      log(message);
    },
    logger: {
      debug: () => undefined,
      info: (message: string) => {
        log(message);
      },
      warn: (message: string) => {
        log(message);
      },
      error: (message: string) => {
        log(message);
      },
    },
  });
  return result.map((m) => m.name);
}
