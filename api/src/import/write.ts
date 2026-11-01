import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { DB as Database } from "@bj/db-types";
import type { ImportPlan } from "./plan";

export interface TableReport {
  planned: number;
  inserted: number;
  updated: number;
  /** Already identical, or protected because a CMS edit bumped `version` above 1. */
  unchanged: number;
}

export interface ImportReport {
  dryRun: boolean;
  durationMs: number;
  sources: TableReport;
  topics: TableReport;
  passages: TableReport;
  questions: TableReport;
  tests: TableReport;
  testItems: { planned: number; inserted: number; deleted: number; testsChanged: number };
}

const CHUNK = 400;

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `(t.a, t.b) IS DISTINCT FROM (excluded.a, excluded.b)`: skips no-op updates so reruns touch nothing. */
function changed(table: string, columns: readonly string[]) {
  const current = sql.join(columns.map((c) => sql.ref(`${table}.${c}`)));
  const incoming = sql.join(columns.map((c) => sql.ref(`excluded.${c}`)));
  return sql<boolean>`(${current}) IS DISTINCT FROM (${incoming})`;
}

/** Rows edited through the CMS (version > 1) are never overwritten by the seed importer. */
function editable(table: string) {
  return sql<boolean>`${sql.ref(`${table}.version`)} = 1`;
}

interface Upserted {
  inserted: number;
  updated: number;
}

function tally(rows: readonly { inserted: boolean }[], into: Upserted): void {
  for (const row of rows) {
    if (row.inserted) into.inserted += 1;
    else into.updated += 1;
  }
}

const INSERTED = sql<boolean>`(xmax = 0)`.as("inserted");

class DryRunRollback extends Error {
  constructor(readonly report: ImportReport) {
    super("dry run");
  }
}

/** Applies the plan in ONE transaction; idempotent. With `dryRun` the transaction is rolled back. */
export async function applyPlan(
  db: Kysely<Database>,
  plan: ImportPlan,
  options: { dryRun?: boolean } = {},
): Promise<ImportReport> {
  const dryRun = options.dryRun ?? false;
  const started = performance.now();
  try {
    const report = await db.transaction().execute(async (trx) => {
      const result = await run(trx, plan);
      const full: ImportReport = {
        ...result,
        dryRun,
        durationMs: Math.round(performance.now() - started),
      };
      if (dryRun) throw new DryRunRollback(full);
      return full;
    });
    return report;
  } catch (error) {
    if (error instanceof DryRunRollback) return error.report;
    throw error;
  }
}

type Counts = Omit<ImportReport, "dryRun" | "durationMs">;

async function run(trx: Transaction<Database>, plan: ImportPlan): Promise<Counts> {
  const sources = await upsertSources(trx, plan);
  const sourceIds = await idMap(trx.selectFrom("sources").select(["code as key", "id"]).execute());

  const topics = await upsertTopics(trx, plan);
  const topicRows = await trx
    .selectFrom("topics")
    .select(["grade", "skill", "slug", "id"])
    .execute();
  const topicIds = new Map(topicRows.map((t) => [`${t.grade}/${t.skill}/${t.slug}`, t.id]));

  const passages = await upsertPassages(trx, plan, sourceIds);
  const passageIds = await idMap(
    trx.selectFrom("passages").select(["external_id as key", "id"]).execute(),
  );

  const questions = await upsertQuestions(trx, plan, { sourceIds, topicIds, passageIds });
  const questionIds = await idMap(
    trx.selectFrom("questions").select(["external_id as key", "id"]).execute(),
  );

  const tests = await upsertTests(trx, plan, topicIds);
  const testItems = await syncTestItems(trx, plan, questionIds);
  return { sources, topics, passages, questions, tests, testItems };
}

async function idMap(rows: Promise<{ key: string; id: string }[]>): Promise<Map<string, string>> {
  return new Map((await rows).map((r) => [r.key, r.id]));
}

function report(planned: number, counts: Upserted): TableReport {
  return { planned, ...counts, unchanged: planned - counts.inserted - counts.updated };
}

async function upsertSources(trx: Transaction<Database>, plan: ImportPlan): Promise<TableReport> {
  const counts: Upserted = { inserted: 0, updated: 0 };
  for (const batch of chunks(plan.sources)) {
    const rows = await trx
      .insertInto("sources")
      .values(
        batch.map((s) => ({
          code: s.code,
          name: s.name,
          base_url: s.baseUrl,
          license: s.license,
          attribution: s.attribution,
        })),
      )
      .onConflict((oc) =>
        oc
          .column("code")
          .doUpdateSet((eb) => ({
            name: eb.ref("excluded.name"),
            base_url: eb.ref("excluded.base_url"),
            license: eb.ref("excluded.license"),
            attribution: eb.ref("excluded.attribution"),
          }))
          .where(changed("sources", ["name", "base_url", "license", "attribution"])),
      )
      .returning(INSERTED)
      .execute();
    tally(rows, counts);
  }
  return report(plan.sources.length, counts);
}

async function upsertTopics(trx: Transaction<Database>, plan: ImportPlan): Promise<TableReport> {
  const counts: Upserted = { inserted: 0, updated: 0 };
  for (const batch of chunks(plan.topics)) {
    const rows = await trx
      .insertInto("topics")
      .values(
        batch.map((t) => ({
          grade: t.grade,
          skill: t.skill,
          slug: t.slug,
          name: t.name,
          description: t.description,
          sort_order: t.sortOrder,
        })),
      )
      .onConflict((oc) =>
        oc
          .columns(["grade", "skill", "slug"])
          .doUpdateSet((eb) => ({
            name: eb.ref("excluded.name"),
            description: eb.ref("excluded.description"),
            sort_order: eb.ref("excluded.sort_order"),
          }))
          .where(changed("topics", ["name", "description", "sort_order"])),
      )
      .returning(INSERTED)
      .execute();
    tally(rows, counts);
  }
  return report(plan.topics.length, counts);
}

async function upsertPassages(
  trx: Transaction<Database>,
  plan: ImportPlan,
  sourceIds: ReadonlyMap<string, string>,
): Promise<TableReport> {
  const counts: Upserted = { inserted: 0, updated: 0 };
  const cols = [
    "source_id",
    "title",
    "body",
    "word_count",
    "level",
    "source_url",
    "crawled_at",
    "review_status",
    "reviewed_at",
    "published_at",
  ] as const;
  for (const batch of chunks(plan.passages)) {
    const rows = await trx
      .insertInto("passages")
      .values(
        batch.map((p) => ({
          external_id: p.externalId,
          source_id: required(sourceIds, p.sourceCode, `source of passage ${p.externalId}`),
          title: p.title,
          body: p.body,
          word_count: p.wordCount,
          level: p.level,
          source_url: p.sourceUrl,
          crawled_at: p.crawledAt,
          review_status: p.reviewStatus,
          review_note: null,
          reviewed_at: p.reviewedAt,
          published_at: p.publishedAt,
        })),
      )
      .onConflict((oc) =>
        oc
          .column("external_id")
          .doUpdateSet((eb) => Object.fromEntries(cols.map((c) => [c, eb.ref(`excluded.${c}`)])))
          .where(sql<boolean>`${editable("passages")} AND ${changed("passages", cols)}`),
      )
      .returning(INSERTED)
      .execute();
    tally(rows, counts);
  }
  return report(plan.passages.length, counts);
}

async function upsertQuestions(
  trx: Transaction<Database>,
  plan: ImportPlan,
  ids: {
    sourceIds: ReadonlyMap<string, string>;
    topicIds: ReadonlyMap<string, string>;
    passageIds: ReadonlyMap<string, string>;
  },
): Promise<TableReport> {
  const counts: Upserted = { inserted: 0, updated: 0 };
  const cols = [
    "grade",
    "skill",
    "topic_id",
    "difficulty",
    "passage_id",
    "stem",
    "options",
    "correct_key",
    "explanation",
    "source_id",
    "source_url",
    "source_ref",
    "provenance",
    "crawled_at",
    "review_status",
    "review_note",
    "reviewed_at",
    "published_at",
  ] as const;
  for (const batch of chunks(plan.questions)) {
    const rows = await trx
      .insertInto("questions")
      .values(
        batch.map((q) => ({
          external_id: q.externalId,
          grade: q.grade,
          skill: q.skill,
          topic_id: required(ids.topicIds, q.topicKey, `topic of question ${q.externalId}`),
          difficulty: q.difficulty,
          passage_id:
            q.passageExternalId === null
              ? null
              : required(
                  ids.passageIds,
                  q.passageExternalId,
                  `passage of question ${q.externalId}`,
                ),
          stem: q.stem,
          options: JSON.stringify(q.options),
          correct_key: q.correctKey,
          explanation: q.explanation,
          source_id: required(ids.sourceIds, q.sourceCode, `source of question ${q.externalId}`),
          source_url: q.sourceUrl,
          source_ref: q.sourceRef,
          provenance: JSON.stringify(q.provenance),
          crawled_at: q.crawledAt,
          review_status: q.reviewStatus,
          review_note: q.reviewNote,
          reviewed_at: q.reviewedAt,
          published_at: q.publishedAt,
        })),
      )
      .onConflict((oc) =>
        oc
          .column("external_id")
          .doUpdateSet((eb) => Object.fromEntries(cols.map((c) => [c, eb.ref(`excluded.${c}`)])))
          .where(sql<boolean>`${editable("questions")} AND ${changed("questions", cols)}`),
      )
      .returning(INSERTED)
      .execute();
    tally(rows, counts);
  }
  return report(plan.questions.length, counts);
}

async function upsertTests(
  trx: Transaction<Database>,
  plan: ImportPlan,
  topicIds: ReadonlyMap<string, string>,
): Promise<TableReport> {
  const counts: Upserted = { inserted: 0, updated: 0 };
  const cols = [
    "grade",
    "skill",
    "topic_id",
    "kind",
    "title",
    "seed",
    "review_status",
    "published_at",
  ] as const;
  for (const batch of chunks(plan.tests)) {
    const rows = await trx
      .insertInto("tests")
      .values(
        batch.map((t) => ({
          slug: t.slug,
          grade: t.grade,
          skill: t.skill,
          topic_id:
            t.topicKey === null ? null : required(topicIds, t.topicKey, `topic of test ${t.slug}`),
          kind: t.kind,
          title: t.title,
          seed: t.seed,
          review_status: "published" as const,
          published_at: t.publishedAt,
        })),
      )
      .onConflict((oc) =>
        oc
          .column("slug")
          .doUpdateSet((eb) => Object.fromEntries(cols.map((c) => [c, eb.ref(`excluded.${c}`)])))
          .where(sql<boolean>`${editable("tests")} AND ${changed("tests", cols)}`),
      )
      .returning(INSERTED)
      .execute();
    tally(rows, counts);
  }
  return report(plan.tests.length, counts);
}

async function syncTestItems(
  trx: Transaction<Database>,
  plan: ImportPlan,
  questionIds: ReadonlyMap<string, string>,
): Promise<Counts["testItems"]> {
  const result = { planned: 0, inserted: 0, deleted: 0, testsChanged: 0 };
  const tests = await trx.selectFrom("tests").select(["id", "slug", "version"]).execute();
  const testBySlug = new Map(tests.map((t) => [t.slug, t]));
  const existing = await trx
    .selectFrom("test_items")
    .select(["test_id", "position", "question_id", "option_order"])
    .orderBy("test_id")
    .orderBy("position")
    .execute();
  const existingByTest = new Map<string, string[]>();
  for (const row of existing) {
    const list = existingByTest.get(row.test_id) ?? [];
    list.push(`${row.position}:${row.question_id}:${row.option_order}`);
    existingByTest.set(row.test_id, list);
  }

  for (const planned of plan.tests) {
    result.planned += planned.items.length;
    const test = testBySlug.get(planned.slug);
    if (!test) throw new Error(`test ${planned.slug} missing after upsert`);
    const desired = planned.items.map((item, position) => ({
      test_id: test.id,
      position,
      question_id: required(
        questionIds,
        item.questionExternalId,
        `question in test ${planned.slug}`,
      ),
      option_order: item.optionOrder,
    }));
    const signature = desired.map((d) => `${d.position}:${d.question_id}:${d.option_order}`);
    const current = existingByTest.get(test.id) ?? [];
    if (current.length === signature.length && current.every((s, i) => s === signature[i]))
      continue;
    if (test.version > 1 && current.length > 0) continue; // edited in the CMS: keep its items
    if (current.length > 0) {
      await trx.deleteFrom("test_items").where("test_id", "=", test.id).execute();
      result.deleted += current.length;
    }
    for (const batch of chunks(desired)) {
      await trx.insertInto("test_items").values(batch).execute();
    }
    result.inserted += desired.length;
    result.testsChanged += 1;
  }
  return result;
}

function required(map: ReadonlyMap<string, string>, key: string, what: string): string {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Cannot resolve ${what} (${key})`);
  return value;
}
