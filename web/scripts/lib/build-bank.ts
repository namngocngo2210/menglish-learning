import { ContentBundleSchema, type ContentBundle, type Test, type Topic } from "../../lib/content/types";
import { partitionTests, type MixedTest } from "../../lib/mixer";
import { entranceTestPath, GRADES, SKILLS, SKILL_NAMES } from "../../lib/routes";
import { guardQuestions, type GuardReport } from "./guards";
import { stripVoaEmailCallsToAction } from "./passage-filter";
export const PUBLISHED_AT = "2026-10-31T00:00:00.000Z";
const emptyBundle = (): ContentBundle => ({ sources: [], passages: [], topics: [], questions: [], tests: [] });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const topicKey = (t: Topic) => `${t.grade}/${t.skill}/${t.slug}`;
/** Merge all fragments before resolving cross-file resources. No input object is mutated. */
export function buildBank(fragments: readonly ContentBundle[], reportGuards?: (report: GuardReport) => void): Record<string, ContentBundle> {
 const merged = emptyBundle();
 for (const fragment of fragments) {
  const parsed = ContentBundleSchema.parse(fragment);
  merged.sources.push(...parsed.sources);
  merged.passages.push(...parsed.passages);
  merged.topics.push(...parsed.topics);
  merged.questions.push(...parsed.questions);
 }
 function unique<T>(items: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
   const id = key(item);
   if (map.has(id)) throw new Error(`Duplicate bank identity: ${id}`);
   map.set(id, item);
  }
  return [...map.values()].sort((a, b) => compare(key(a), key(b)));
 }
 merged.sources = unique(merged.sources, s => s.id);
 merged.passages = unique(merged.passages, p => p.id);
 merged.topics = unique(merged.topics, topicKey);
 merged.questions = unique(merged.questions.filter(q => q.reviewStatus === "quarantine"), q => q.id);
 const guarded = guardQuestions(merged.questions);
 reportGuards?.(guarded);
 merged.questions = guarded.questions;
 const topics = merged.topics.map(t => ({ ...t, name: t.slug === "chung" ? "Tổng hợp" : t.name, description: `Bài luyện ${SKILL_NAMES[t.skill].toLowerCase()} lớp ${t.grade} chủ đề ${(t.slug === "chung" ? "Tổng hợp" : t.name).toLowerCase()}.` }));
 const tests: Test[] = [];
 function add(parts: MixedTest[], meta: (k: number) => Omit<Test, "seed" | "questionIds" | "optionOrder" | "publishedAt">) {
  parts.forEach((part, index) => tests.push({ ...meta(index + 1), ...part, publishedAt: PUBLISHED_AT }));
 }
 for (const topic of topics) {
  const pool = merged.questions.filter(q => q.grade === topic.grade && q.skill === topic.skill && q.topicSlug === topic.slug);
  if (pool.length < 10) continue;
  add(partitionTests(pool, { seedPrefix: `${topic.grade}/${topic.skill}/${topic.slug}`, size: 20, minSize: 10 }), k => ({
   slug: `lop-${topic.grade}/${topic.skill}/${topic.slug}/de-${k}`, grade: topic.grade, skill: topic.skill, topicSlug: topic.slug, kind: "topic", title: `${topic.name} - Đề ${k}`,
  }));
 }
 for (const grade of GRADES) for (const skill of SKILLS) {
  const pool = merged.questions.filter(q => q.grade === grade && q.skill === skill);
  if (pool.length < 10) continue;
  const topic: Topic = { grade, skill, slug: "tong-hop", name: `Tổng hợp ${SKILL_NAMES[skill]}`, description: `Bài luyện ${SKILL_NAMES[skill].toLowerCase()} tổng hợp lớp ${grade}.` };
  topics.push(topic);
  add(partitionTests(pool, { seedPrefix: `${grade}/${skill}/tong-hop`, size: 10, minSize: 6, difficultyMix: { 1: 1 / 3, 2: 1 / 3, 3: 1 / 3 } }), k => ({
   slug: `lop-${grade}/${skill}/tong-hop/de-${k}`, grade, skill, topicSlug: "tong-hop", kind: "mixed", title: `Tổng hợp ${SKILL_NAMES[skill]} lớp ${grade} - Đề ${k}`,
  }));
 }
 add(partitionTests(merged.questions.filter(q => q.grade === 8 || q.grade === 9), {
  seedPrefix: "thi-vao-lop-10", size: 40, minSize: 20, skillMix: { "tu-vung": .3, "ngu-phap": .3, "doc-hieu": .3, "viet-cau": .1 },
 }), k => ({ slug: entranceTestPath(k).slice(1), grade: 9, kind: "entrance10", title: `Đề luyện thi vào lớp 10 - Đề ${k}` }));
 unique(tests, t => t.slug);
 const used = new Set(tests.flatMap(t => t.questionIds));
 const questions = merged.questions.filter(q => used.has(q.id)).map(q => ({ ...q, reviewStatus: "published" as const, reviewNote: "owner-approved-bulk 2026-10-31", reviewedAt: PUBLISHED_AT }));
 const usedPassages = new Set(questions.map(q => q.passageId));
 const passages = merged.passages.filter(p => usedPassages.has(p.id)).map(p => {
  const body = stripVoaEmailCallsToAction(p.body);
  return body === p.body ? p : { ...p, body, wordCount: body.split(/\s+/).filter(Boolean).length };
 });
 const byPassage = new Map(passages.map(p => [p.id, p]));
 const bySource = new Map(merged.sources.map(s => [s.id, s]));
 for (const q of questions) {
  if (!bySource.has(q.sourceId)) throw new Error(`Question ${q.id}: missing source ${q.sourceId}`);
  if (q.passageId && !byPassage.has(q.passageId)) throw new Error(`Question ${q.id}: missing passage ${q.passageId}`);
 }
 const output: Record<string, ContentBundle> = {};
 const placedPassages = new Set<string>(); const placedSources = new Set<string>();
 for (const grade of GRADES) {
  const bundle = emptyBundle();
  bundle.questions = questions.filter(q => q.grade === grade);
  bundle.tests = tests.filter(t => t.kind !== "entrance10" && t.grade === grade).sort((a, b) => compare(a.slug, b.slug));
  bundle.topics = unique(topics.filter(topic => topic.grade === grade && bundle.tests.some(t => t.skill === topic.skill && t.topicSlug === topic.slug)), topicKey);
  const needed = new Set(bundle.questions.map(q => q.passageId));
  bundle.passages = passages.filter(p => needed.has(p.id) && !placedPassages.has(p.id));
  bundle.passages.forEach(p => placedPassages.add(p.id));
  const sources = new Set([...bundle.questions, ...bundle.passages].map(item => item.sourceId));
  for (const id of sources) if (!bySource.has(id)) throw new Error(`Missing source ${id}`);
  bundle.sources = merged.sources.filter(s => sources.has(s.id) && !placedSources.has(s.id));
  bundle.sources.forEach(s => placedSources.add(s.id));
  output[`bank-grade-${grade}.json`] = bundle;
 }
 output["bank-entrance.json"] = { ...emptyBundle(), tests: tests.filter(t => t.kind === "entrance10").sort((a, b) => compare(a.slug, b.slug)) };
 return output;
}
export function serializeBundle(bundle: ContentBundle): string { return `${JSON.stringify(bundle, null, 2)}\n`; }
