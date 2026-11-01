import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import pg from "pg";

/** Connection string of a throwaway Postgres server, or undefined when DB tests are not enabled. */
export const ADMIN_URL: string | undefined = process.env["TEST_DATABASE_URL"];

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../db/migrations", import.meta.url));

export interface TestDb {
  url: string;
  admin: pg.Pool;
  remove(): Promise<void>;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Creates a uniquely named, fully migrated database on the test server. */
export async function createMigratedDb(): Promise<TestDb> {
  if (ADMIN_URL === undefined) throw new Error("TEST_DATABASE_URL is not set");
  const name = `bj_data_${randomBytes(6).toString("hex")}`;
  const control = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await control.query(`CREATE DATABASE ${name}`);
  await control.end();
  const url = withDatabase(ADMIN_URL, name);
  await runner({
    databaseUrl: url,
    dir: MIGRATIONS_DIR,
    direction: "up",
    count: Infinity,
    migrationsTable: "pgmigrations",
    checkOrder: true,
    singleTransaction: true,
    log: () => undefined,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });
  const admin = new pg.Pool({ connectionString: url, max: 2 });
  return {
    url,
    admin,
    remove: async () => {
      await admin.end();
      const closer = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
      await closer.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await closer.end();
    },
  };
}
