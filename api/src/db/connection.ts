import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB as Database } from "@bj/db-types";

export interface DbHandle {
  db: Kysely<Database>;
  close(): Promise<void>;
}

/** Small pool: the CLI runs one transaction at a time. bigint (int8) stays a string. */
export function connect(databaseUrl: string, max = 4): DbHandle {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max,
    statement_timeout: 120_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return {
    db,
    close: async () => {
      await db.destroy();
    },
  };
}
