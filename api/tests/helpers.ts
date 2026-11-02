import { randomBytes } from "node:crypto";
import pg from "pg";
import { migrate } from "../src/migrate";

/** Connection string of a throwaway Postgres server, or undefined when DB tests are not enabled. */
export const ADMIN_URL: string | undefined = process.env["TEST_DATABASE_URL"];

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

/** Creates an empty, uniquely named database on the test server. */
export async function createTestDb(): Promise<TestDb> {
  if (ADMIN_URL === undefined) throw new Error("TEST_DATABASE_URL is not set");
  const name = `bj_test_${randomBytes(6).toString("hex")}`;
  const control = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await control.query(`CREATE DATABASE ${name}`);
  await control.end();
  const url = withDatabase(ADMIN_URL, name);
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

export async function createMigratedDb(): Promise<TestDb> {
  const db = await createTestDb();
  await migrate(db.url, { direction: "up" });
  return db;
}

/** Test usernames are derived from the old email fixtures: "parent3@example.test" -> "parent3". */
export const uname = (email: string): string =>
  email
    .split("@")[0]!
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .padEnd(3, "x");
