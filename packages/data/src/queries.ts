import { applyOptionOrder } from "@bj/core";
import type { DB } from "@bj/db-types";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { z } from "zod";

export interface GradeSummary {
  grade: number;
  tests: number;
  questions: number;
}

export interface TopicSummary {
  grade: number;
  skill: string;
  slug: string;
  name: string;
  description: string;
  tests: number;
}

export interface PublicQuestion {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  difficulty: number;
  passageId?: string;
}

export interface PublicPassage {
  id: string;
  title: string;
  body: string;
  wordCount: number;
  level: number;
}

export interface PublicTest {
  slug: string;
  title: string;
  grade: number;
  skill?: string;
  topicSlug?: string;
  kind: string;
  publishedAt: string;
  questions: PublicQuestion[];
  passages: PublicPassage[];
}

const OptionsSchema = z.array(z.strictObject({ key: z.string(), text: z.string() }));
const count = (value: unknown): number => z.coerce.number().int().parse(value);

/** Public tests and questions per grade (entrance tests are grade 9 tests). */
export async function listGrades(db: Kysely<DB>): Promise<GradeSummary[]> {
  const tests = await db
    .selectFrom("v_public_tests")
    .select(["grade", sql<string>`count(*)`.as("n")])
    .groupBy("grade")
    .execute();
  const questions = await db
    .selectFrom("v_public_questions")
    .select(["grade", sql<string>`count(*)`.as("n")])
    .groupBy("grade")
    .execute();
  const testsByGrade = new Map(tests.map((r) => [r.grade, count(r.n)]));
  const questionsByGrade = new Map(questions.map((r) => [r.grade, count(r.n)]));
  const grades = [...new Set([...testsByGrade.keys(), ...questionsByGrade.keys()])].filter(
    (g): g is number => g !== null,
  );
  return grades
    .sort((a, b) => a - b)
    .map((grade) => ({
      grade,
      tests: testsByGrade.get(grade) ?? 0,
      questions: questionsByGrade.get(grade) ?? 0,
    }));
}

/** Topics that own at least one public test, in the seed order. */
export async function listTopics(
  db: Kysely<DB>,
  filter: { grade?: number; skill?: string },
): Promise<TopicSummary[]> {
  let query = db
    .selectFrom("v_public_topics as t")
    .innerJoin("v_public_tests as te", (join) =>
      join
        .onRef("te.grade", "=", "t.grade")
        .onRef("te.skill", "=", "t.skill")
        .onRef("te.topic_slug", "=", "t.slug"),
    )
    .select([
      "t.grade",
      "t.skill",
      "t.slug",
      "t.name",
      "t.description",
      "t.sort_key",
      sql<string>`count(*)`.as("tests"),
    ])
    .groupBy(["t.grade", "t.skill", "t.slug", "t.name", "t.description", "t.sort_key"]);
  if (filter.grade !== undefined) query = query.where("t.grade", "=", filter.grade);
  if (filter.skill !== undefined) query = query.where("t.skill", "=", filter.skill);
  const rows = await query.orderBy("t.sort_key").execute();
  return rows.map((r) => ({
    grade: z.number().int().parse(r.grade),
    skill: z.string().parse(r.skill),
    slug: z.string().parse(r.slug),
    name: z.string().parse(r.name),
    description: z.string().parse(r.description),
    tests: count(r.tests),
  }));
}

/** One public test with its questions (option order already applied) and passages. Four queries, no N+1. */
export async function getTest(db: Kysely<DB>, slug: string): Promise<PublicTest | undefined> {
  const test = await db
    .selectFrom("v_public_tests")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (!test) return undefined;
  const items = await db
    .selectFrom("v_public_test_items")
    .select(["question_id", "option_order"])
    .where("test_slug", "=", slug)
    .orderBy("position")
    .execute();
  const ids = items.map((i) => z.string().parse(i.question_id));
  const rows =
    ids.length === 0
      ? []
      : await db.selectFrom("v_public_questions").selectAll().where("id", "in", ids).execute();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const questions: PublicQuestion[] = items.map((item) => {
    const row = byId.get(item.question_id);
    if (!row) throw new Error(`Test ${slug} references an unpublished question`);
    const ordered = applyOptionOrder(
      {
        options: OptionsSchema.parse(row.options).map((o) => ({
          key: o.key as "A" | "B" | "C" | "D",
          text: o.text,
        })),
        correctKey: z.enum(["A", "B", "C", "D"]).parse(row.correct_key),
      },
      z.string().parse(item.option_order),
    );
    return {
      id: z.string().parse(row.id),
      stem: z.string().parse(row.stem),
      options: ordered.options,
      correctKey: ordered.correctKey,
      explanation: z.string().parse(row.explanation),
      difficulty: z.number().int().parse(row.difficulty),
      ...(row.passage_id === null ? {} : { passageId: row.passage_id }),
    };
  });
  const passageIds = [...new Set(questions.flatMap((q) => (q.passageId ? [q.passageId] : [])))];
  const passageRows =
    passageIds.length === 0
      ? []
      : await db
          .selectFrom("v_public_passages")
          .selectAll()
          .where("id", "in", passageIds)
          .orderBy("sort_key")
          .execute();
  return {
    slug: z.string().parse(test.slug),
    title: z.string().parse(test.title),
    grade: z.number().int().parse(test.grade),
    ...(test.skill === null ? {} : { skill: test.skill }),
    ...(test.topic_slug === null ? {} : { topicSlug: test.topic_slug }),
    kind: z.string().parse(test.kind),
    publishedAt: z.date().parse(test.published_at).toISOString(),
    questions,
    passages: passageRows.map((p) => ({
      id: z.string().parse(p.id),
      title: z.string().parse(p.title),
      body: z.string().parse(p.body),
      wordCount: z.number().int().parse(p.word_count),
      level: z.number().int().parse(p.level),
    })),
  };
}
