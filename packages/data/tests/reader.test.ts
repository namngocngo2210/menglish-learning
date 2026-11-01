import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createPublicReader } from "../src/reader";
import type { PublicReader } from "../src/reader";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const OPTIONS = JSON.stringify([
  { key: "A", text: "a" },
  { key: "B", text: "b" },
  { key: "C", text: "c" },
  { key: "D", text: "d" },
]);

async function seed(db: pg.Pool): Promise<void> {
  await db.query(`INSERT INTO sources (code, name, base_url, license, attribution)
    VALUES ('voa', 'VOA', 'https://learningenglish.voanews.com', 'Public domain', 'VOA')`);
  await db.query(`INSERT INTO topics (grade, skill, slug, name, description, sort_order)
    VALUES (6, 'ngu-phap', 'thi-hien-tai-don', 'Thì hiện tại đơn', 'Mô tả', 1),
           (6, 'ngu-phap', 'ngoai-le', 'Chủ đề ẩn', 'Mô tả', 2)`);
  await db.query(`INSERT INTO passages (external_id, source_id, title, body, word_count, level,
                                         source_url, review_status, published_at)
    SELECT 'voa-p-1', id, 'Bài đọc', 'Nội dung bài đọc', 3, 1, 'https://example.org/p', 'published', now()
    FROM sources`);
  const question = (
    id: string,
    status: string,
    topic: string,
    passage: boolean,
  ): string => `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, passage_id, stem, options,
      correct_key, explanation, source_id, source_url, review_status, published_at)
    SELECT '${id}', 6, 'ngu-phap', t.id, 1, ${passage ? "(SELECT id FROM passages LIMIT 1)" : "NULL"},
      'Câu ${id}', '${OPTIONS}', 'B', 'Giải thích', s.id, 'https://example.org/q', '${status}',
      ${status === "published" ? "now()" : "NULL"}
    FROM topics t, sources s WHERE t.slug = '${topic}'`;
  await db.query(question("q1", "published", "thi-hien-tai-don", true));
  await db.query(question("q2", "published", "thi-hien-tai-don", false));
  await db.query(question("q3", "draft", "ngoai-le", false));
  await db.query(`INSERT INTO tests (slug, grade, skill, topic_id, kind, title, seed, review_status, published_at)
    SELECT 'lop-6/ngu-phap/thi-hien-tai-don/de-1', 6, 'ngu-phap', t.id, 'topic', 'Đề 1', 'seed-1', 'published', now()
    FROM topics t WHERE t.slug = 'thi-hien-tai-don'`);
  await db.query(`INSERT INTO tests (slug, grade, skill, topic_id, kind, title, review_status, published_at)
    SELECT 'lop-6/ngu-phap/ngoai-le/de-1', 6, 'ngu-phap', t.id, 'topic', 'Đề ẩn', 'published', now()
    FROM topics t WHERE t.slug = 'ngoai-le'`);
  await db.query(`INSERT INTO test_items (test_id, position, question_id, option_order)
    SELECT te.id, 1, q.id, 'BADC' FROM tests te, questions q
    WHERE te.slug = 'lop-6/ngu-phap/thi-hien-tai-don/de-1' AND q.external_id = 'q2'`);
  await db.query(`INSERT INTO test_items (test_id, position, question_id, option_order)
    SELECT te.id, 2, q.id, 'ABCD' FROM tests te, questions q
    WHERE te.slug = 'lop-6/ngu-phap/thi-hien-tai-don/de-1' AND q.external_id = 'q1'`);
  await db.query(`INSERT INTO test_items (test_id, position, question_id, option_order)
    SELECT te.id, 1, q.id, 'ABCD' FROM tests te, questions q
    WHERE te.slug = 'lop-6/ngu-phap/ngoai-le/de-1' AND q.external_id = 'q3'`);
}

describe.skipIf(ADMIN_URL === undefined)("createPublicReader", () => {
  let db: TestDb;
  let reader: PublicReader;
  let webUrl: string;

  beforeAll(async () => {
    db = await createMigratedDb();
    await seed(db.admin);
    await db.admin.query("CREATE ROLE bj_data_web LOGIN PASSWORD 'throwaway' IN ROLE bj_web");
    const url = new URL(db.url);
    url.username = "bj_data_web";
    url.password = "throwaway";
    webUrl = url.toString();
    reader = createPublicReader({ connectionString: webUrl, poolMax: 2 });
  });

  afterAll(async () => {
    await reader.close();
    await db.admin.query("DROP ROLE bj_data_web");
    await db.remove();
  });

  it("returns a validated bundle with only public content, in insertion order", async () => {
    const bundle = await reader.loadBundle();
    expect(bundle.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(bundle.tests.map((t) => t.slug)).toEqual(["lop-6/ngu-phap/thi-hien-tai-don/de-1"]);
    expect(bundle.topics.map((t) => t.slug)).toEqual(["thi-hien-tai-don"]);
    expect(bundle.passages.map((p) => p.id)).toEqual(["voa-p-1"]);
    expect(bundle.sources.map((s) => s.id)).toEqual(["voa"]);
  });

  it("orders test questions by position and keeps the option order", async () => {
    const bundle = await reader.loadBundle();
    const test = bundle.tests[0];
    expect(test?.questionIds).toEqual(["q2", "q1"]);
    expect(test?.optionOrder).toEqual({ q2: "BADC", q1: "ABCD" });
    expect(test?.seed).toBe("seed-1");
  });

  it("maps provenance fields of questions and passages", async () => {
    const bundle = await reader.loadBundle();
    const first = bundle.questions[0];
    expect(first?.passageId).toBe("voa-p-1");
    expect(first?.sourceName).toBe("VOA");
    expect(first?.reviewStatus).toBe("published");
    expect(bundle.passages[0]?.license).toBe("Public domain");
  });

  it("answers ping", async () => {
    await expect(reader.ping()).resolves.toBeUndefined();
  });

  it("works as bj_web but bj_web cannot read base tables", async () => {
    const client = new pg.Client({ connectionString: webUrl });
    await client.connect();
    try {
      await expect(client.query("SELECT * FROM questions")).rejects.toThrow(/permission denied/);
      await expect(client.query("SELECT * FROM v_public_questions")).resolves.toBeDefined();
    } finally {
      await client.end();
    }
  });

  it("fails fast with a connection error when the database is unreachable", async () => {
    const broken = createPublicReader({
      connectionString: "postgres://nobody:x@127.0.0.1:1/none",
      poolMax: 1,
    });
    await expect(broken.ping()).rejects.toThrow();
    await broken.close();
  });
});
