import { getTopicDef, topicOrder } from "@bj/core";
import type { OptionKey, Passage, Question, Source, Test, Topic } from "@bj/core";
import type { LayerFile } from "./files";
import { parseSourceRef } from "./provenance";

export type PlannedReviewStatus =
  "quarantine" | "draft" | "in_review" | "published" | "rejected" | "archived";

export interface PlannedSource {
  code: string;
  name: string;
  baseUrl: string;
  license: string;
  attribution: string;
}

export interface PlannedTopic {
  grade: number;
  skill: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  /** true when no bundle declares the topic; it exists only through question classification. */
  derived: boolean;
}

export interface PlannedPassage {
  externalId: string;
  sourceCode: string;
  title: string;
  body: string;
  wordCount: number;
  level: number;
  sourceUrl: string | null;
  crawledAt: string | null;
  reviewStatus: PlannedReviewStatus;
  reviewedAt: string | null;
  publishedAt: string | null;
}

export interface PlannedQuestion {
  externalId: string;
  grade: number;
  skill: string;
  topicKey: string;
  difficulty: number;
  passageExternalId: string | null;
  stem: string;
  options: { key: OptionKey; text: string }[];
  correctKey: OptionKey;
  explanation: string;
  sourceCode: string;
  sourceUrl: string;
  sourceRef: string | null;
  provenance: object;
  crawledAt: string | null;
  reviewStatus: PlannedReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
}

export interface PlannedTestItem {
  questionExternalId: string;
  optionOrder: string;
}

export interface PlannedTest {
  slug: string;
  grade: number;
  skill: string | null;
  topicKey: string | null;
  kind: "topic" | "mixed" | "entrance10";
  title: string;
  seed: string;
  publishedAt: string;
  items: PlannedTestItem[];
}

export interface ImportPlan {
  sources: PlannedSource[];
  topics: PlannedTopic[];
  passages: PlannedPassage[];
  questions: PlannedQuestion[];
  tests: PlannedTest[];
}

export class PlanError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(
      `Import plan is inconsistent (${problems.length} problem(s)):\n${problems.slice(0, 20).join("\n")}`,
    );
    this.name = "PlanError";
    this.problems = problems;
  }
}

export const topicKey = (grade: number, skill: string, slug: string): string =>
  `${grade}/${skill}/${slug}`;

const IDENTITY_ORDER = "ABCD";
const MAX_SORT_ORDER = 9999;

const iso = (value: string | undefined): string | null =>
  value === undefined ? null : new Date(value).toISOString();

/** Later layer wins field by field; an absent optional field never erases an earlier value. */
function overlay<T extends object>(base: T | undefined, next: T): T {
  if (base === undefined) return next;
  const defined = Object.fromEntries(
    Object.entries(next).filter(([, value]) => value !== undefined),
  );
  return { ...base, ...defined };
}

/**
 * Merged items in the order the public site shows them: first the published layer in its file order
 * (so pool/list order equals the seed JSON), then quarantine-only items in quarantine order. The
 * database ids (and the views' sort_key) follow this order on a fresh import.
 */
function publishedFirst<T extends { id: string }>(
  merged: ReadonlyMap<string, T>,
  files: readonly LayerFile[],
  pick: (bundle: LayerFile["bundle"]) => readonly { id: string }[],
): T[] {
  const ordered = new Map<string, T>();
  for (const file of files) {
    if (file.layer !== "published") continue;
    for (const { id } of pick(file.bundle)) {
      const item = merged.get(id);
      if (item !== undefined && !ordered.has(id)) ordered.set(id, item);
    }
  }
  for (const [id, item] of merged) if (!ordered.has(id)) ordered.set(id, item);
  return [...ordered.values()];
}

function mergeById<T extends { id: string }>(layers: readonly (readonly T[])[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const items of layers) {
    for (const item of items) out.set(item.id, overlay(out.get(item.id), item));
  }
  return out;
}

/**
 * Pure merge of the seed JSON into the relational shape.
 *  - quarantine layer first, published layer second: published overrides (blueprint §3.6 #2);
 *  - topics referenced only through question classification are derived (blueprint §3.6 #1);
 *  - a passage is published iff at least one of its questions is published (#4);
 *  - `published_at` of a published question is its `reviewedAt`.
 * Throws PlanError listing every broken reference.
 */
export function buildPlan(files: readonly LayerFile[]): ImportPlan {
  const problems: string[] = [];
  const bundles = files.map((f) => f.bundle);

  for (const file of files) {
    if (file.layer === "quarantine" && file.bundle.tests.length > 0) {
      problems.push(`${file.name}: quarantine files must not contain tests`);
    }
  }

  const sourceMap = mergeById(bundles.map((b) => b.sources));
  const passageMap = mergeById(bundles.map((b) => b.passages));
  const questionMap = mergeById(bundles.map((b) => b.questions));

  const declared = new Map<string, Topic>();
  for (const bundle of bundles) {
    for (const t of bundle.topics) {
      const key = topicKey(t.grade, t.skill, t.slug);
      declared.set(key, overlay(declared.get(key), t));
    }
  }

  const testMap = new Map<string, Test>();
  for (const file of files) {
    if (file.layer !== "published") continue;
    for (const t of file.bundle.tests) {
      if (testMap.has(t.slug)) problems.push(`duplicate test slug ${t.slug} (${file.name})`);
      testMap.set(t.slug, t);
    }
  }

  // Topics: declared + derived from questions.
  const topics = new Map<string, PlannedTopic>();
  for (const [key, t] of declared) {
    topics.set(key, {
      grade: t.grade,
      skill: t.skill,
      slug: t.slug,
      name: t.name,
      description: t.description,
      sortOrder: Math.min(topicOrder(t.skill, t.slug), MAX_SORT_ORDER),
      derived: false,
    });
  }
  for (const q of questionMap.values()) {
    const key = topicKey(q.grade, q.skill, q.topicSlug);
    if (topics.has(key)) continue;
    topics.set(key, {
      grade: q.grade,
      skill: q.skill,
      slug: q.topicSlug,
      name: getTopicDef(q.skill, q.topicSlug)?.name ?? q.topicSlug,
      description: "",
      sortOrder: Math.min(topicOrder(q.skill, q.topicSlug), MAX_SORT_ORDER),
      derived: true,
    });
  }

  const questions: PlannedQuestion[] = [];
  const publishedAtByPassage = new Map<string, string>();
  for (const q of publishedFirst(questionMap, files, (b) => b.questions)) {
    if (!sourceMap.has(q.sourceId)) problems.push(`question ${q.id}: unknown source ${q.sourceId}`);
    if (q.passageId !== undefined && !passageMap.has(q.passageId)) {
      problems.push(`question ${q.id}: unknown passage ${q.passageId}`);
    }
    const reviewedAt = iso(q.reviewedAt);
    if (q.reviewStatus === "published" && reviewedAt === null) {
      problems.push(`question ${q.id}: published without reviewedAt`);
    }
    if (q.reviewStatus === "published" && q.passageId !== undefined && reviewedAt !== null) {
      const previous = publishedAtByPassage.get(q.passageId);
      if (previous === undefined || Date.parse(reviewedAt) > Date.parse(previous)) {
        publishedAtByPassage.set(q.passageId, reviewedAt);
      }
    }
    questions.push(planQuestion(q, reviewedAt));
  }

  const passages: PlannedPassage[] = [];
  for (const p of publishedFirst(passageMap, files, (b) => b.passages)) {
    if (!sourceMap.has(p.sourceId)) problems.push(`passage ${p.id}: unknown source ${p.sourceId}`);
    passages.push(planPassage(p, publishedAtByPassage.get(p.id) ?? null));
  }

  const tests: PlannedTest[] = [];
  for (const t of testMap.values()) {
    const key =
      t.topicSlug !== undefined && t.skill !== undefined
        ? topicKey(t.grade, t.skill, t.topicSlug)
        : null;
    if (key !== null && !topics.has(key)) problems.push(`test ${t.slug}: unknown topic ${key}`);
    const items = t.questionIds.map((id) => {
      if (!questionMap.has(id)) problems.push(`test ${t.slug}: unknown question ${id}`);
      return { questionExternalId: id, optionOrder: t.optionOrder?.[id] ?? IDENTITY_ORDER };
    });
    tests.push({
      slug: t.slug,
      grade: t.grade,
      skill: t.skill ?? null,
      topicKey: key,
      kind: t.kind,
      title: t.title,
      seed: t.seed ?? "",
      publishedAt: new Date(t.publishedAt).toISOString(),
      items,
    });
  }

  if (problems.length > 0) throw new PlanError(problems);
  return {
    sources: publishedFirst(sourceMap, files, (b) => b.sources).map(planSource),
    topics: [...topics.values()],
    passages,
    questions,
    tests,
  };
}

function planSource(s: Source): PlannedSource {
  return {
    code: s.id,
    name: s.name,
    baseUrl: s.baseUrl,
    license: s.license,
    attribution: s.attribution,
  };
}

function planPassage(p: Passage, publishedAt: string | null): PlannedPassage {
  return {
    externalId: p.id,
    sourceCode: p.sourceId,
    title: p.title,
    body: p.body,
    wordCount: p.wordCount,
    level: p.level,
    sourceUrl: p.sourceUrl ?? null,
    crawledAt: iso(p.crawledAt),
    reviewStatus: publishedAt === null ? "quarantine" : "published",
    reviewedAt: publishedAt,
    publishedAt,
  };
}

function planQuestion(q: Question, reviewedAt: string | null): PlannedQuestion {
  return {
    externalId: q.id,
    grade: q.grade,
    skill: q.skill,
    topicKey: topicKey(q.grade, q.skill, q.topicSlug),
    difficulty: q.difficulty,
    passageExternalId: q.passageId ?? null,
    stem: q.stem,
    options: q.options.map((o) => ({ key: o.key, text: o.text })),
    correctKey: q.correctKey,
    explanation: q.explanation,
    sourceCode: q.sourceId,
    sourceUrl: q.sourceUrl,
    sourceRef: q.sourceRef ?? null,
    provenance: parseSourceRef(q.sourceRef),
    crawledAt: iso(q.crawledAt),
    reviewStatus: q.reviewStatus,
    reviewNote: q.reviewNote ?? null,
    reviewedAt,
    publishedAt: q.reviewStatus === "published" ? reviewedAt : null,
  };
}
