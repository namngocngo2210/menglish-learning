/** Node-only content access for server components/builds. Never import into client components.
 * Content is cached per absolute directory for the process lifetime; rebuild/restart after edits.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { ContentBundleSchema, type ContentBundle } from "./types";
import { applyOptionOrder } from "@/lib/mixer";
import { GRADES, type Grade, type Skill, SKILLS } from "@/lib/routes";
import { topicOrder } from "../topics/registry";
const cache = new Map<string, ContentBundle>();
export function loadBundle(directory?: string): ContentBundle {
 // The configurable path is intentionally opaque to tracing; next.config.ts includes default bundles.
 const dir = resolve(/* turbopackIgnore: true */ directory ?? process.env.QUESTION_CONTENT_DIR ?? join(process.cwd(), "content/tests"));
 const cached = cache.get(dir); if (cached) return cached;
 const bundle: ContentBundle = { sources: [], passages: [], topics: [], questions: [], tests: [] };
 const origins = new Map<string, string>();
 for (const file of readdirSync(/* turbopackIgnore: true */ dir).filter(f => f.endsWith(".json")).sort()) {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ dir, file), "utf8")); } catch (error) { throw new Error(`${file}: ${String(error)}`); }
  const parsed = ContentBundleSchema.safeParse(raw);
  if (!parsed.success) {
   const issues = parsed.error.issues.map(issue => {
    const index = issue.path[0] === "questions" ? issue.path[1] : undefined;
    const id = typeof index === "number" ? (raw as { questions?: { id?: string }[] }).questions?.[index]?.id : undefined;
    return `${id ? `question ${id}: ` : ""}${issue.path.join(".")}: ${issue.message}`;
   });
   throw new Error(`${file}: ${issues.join("; ")}`);
  }
  for (const key of ["sources", "passages", "topics", "questions", "tests"] as const) {
   for (const item of parsed.data[key]) {
    const id = "id" in item ? item.id : "grade" in item && "name" in item ? `${item.grade}/${item.skill}/${item.slug}` : item.slug;
    const identity = `${key}:${id}`;
    if (origins.has(identity)) throw new Error(`${file}: duplicate ${key} ${id} (first in ${origins.get(identity)})`);
    origins.set(identity, file);
   }
  }
  bundle.sources.push(...parsed.data.sources); bundle.passages.push(...parsed.data.passages); bundle.topics.push(...parsed.data.topics); bundle.questions.push(...parsed.data.questions); bundle.tests.push(...parsed.data.tests);
 }
 const fail = (key: string, message: string): never => { throw new Error(`${origins.get(key) ?? dir}: ${message}`); };
 const sources = new Set(bundle.sources.map(s => s.id));
 const passages = new Map(bundle.passages.map(p => [p.id, p]));
 const topics = new Set(bundle.topics.map(t => `${t.grade}/${t.skill}/${t.slug}`));
 const questions = new Map(bundle.questions.map(q => [q.id, q]));
 // Mixed/entrance items retain their bank classification even when that topic has no public tests.
 const mixedItems = new Set(bundle.tests.filter(t => t.kind !== "topic").flatMap(t => t.questionIds));
 for (const p of bundle.passages) if (!sources.has(p.sourceId)) fail(`passages:${p.id}`, `passage ${p.id}: unknown source ${p.sourceId}`);
 for (const q of bundle.questions) {
  if (!sources.has(q.sourceId) || (q.passageId && !passages.has(q.passageId)) || (!topics.has(`${q.grade}/${q.skill}/${q.topicSlug}`) && !mixedItems.has(q.id))) fail(`questions:${q.id}`, `question ${q.id}: invalid source, passage or topic reference`);
 }
 for (const t of bundle.tests) {
  if (t.kind !== "entrance10" && !topics.has(`${t.grade}/${t.skill}/${t.topicSlug}`)) fail(`tests:${t.slug}`, `test ${t.slug}: unknown topic`);
  for (const id of t.questionIds) {
   const q = questions.get(id);
   if (!q || (t.kind === "entrance10" ? q.grade !== 8 && q.grade !== 9 : q.grade !== t.grade || q.skill !== t.skill || (t.kind === "topic" && q.topicSlug !== t.topicSlug))) fail(`tests:${t.slug}`, `test ${t.slug}: question ${id} missing or mismatched`);
  }
 }
 bundle.questions = bundle.questions.filter(q => q.reviewStatus === "published");
 const published = new Set(bundle.questions.map(q => q.id));
 // Hide the entire test rather than silently changing its question count.
 bundle.tests = bundle.tests.filter(t => t.questionIds.every(id => published.has(id)));
 bundle.topics = bundle.topics.filter(topic => bundle.tests.some(t => t.grade === topic.grade && t.skill === topic.skill && t.topicSlug === topic.slug));
 const usedPassages = new Set(bundle.questions.map(q => q.passageId));
 bundle.passages = bundle.passages.filter(p => usedPassages.has(p.id));
 const usedSources = new Set([...bundle.questions, ...bundle.passages].map(item => item.sourceId));
 bundle.sources = bundle.sources.filter(s => usedSources.has(s.id));
 cache.set(dir, bundle); return bundle;
}
export function getGrades(): readonly Grade[] { return GRADES; }
export function getSkills(grade: Grade): Skill[] { return GRADES.includes(grade) ? [...SKILLS] : []; }
export function getTopics(grade: Grade, skill: Skill) { return loadBundle().topics.filter(t => t.grade === grade && t.skill === skill).sort((a, b) => topicOrder(skill, a.slug) - topicOrder(skill, b.slug)); }
export function getTest(slug: string) { return loadBundle().tests.find(t => t.slug === slug); }
export function getTestsForTopic(grade: Grade, skill: Skill, topicSlug: string) { return loadBundle().tests.filter(t => t.grade === grade && t.skill === skill && t.topicSlug === topicSlug); }
export function getTestWithQuestions(slug: string) {
 const test = getTest(slug); if (!test) return undefined;
 const bundle = loadBundle(); const byId = new Map(bundle.questions.map(q => [q.id, q]));
 const questions = test.questionIds.map(id => {
  const question = byId.get(id)!; const order = test.optionOrder?.[id];
  return order ? applyOptionOrder(question, order) : question;
 });
 const passageIds = new Set(questions.map(q => q.passageId));
 return { ...test, questions, passages: bundle.passages.filter(p => passageIds.has(p.id)), sources: bundle.sources.filter(s => questions.some(q => q.sourceId === s.id) || bundle.passages.some(p => passageIds.has(p.id) && p.sourceId === s.id)) };
}
export function getAllTestSlugs(): string[] { return loadBundle().tests.map(t => t.slug); }

export function getEntranceTests() { return loadBundle().tests.filter(t => t.kind === "entrance10"); }
export function getEntranceTestWithQuestions(slug: string) {
 return getTest(slug)?.kind === "entrance10" ? getTestWithQuestions(slug) : undefined;
}
