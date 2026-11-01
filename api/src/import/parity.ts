import { parseOptions } from "../db/json";
import { createHash } from "node:crypto";
import type { ContentBundle } from "@bj/core";
import type { Kysely } from "kysely";
import type { DB as Database } from "@bj/db-types";
import type { LayerFile } from "./files";
import type { ImportPlan } from "./plan";

/** Everything the import-parity table (blueprint §3.6) compares, computed from either side. */
export interface ParitySummary {
  counts: Record<string, number>;
  byGradeSkillStatus: Record<string, number>;
  byTopicStatus: Record<string, number>;
  /** sha256 over the sorted `externalId:textHash` lines of all questions. */
  textDigest: string;
  questionHashes: Record<string, string>;
  /** `slug` -> hash of the ordered `questionId:optionOrder` list. */
  testHashes: Record<string, string>;
}

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

export interface QuestionText {
  stem: string;
  options: readonly { key: string; text: string }[];
  correctKey: string;
  explanation: string;
}

/** Hash of the learner-visible text of one question (stem, options in original order, key, explanation). */
export function questionTextHash(q: QuestionText): string {
  return sha(
    JSON.stringify([q.stem, q.options.map((o) => [o.key, o.text]), q.correctKey, q.explanation]),
  );
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function finish(
  counts: Record<string, number>,
  byGradeSkillStatus: Record<string, number>,
  byTopicStatus: Record<string, number>,
  questionHashes: Record<string, string>,
  testHashes: Record<string, string>,
): ParitySummary {
  const lines = Object.entries(questionHashes)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, hash]) => `${id}:${hash}`);
  return {
    counts,
    byGradeSkillStatus,
    byTopicStatus,
    textDigest: sha(lines.join("\n")),
    questionHashes,
    testHashes,
  };
}

/** What the database MUST contain after importing this plan. */
export function summarizePlan(plan: ImportPlan): ParitySummary {
  const counts: Record<string, number> = {
    sources: plan.sources.length,
    topics: plan.topics.length,
    passages: plan.passages.length,
    "passages.published": plan.passages.filter((p) => p.reviewStatus === "published").length,
    questions: plan.questions.length,
    tests: plan.tests.length,
    test_items: plan.tests.reduce((n, t) => n + t.items.length, 0),
  };
  const byGradeSkillStatus: Record<string, number> = {};
  const byTopicStatus: Record<string, number> = {};
  const questionHashes: Record<string, string> = {};
  for (const q of plan.questions) {
    bump(counts, `questions.${q.reviewStatus}`);
    bump(counts, `questions.${q.reviewStatus}@${q.sourceCode}`);
    bump(byGradeSkillStatus, `${q.grade}/${q.skill}/${q.reviewStatus}`);
    bump(byTopicStatus, `${q.topicKey}/${q.reviewStatus}`);
    questionHashes[q.externalId] = questionTextHash(q);
  }
  const testHashes: Record<string, string> = {};
  for (const t of plan.tests) {
    testHashes[t.slug] = sha(
      t.items.map((i) => `${i.questionExternalId}:${i.optionOrder}`).join(","),
    );
  }
  return finish(counts, byGradeSkillStatus, byTopicStatus, questionHashes, testHashes);
}

/** What the database actually contains, read with queries independent of the importer. */
export async function summarizeDatabase(db: Kysely<Database>): Promise<ParitySummary> {
  const count = async (
    table: "sources" | "topics" | "passages" | "tests" | "test_items",
  ): Promise<number> => {
    const row = await db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  };
  const counts: Record<string, number> = {
    sources: await count("sources"),
    topics: await count("topics"),
    passages: await count("passages"),
    tests: await count("tests"),
    test_items: await count("test_items"),
  };
  const publishedPassages = await db
    .selectFrom("passages")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("review_status", "=", "published")
    .executeTakeFirstOrThrow();
  counts["passages.published"] = Number(publishedPassages.n);

  const rows = await db
    .selectFrom("questions as q")
    .innerJoin("topics as t", "t.id", "q.topic_id")
    .innerJoin("sources as s", "s.id", "q.source_id")
    .select([
      "q.external_id",
      "q.grade",
      "q.skill",
      "q.review_status",
      "t.slug as topic_slug",
      "s.code as source_code",
      "q.stem",
      "q.options",
      "q.correct_key",
      "q.explanation",
    ])
    .execute();
  counts["questions"] = rows.length;
  const byGradeSkillStatus: Record<string, number> = {};
  const byTopicStatus: Record<string, number> = {};
  const questionHashes: Record<string, string> = {};
  for (const q of rows) {
    bump(counts, `questions.${q.review_status}`);
    bump(counts, `questions.${q.review_status}@${q.source_code}`);
    bump(byGradeSkillStatus, `${q.grade}/${q.skill}/${q.review_status}`);
    bump(byTopicStatus, `${q.grade}/${q.skill}/${q.topic_slug}/${q.review_status}`);
    const options = parseOptions(q.options);
    questionHashes[q.external_id] = questionTextHash({
      stem: q.stem,
      options,
      correctKey: q.correct_key,
      explanation: q.explanation,
    });
  }

  const items = await db
    .selectFrom("test_items as ti")
    .innerJoin("tests as te", "te.id", "ti.test_id")
    .innerJoin("questions as q", "q.id", "ti.question_id")
    .select(["te.slug", "ti.position", "q.external_id", "ti.option_order"])
    .orderBy("te.slug")
    .orderBy("ti.position")
    .execute();
  const lists = new Map<string, string[]>();
  for (const i of items) {
    const list = lists.get(i.slug) ?? [];
    list.push(`${i.external_id}:${i.option_order}`);
    lists.set(i.slug, list);
  }
  const testHashes: Record<string, string> = {};
  for (const [slug, list] of lists) testHashes[slug] = sha(list.join(","));
  return finish(counts, byGradeSkillStatus, byTopicStatus, questionHashes, testHashes);
}

function diffCounters(
  label: string,
  expected: Record<string, number>,
  actual: Record<string, number>,
  out: string[],
): void {
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const e = expected[key] ?? 0;
    const a = actual[key] ?? 0;
    if (e !== a) out.push(`${label} ${key}: expected ${e}, database ${a}`);
  }
}

function diffHashes(
  label: string,
  expected: Record<string, string>,
  actual: Record<string, string>,
  out: string[],
): void {
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const e = expected[key];
    const a = actual[key];
    if (e === undefined) out.push(`${label} ${key}: not in seed JSON but in database`);
    else if (a === undefined) out.push(`${label} ${key}: in seed JSON but missing from database`);
    else if (e !== a) out.push(`${label} ${key}: content hash differs`);
  }
}

/** Empty result = parity 0 differences. */
export function diffSummaries(expected: ParitySummary, actual: ParitySummary): string[] {
  const out: string[] = [];
  diffCounters("count", expected.counts, actual.counts, out);
  diffCounters(
    "per grade/skill/status",
    expected.byGradeSkillStatus,
    actual.byGradeSkillStatus,
    out,
  );
  diffCounters("per topic/status", expected.byTopicStatus, actual.byTopicStatus, out);
  diffHashes("question", expected.questionHashes, actual.questionHashes, out);
  diffHashes("test", expected.testHashes, actual.testHashes, out);
  if (expected.textDigest !== actual.textDigest) out.push("text digest of all questions differs");
  return out;
}

// ---------------------------------------------------------------- snapshot round trip

const DATE_KEYS = new Set(["crawledAt", "reviewedAt", "publishedAt"]);

/** Canonical form: sorted object keys, undefined dropped, ISO dates normalised to ms precision. */
function canonical(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((v) => canonical(v));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonical(v, k);
    }
    return out;
  }
  if (typeof value === "string" && DATE_KEYS.has(key)) return new Date(value).toISOString();
  return value;
}

const keyOf = {
  sources: (x: { id: string }) => x.id,
  passages: (x: { id: string }) => x.id,
  questions: (x: { id: string }) => x.id,
  tests: (x: { slug: string }) => x.slug,
  topics: (x: { grade: number; skill: string; slug: string }) => `${x.grade}/${x.skill}/${x.slug}`,
} as const;

export interface RoundTripResult {
  differences: number;
  samples: string[];
}

/**
 * Deep-compares the snapshot exported from the database with the seed JSON of the published layer
 * (content/tests/*.json merged). Order inside a test (`questionIds`, `optionOrder`) and inside a
 * question (`options`) is significant; entity order is not.
 */
export function compareSnapshot(
  snapshot: ContentBundle,
  files: readonly LayerFile[],
): RoundTripResult {
  const expected: ContentBundle = {
    sources: [],
    passages: [],
    topics: [],
    questions: [],
    tests: [],
  };
  for (const file of files) {
    if (file.layer !== "published") continue;
    expected.sources.push(...file.bundle.sources);
    expected.passages.push(...file.bundle.passages);
    expected.topics.push(...file.bundle.topics);
    expected.questions.push(...file.bundle.questions);
    expected.tests.push(...file.bundle.tests);
  }
  const samples: string[] = [];
  let differences = 0;
  const note = (message: string): void => {
    differences += 1;
    if (samples.length < 20) samples.push(message);
  };
  for (const entity of ["sources", "passages", "topics", "questions", "tests"] as const) {
    const keyFn = keyOf[entity] as (x: unknown) => string;
    const want = new Map<string, string>();
    for (const item of expected[entity]) want.set(keyFn(item), JSON.stringify(canonical(item)));
    const have = new Map<string, string>();
    for (const item of snapshot[entity]) have.set(keyFn(item), JSON.stringify(canonical(item)));
    for (const [key, text] of want) {
      const got = have.get(key);
      if (got === undefined) note(`${entity} ${key}: in seed JSON, missing from snapshot`);
      else if (got !== text) note(`${entity} ${key}: differs ${firstDifference(text, got)}`);
    }
    for (const key of have.keys()) {
      if (!want.has(key)) note(`${entity} ${key}: in snapshot, missing from seed JSON`);
    }
  }
  return { differences, samples };
}

function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return `at char ${i}: seed ...${a.slice(Math.max(0, i - 30), i + 40)}... vs snapshot ...${b.slice(Math.max(0, i - 30), i + 40)}...`;
}
