import { ContentBundleSchema, type ContentBundle, type Test, type Topic, type Question, type Passage } from "../../lib/content/types";
import { partitionTests, type MixedTest } from "../../lib/mixer";
import { entranceTestPath, officialEntranceSlug, GRADES, SKILLS, SKILL_NAMES } from "../../lib/routes";
import { guardQuestions, type GuardReport } from "./guards";
import { stripVoaEmailCallsToAction } from "./passage-filter";
import { classifyQuestion } from "../../lib/topics/classify";
import { TOPIC_REGISTRY } from "../../lib/topics/registry";
export function classifyEligibleQuestions(questions: readonly Question[], passages: readonly Passage[]) {
 const byPassage = new Map(passages.map(p => [p.id, p]));
 // Cloze questions omit passageId; provenance still identifies their source article.
 const byArticle = new Map([...passages].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(p => [`${p.sourceId}/${p.sourceUrl}`, p]));
 return questions.map(question => {
  const passage = question.passageId ? byPassage.get(question.passageId) : byArticle.get(`${question.sourceId}/${question.sourceUrl}`);
  const classification = classifyQuestion(question, passage);
  return { question: question.skill === "ngu-phap" || question.skill === "tu-vung" ? { ...question, topicSlug: classification.topic ?? "tong-hop" } : question, classification };
 });
}
export const PUBLISHED_AT = "2026-10-31T00:00:00.000Z";
const emptyBundle = (): ContentBundle => ({ sources: [], passages: [], topics: [], questions: [], tests: [] });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const topicKey = (t: Topic) => `${t.grade}/${t.skill}/${t.slug}`;
/** Merge all fragments before resolving cross-file resources. No input object is mutated. */
/**
 * Official exam items (Sở GD&ĐT Hà Nội entrance papers, transcribed from scans: sourceRef contains
 * "ocr-transcribed"). The owner approved all of them on 2026-10-31. They are published verbatim: they skip the
 * VOA-oriented guards, keep their paper order in fixed per-year tests and also join the topic/mixed/entrance pools.
 */
export const isOfficialExam = (q: { sourceRef?: string }) => (q.sourceRef ?? "").split("|").map(part => part.trim()).includes("ocr-transcribed");
const officialRef = (q: { sourceRef?: string }) => {
 const parts = (q.sourceRef ?? "").split("|").map(part => part.trim());
 return { year: parts[0], number: Number((parts.find(p => /^Question \d+$/.test(p)) ?? "").replace("Question ", "")) };
};
/** The owner-facing review note replaces the internal "awaiting approval" explanation; the key is unchanged. */
const officialExplanation = (q: Question) => `Đáp án đúng là ${q.correctKey} (theo đáp án chính thức của đề thi).`;
export function buildBank(fragments: readonly ContentBundle[], reportGuards?: (report: GuardReport) => void): Record<string, ContentBundle> {
 const merged = emptyBundle();
 for (const fragment of fragments) {
  const parsed = ContentBundleSchema.parse(fragment);
  merged.sources.push(...parsed.sources);
  merged.passages.push(...parsed.passages);
  // Official fragments restate topics (e.g. 9/doc-hieu/chung) that the VOA fragments already define.
  for (const topic of parsed.topics) if (!merged.topics.some(t => topicKey(t) === topicKey(topic))) merged.topics.push(topic);
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
 const official = merged.questions.filter(isOfficialExam);
 const guarded = guardQuestions(merged.questions.filter(q => !isOfficialExam(q)));
 reportGuards?.(guarded);
 merged.questions = classifyEligibleQuestions([...guarded.questions, ...official], merged.passages).map(entry => entry.question).sort((a, b) => compare(a.id, b.id));
 const officialIds = new Set(official.map(q => q.id));
 // Official items feed only the fixed per-year papers and the entrance mixer, so existing topic/mixed sets stay stable.
 const regular = merged.questions.filter(q => !officialIds.has(q.id));
 const topics = merged.topics.filter(t => t.skill !== "ngu-phap" && t.skill !== "tu-vung").map(t => ({ ...t, name: t.slug === "chung" ? "Tổng hợp" : t.name, description: `Bài luyện ${SKILL_NAMES[t.skill].toLowerCase()} lớp ${t.grade} chủ đề ${(t.slug === "chung" ? "Tổng hợp" : t.name).toLowerCase()}.` }));
 for (const grade of GRADES) for (const skill of ["ngu-phap", "tu-vung"] as const) {
  for (const def of TOPIC_REGISTRY[skill]) {
   topics.push({ grade, skill, slug: def.slug, name: def.name, description: `${def.summary} Lớp ${grade}.` });
  }
 }
 const tests: Test[] = [];
 function add(parts: MixedTest[], meta: (k: number) => Omit<Test, "seed" | "questionIds" | "optionOrder" | "publishedAt">) {
  parts.forEach((part, index) => tests.push({ ...meta(index + 1), ...part, publishedAt: PUBLISHED_AT }));
 }
 for (const topic of topics) {
  const pool = regular.filter(q => q.grade === topic.grade && q.skill === topic.skill && q.topicSlug === topic.slug);
  if (pool.length < 10) continue;
  add(partitionTests(pool, { seedPrefix: `${topic.grade}/${topic.skill}/${topic.slug}`, size: 20, minSize: 10 }), k => ({
   slug: `lop-${topic.grade}/${topic.skill}/${topic.slug}/de-${k}`, grade: topic.grade, skill: topic.skill, topicSlug: topic.slug, kind: "topic", title: `${topic.name} - Đề ${k}`,
  }));
 }
 for (const grade of GRADES) for (const skill of SKILLS) {
  const pool = regular.filter(q => q.grade === grade && q.skill === skill);
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
 // Fixed official papers: one test per exam year, questions in paper order (reading passages stay adjacent), original option order.
 const papers = new Map<string, Question[]>();
 for (const q of official) { const year = officialRef(q).year; papers.set(year, [...(papers.get(year) ?? []), q]); }
 for (const [year, items] of [...papers].sort(([a], [b]) => compare(a, b))) {
  items.sort((a, b) => officialRef(a).number - officialRef(b).number);
  tests.push({ slug: officialEntranceSlug(year), grade: 9, kind: "entrance10", title: `Đề thi vào lớp 10 môn Tiếng Anh Hà Nội năm ${year}`, seed: `thi-vao-lop-10/chinh-thuc/${year}`, questionIds: items.map(q => q.id), publishedAt: PUBLISHED_AT });
 }
 unique(tests, t => t.slug);
 const used = new Set(tests.flatMap(t => t.questionIds));
 const questions = merged.questions.filter(q => used.has(q.id)).map(q => ({ ...q, ...(officialIds.has(q.id) ? { explanation: officialExplanation(q) } : {}), reviewStatus: "published" as const, reviewNote: "owner-approved-bulk 2026-10-31", reviewedAt: PUBLISHED_AT }));
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
