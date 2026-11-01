import { parseOptions } from "../db/json";
import { ContentBundleSchema } from "@bj/core";
import type { ContentBundle } from "@bj/core";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB as Database } from "@bj/db-types";

const iso = (value: Date | null): string | undefined =>
  value === null ? undefined : value.toISOString();

/**
 * Exports the PUBLISHED content as a ContentBundle in the exact shape of web/content/tests/*.json:
 * every published question and passage, every published test whose questions are all published,
 * the topics those topic-tests belong to, and the sources in use. Validated with ContentBundleSchema
 * so a snapshot can always be fed back to the web app (static fallback, blueprint §4.7) and diffed
 * against the seed JSON (import parity round trip).
 */
export async function exportSnapshot(db: Kysely<Database>): Promise<ContentBundle> {
  const questionRows = await db
    .selectFrom("questions as q")
    .innerJoin("topics as t", "t.id", "q.topic_id")
    .innerJoin("sources as s", "s.id", "q.source_id")
    .leftJoin("passages as p", "p.id", "q.passage_id")
    .select([
      "q.external_id",
      "q.grade",
      "q.skill",
      "t.slug as topic_slug",
      "q.difficulty",
      "p.external_id as passage_external_id",
      "q.stem",
      "q.options",
      "q.correct_key",
      "q.explanation",
      "s.code as source_code",
      "s.name as source_name",
      "s.license as source_license",
      "q.source_url",
      "q.source_ref",
      "q.crawled_at",
      "q.review_note",
      "q.reviewed_at",
    ])
    .where("q.review_status", "=", "published")
    .orderBy("q.grade")
    .orderBy("q.external_id")
    .execute();

  const passageRows = await db
    .selectFrom("passages as p")
    .innerJoin("sources as s", "s.id", "p.source_id")
    .select([
      "p.external_id",
      "s.code as source_code",
      "s.name as source_name",
      "s.license as source_license",
      "p.title",
      "p.body",
      "p.word_count",
      "p.level",
      "p.source_url",
      "p.crawled_at",
    ])
    .where("p.review_status", "=", "published")
    .orderBy("p.external_id")
    .execute();

  // A test is public only when every one of its questions is published.
  const testRows = await db
    .selectFrom("tests as te")
    .leftJoin("topics as t", "t.id", "te.topic_id")
    .select([
      "te.id",
      "te.slug",
      "te.grade",
      "te.skill",
      "t.slug as topic_slug",
      "te.kind",
      "te.title",
      "te.seed",
      "te.published_at",
    ])
    .where("te.review_status", "=", "published")
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("test_items as ti")
            .innerJoin("questions as q", "q.id", "ti.question_id")
            .select(sql.lit(1).as("one"))
            .whereRef("ti.test_id", "=", "te.id")
            .where("q.review_status", "<>", "published"),
        ),
      ),
    )
    .orderBy("te.grade")
    .orderBy("te.slug")
    .execute();

  const itemRows = await db
    .selectFrom("test_items as ti")
    .innerJoin("questions as q", "q.id", "ti.question_id")
    .select(["ti.test_id", "ti.position", "q.external_id as question_id", "ti.option_order"])
    .where("ti.test_id", "in", testRows.length > 0 ? testRows.map((t) => t.id) : ["0"])
    .orderBy("ti.test_id")
    .orderBy("ti.position")
    .execute();

  const itemsByTest = new Map<string, { questionId: string; optionOrder: string }[]>();
  for (const item of itemRows) {
    const list = itemsByTest.get(item.test_id) ?? [];
    list.push({ questionId: item.question_id, optionOrder: item.option_order });
    itemsByTest.set(item.test_id, list);
  }

  const tests = testRows.map((t) => {
    const items = itemsByTest.get(t.id) ?? [];
    const orders = Object.fromEntries(items.map((i) => [i.questionId, i.optionOrder]));
    const hasOrder = items.some((i) => i.optionOrder !== "ABCD");
    return {
      slug: t.slug,
      grade: t.grade,
      ...(t.skill === null ? {} : { skill: t.skill }),
      ...(t.topic_slug === null ? {} : { topicSlug: t.topic_slug }),
      kind: t.kind,
      title: t.title,
      questionIds: items.map((i) => i.questionId),
      publishedAt: (t.published_at ?? new Date(0)).toISOString(),
      ...(t.seed === "" ? {} : { seed: t.seed }),
      ...(hasOrder ? { optionOrder: orders } : {}),
    };
  });

  const topicKeys = new Set(
    tests.flatMap((t) =>
      t.skill !== undefined && t.topicSlug !== undefined
        ? [`${t.grade}/${t.skill}/${t.topicSlug}`]
        : [],
    ),
  );
  const topicRows = await db
    .selectFrom("topics")
    .select(["grade", "skill", "slug", "name", "description", "sort_order"])
    .orderBy("grade")
    .orderBy("skill")
    .orderBy("sort_order")
    .orderBy("slug")
    .execute();
  const topics = topicRows
    .filter((t) => topicKeys.has(`${t.grade}/${t.skill}/${t.slug}`))
    .map((t) => ({
      grade: t.grade,
      skill: t.skill,
      slug: t.slug,
      name: t.name,
      description: t.description,
    }));

  const usedSources = new Set([
    ...questionRows.map((q) => q.source_code),
    ...passageRows.map((p) => p.source_code),
  ]);
  const sourceRows = await db
    .selectFrom("sources")
    .select(["code", "name", "base_url", "license", "attribution"])
    .orderBy("code")
    .execute();
  const sources = sourceRows
    .filter((s) => usedSources.has(s.code))
    .map((s) => ({
      id: s.code,
      name: s.name,
      baseUrl: s.base_url,
      license: s.license,
      attribution: s.attribution,
    }));

  const questions = questionRows.map((q) => ({
    id: q.external_id,
    type: "mcq" as const,
    grade: q.grade,
    skill: q.skill,
    topicSlug: q.topic_slug,
    difficulty: q.difficulty,
    ...(q.passage_external_id === null ? {} : { passageId: q.passage_external_id }),
    stem: q.stem,
    options: parseOptions(q.options).map((o) => ({ key: o.key, text: o.text })),
    correctKey: q.correct_key,
    explanation: q.explanation,
    sourceId: q.source_code,
    sourceUrl: q.source_url,
    ...(q.source_ref === null ? {} : { sourceRef: q.source_ref }),
    sourceName: q.source_name,
    license: q.source_license,
    ...(iso(q.crawled_at) === undefined ? {} : { crawledAt: iso(q.crawled_at) }),
    reviewStatus: "published" as const,
    ...(q.review_note === null ? {} : { reviewNote: q.review_note }),
    ...(iso(q.reviewed_at) === undefined ? {} : { reviewedAt: iso(q.reviewed_at) }),
  }));

  const passages = passageRows.map((p) => ({
    id: p.external_id,
    sourceId: p.source_code,
    title: p.title,
    body: p.body,
    ...(p.source_url === null ? {} : { sourceUrl: p.source_url }),
    sourceName: p.source_name,
    license: p.source_license,
    ...(iso(p.crawled_at) === undefined ? {} : { crawledAt: iso(p.crawled_at) }),
    wordCount: p.word_count,
    level: p.level,
  }));

  return ContentBundleSchema.parse({ sources, passages, topics, questions, tests });
}
