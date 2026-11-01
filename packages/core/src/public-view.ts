import type { ContentBundle } from "./schemas";

/**
 * Reduces a validated bundle to what the public site may show: published questions only, tests
 * whose questions are all published, topics that still own a test, and the passages and sources
 * those questions reference. Input order is preserved (pool order drives the seeded random quiz).
 * Shared by the seed-file loader and the database reader so both produce identical pages.
 */
export function selectPublicContent(bundle: ContentBundle): ContentBundle {
  const questions = bundle.questions.filter((q) => q.reviewStatus === "published");
  const published = new Set(questions.map((q) => q.id));
  // Hide the entire test rather than silently changing its question count.
  const tests = bundle.tests.filter((t) => t.questionIds.every((id) => published.has(id)));
  const topics = bundle.topics.filter((topic) =>
    tests.some(
      (t) => t.grade === topic.grade && t.skill === topic.skill && t.topicSlug === topic.slug,
    ),
  );
  const usedPassages = new Set(questions.map((q) => q.passageId));
  const passages = bundle.passages.filter((p) => usedPassages.has(p.id));
  const usedSources = new Set([...questions, ...passages].map((item) => item.sourceId));
  const sources = bundle.sources.filter((s) => usedSources.has(s.id));
  return { sources, passages, topics, questions, tests };
}
