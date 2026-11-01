import type { ContentBundle } from "@bj/core";
import type { DB } from "@bj/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { buildBundle } from "./bundle";
import { getTest, listGrades, listTopics } from "./queries";
import type { GradeSummary, PublicTest, TopicSummary } from "./queries";

export interface PublicReaderOptions {
  connectionString: string;
  /** Maximum pooled connections (blueprint §4.4: web uses 5). */
  poolMax?: number;
}

export interface PublicReader {
  /** One consistent snapshot of everything the public site shows. */
  loadBundle(): Promise<ContentBundle>;
  grades(): Promise<GradeSummary[]>;
  topics(filter: { grade?: number; skill?: string }): Promise<TopicSummary[]>;
  test(slug: string): Promise<PublicTest | undefined>;
  /** Cheap liveness probe of the database connection (readiness). */
  ping(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Read-only reader over the `v_public_*` views. It never touches a base table, so it works with
 * the `bj_web` role (SELECT on the views only). Bulk reads run in a single REPEATABLE READ,
 * READ ONLY transaction so a publish in the middle cannot produce an inconsistent bundle.
 */
export function createPublicReader(options: PublicReaderOptions): PublicReader {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.poolMax ?? 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 1_500,
    statement_timeout: 2_000,
  });
  // An idle client dies when postgres restarts; the next query reconnects. Without a listener Node would exit.
  pool.on("error", () => undefined);
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

  return {
    async loadBundle() {
      const rows = await db
        .transaction()
        .setIsolationLevel("repeatable read")
        .execute(async (trx) => {
          await sql`SET TRANSACTION READ ONLY`.execute(trx);
          await sql`SET LOCAL statement_timeout = '10s'`.execute(trx);
          const sources = await trx
            .selectFrom("v_public_sources")
            .selectAll()
            .orderBy("sort_key")
            .execute();
          const topics = await trx
            .selectFrom("v_public_topics")
            .selectAll()
            .orderBy("sort_key")
            .execute();
          const passages = await trx
            .selectFrom("v_public_passages")
            .selectAll()
            .orderBy("sort_key")
            .execute();
          const questions = await trx
            .selectFrom("v_public_questions")
            .selectAll()
            .orderBy("sort_key")
            .execute();
          const tests = await trx
            .selectFrom("v_public_tests")
            .selectAll()
            .orderBy("sort_key")
            .execute();
          const testItems = await trx
            .selectFrom("v_public_test_items")
            .selectAll()
            .orderBy("test_slug")
            .orderBy("position")
            .execute();
          return { sources, topics, passages, questions, tests, testItems };
        });
      return buildBundle(rows);
    },
    grades: () => listGrades(db),
    topics: (filter) => listTopics(db, filter),
    test: (slug) => getTest(db, slug),
    async ping() {
      await sql`SELECT 1`.execute(db);
    },
    async close() {
      await db.destroy();
    },
  };
}
