import { ContentBundleSchema, selectPublicContent } from "@bj/core";
import type { ContentBundle } from "@bj/core";
import { z } from "zod";

const nonEmpty = z.string().min(1);
const timestamp = z.date().transform((d) => d.toISOString());

export const SourceRowSchema = z.object({
  code: nonEmpty,
  name: nonEmpty,
  base_url: nonEmpty,
  license: nonEmpty,
  attribution: nonEmpty,
});
export const TopicRowSchema = z.object({
  grade: z.number().int(),
  skill: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  description: nonEmpty,
});
export const PassageRowSchema = z.object({
  id: nonEmpty,
  source_code: nonEmpty,
  title: nonEmpty,
  body: nonEmpty,
  word_count: z.number().int(),
  level: z.number().int(),
  source_url: z.string().nullable(),
  crawled_at: timestamp.nullable(),
});
export const QuestionRowSchema = z.object({
  id: nonEmpty,
  grade: z.number().int(),
  skill: nonEmpty,
  topic_slug: nonEmpty,
  difficulty: z.number().int(),
  passage_id: z.string().nullable(),
  stem: nonEmpty,
  options: z.array(z.strictObject({ key: z.string(), text: z.string() })),
  correct_key: nonEmpty,
  explanation: nonEmpty,
  source_code: nonEmpty,
  source_url: nonEmpty,
  source_ref: z.string().nullable(),
  crawled_at: timestamp.nullable(),
});
export const TestRowSchema = z.object({
  slug: nonEmpty,
  grade: z.number().int(),
  skill: z.string().nullable(),
  topic_slug: z.string().nullable(),
  kind: nonEmpty,
  title: nonEmpty,
  seed: z.string(),
  published_at: timestamp,
});
export const TestItemRowSchema = z.object({
  test_slug: nonEmpty,
  position: z.number().int(),
  question_id: nonEmpty,
  option_order: nonEmpty,
});

export interface PublicRows {
  sources: readonly unknown[];
  topics: readonly unknown[];
  passages: readonly unknown[];
  questions: readonly unknown[];
  tests: readonly unknown[];
  testItems: readonly unknown[];
}

/**
 * Pure mapping from raw view rows (already in insertion order, test items ordered by position) to
 * the ContentBundle the web app consumes. Rows are validated, so a malformed row fails loudly
 * instead of producing a broken page; the result is validated again with ContentBundleSchema.
 */
export function buildBundle(rows: PublicRows): ContentBundle {
  const sourceRows = z.array(SourceRowSchema).parse(rows.sources);
  const sourceByCode = new Map(sourceRows.map((s) => [s.code, s]));
  const topicRows = z.array(TopicRowSchema).parse(rows.topics);
  const passageRows = z.array(PassageRowSchema).parse(rows.passages);
  const questionRows = z.array(QuestionRowSchema).parse(rows.questions);
  const testRows = z.array(TestRowSchema).parse(rows.tests);
  const itemRows = z.array(TestItemRowSchema).parse(rows.testItems);

  const itemsByTest = new Map<string, { questionId: string; optionOrder: string }[]>();
  for (const item of itemRows) {
    const list = itemsByTest.get(item.test_slug) ?? [];
    list.push({ questionId: item.question_id, optionOrder: item.option_order });
    itemsByTest.set(item.test_slug, list);
  }

  const sources = sourceRows.map((s) => ({
    id: s.code,
    name: s.name,
    baseUrl: s.base_url,
    license: s.license,
    attribution: s.attribution,
  }));
  const topics = topicRows.map((t) => ({
    grade: t.grade,
    skill: t.skill,
    slug: t.slug,
    name: t.name,
    description: t.description,
  }));
  const passages = passageRows.map((p) => {
    const source = sourceByCode.get(p.source_code);
    return {
      id: p.id,
      sourceId: p.source_code,
      title: p.title,
      body: p.body,
      ...(p.source_url === null ? {} : { sourceUrl: p.source_url }),
      ...(source === undefined ? {} : { sourceName: source.name, license: source.license }),
      ...(p.crawled_at === null ? {} : { crawledAt: p.crawled_at }),
      wordCount: p.word_count,
      level: p.level,
    };
  });
  const questions = questionRows.map((q) => {
    const source = sourceByCode.get(q.source_code);
    return {
      id: q.id,
      type: "mcq" as const,
      grade: q.grade,
      skill: q.skill,
      topicSlug: q.topic_slug,
      difficulty: q.difficulty,
      ...(q.passage_id === null ? {} : { passageId: q.passage_id }),
      stem: q.stem,
      options: q.options.map((o) => ({ key: o.key, text: o.text })),
      correctKey: q.correct_key,
      explanation: q.explanation,
      sourceId: q.source_code,
      sourceUrl: q.source_url,
      ...(q.source_ref === null ? {} : { sourceRef: q.source_ref }),
      ...(source === undefined ? {} : { sourceName: source.name, license: source.license }),
      ...(q.crawled_at === null ? {} : { crawledAt: q.crawled_at }),
      reviewStatus: "published" as const,
    };
  });
  const tests = testRows.map((t) => {
    const items = itemsByTest.get(t.slug) ?? [];
    const hasOrder = items.some((i) => i.optionOrder !== "ABCD");
    return {
      slug: t.slug,
      grade: t.grade,
      ...(t.skill === null ? {} : { skill: t.skill }),
      ...(t.topic_slug === null ? {} : { topicSlug: t.topic_slug }),
      kind: t.kind,
      title: t.title,
      questionIds: items.map((i) => i.questionId),
      publishedAt: t.published_at,
      ...(t.seed === "" ? {} : { seed: t.seed }),
      ...(hasOrder
        ? { optionOrder: Object.fromEntries(items.map((i) => [i.questionId, i.optionOrder])) }
        : {}),
    };
  });

  return selectPublicContent(
    ContentBundleSchema.parse({ sources, passages, topics, questions, tests }),
  );
}
