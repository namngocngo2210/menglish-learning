import { classifyQuestion } from "../lib/topics/classify";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
vi.setConfig({ testTimeout: 60000 });
import { ContentBundleSchema } from "@/lib/content/types";
import { loadBundle } from "@/lib/content/load";
import { parseEntranceSlug, parseTestSlug } from "@/lib/routes";
import { buildBank, serializeBundle, isOfficialExam, ruleOnly } from "@/scripts/lib/build-bank";
const rawFragments = readdirSync("content/quarantine").filter(f => f.endsWith(".json")).sort().map(f => ContentBundleSchema.parse(JSON.parse(readFileSync(join("content/quarantine", f), "utf8"))));
const fragments = rawFragments;
const generated = () => buildBank(fragments);
it("reproduces every checked-in bank bundle byte for byte", () => {
 const output = generated(); expect(Object.keys(output).sort()).toEqual(["bank-entrance.json", "bank-grade-6.json", "bank-grade-7.json", "bank-grade-8.json", "bank-grade-9.json"]);
 for (const [file, bundle] of Object.entries(output)) expect(readFileSync(join("content/tests", file), "utf8"), file).toBe(serializeBundle(bundle));
 expect(buildBank([...fragments].reverse())).toEqual(output);
 expect(rawFragments.flatMap(f => f.questions).every(q => q.reviewStatus === "quarantine")).toBe(true);
});
it("loads at least 300 tests with unique parseable slugs and valid grade/skill membership", () => {
 const bundle = loadBundle(); expect(bundle.tests.length).toBeGreaterThanOrEqual(300);
 expect(new Set(bundle.tests.map(t => t.slug)).size).toBe(bundle.tests.length);
 const byId = new Map(bundle.questions.map(q => [q.id, q]));
 for (const t of bundle.tests) {
  expect(t.seed).toBeTruthy();
  if (!t.slug.includes("de-chinh-thuc-")) expect(Object.keys(t.optionOrder!)).toHaveLength(t.questionIds.length);
  expect(t.publishedAt).toBe("2026-10-31T00:00:00.000Z");
  expect(t.kind === "entrance10" ? parseEntranceSlug(t.slug) : parseTestSlug(t.slug)).toBeTruthy();
  for (const id of t.questionIds) {
   const q = byId.get(id)!; expect(q).toBeDefined();
   if (t.kind === "entrance10") expect([8, 9]).toContain(q.grade);
   else { expect(q.grade).toBe(t.grade); expect(q.skill).toBe(t.skill); }
  }
 }
});
it("never repeats an id within a topic set or the entrance set and prunes unused resources", () => {
 const output = generated(); const sets = new Map<string, Set<string>>();
 const all = Object.values(output); const tests = all.flatMap(b => b.tests); const questions = all.flatMap(b => b.questions);
 for (const t of tests) {
  if (t.slug.includes("de-chinh-thuc-")) continue; // fixed official papers deliberately overlap the entrance mixer
  const key = t.kind === "entrance10" ? "entrance" : `${t.grade}/${t.skill}/${t.topicSlug}`;
  const seen = sets.get(key) ?? new Set<string>();
  for (const id of t.questionIds) { expect(seen.has(id), `${key}: ${id}`).toBe(false); seen.add(id); }
  sets.set(key, seen);
 }
 const usedIds = new Set(tests.flatMap(t => t.questionIds));
 expect(questions.every(q => usedIds.has(q.id))).toBe(true);
 expect(all.flatMap(b => b.topics).every(topic => tests.some(t => t.grade === topic.grade && t.skill === topic.skill && t.topicSlug === topic.slug))).toBe(true);
 const passageIds = new Set(questions.map(q => q.passageId));
 expect(all.flatMap(b => b.passages).every(p => passageIds.has(p.id))).toBe(true);
 const sourceIds = new Set([...questions, ...all.flatMap(b => b.passages)].map(q => q.sourceId));
 expect(all.flatMap(b => b.sources).every(s => sourceIds.has(s.id))).toBe(true);
 expect(output["bank-entrance.json"].questions).toEqual([]);
 expect(questions.every(q => q.reviewStatus === "published" && q.sourceName && q.sourceUrl && q.license && q.crawledAt)).toBe(true);
});

it("records owner approval on copies while preserving every source field and quarantine input", () => {
 const before = structuredClone(fragments);
 const original = new Map(fragments.flatMap(f => f.questions).map(q => [q.id, q]));
 for (const q of Object.values(generated()).flatMap(b => b.questions)) {
  expect(q.reviewNote).toBe("owner-approved-bulk 2026-10-31");
  expect(q.reviewedAt).toBe("2026-10-31T00:00:00.000Z");
  const raw = original.get(q.id)!;
  const passage = fragments.flatMap(f => f.passages).find(p => q.passageId ? p.id === q.passageId : p.sourceId === q.sourceId && p.sourceUrl === q.sourceUrl);
  const topicSlug = q.skill === "ngu-phap" || q.skill === "tu-vung" ? classifyQuestion(raw, passage).topic ?? "tong-hop" : raw.topicSlug;
  expect(q).toEqual({ ...raw, explanation: isOfficialExam(raw) ? q.explanation : ruleOnly(raw.explanation), topicSlug, reviewStatus: "published", reviewNote: "owner-approved-bulk 2026-10-31", reviewedAt: "2026-10-31T00:00:00.000Z" });
 }
 expect(fragments).toEqual(before);
});

it("reproduces audited guard counts and excludes flagged IDs from every partition", async () => {
 const { guardQuestions } = await import("@/scripts/lib/guards");
 const raw = fragments.flatMap(f => f.questions).filter(q => !isOfficialExam(q));
 const report = guardQuestions(raw);
 expect(report.counts).toEqual({ "duplicate-options": 0, "cloze-inflection": 2, "cloze-equivalent": 0, "verb-equivalent": 0 });
 expect(report.excluded).toBe(2); expect(report.questions).toHaveLength(2587);
 expect(guardQuestions([...raw].reverse()).counts).toEqual(report.counts);
 const eligible = new Set(report.questions.map(q => q.id)); const officialIds = new Set(fragments.flatMap(f => f.questions).filter(isOfficialExam).map(q => q.id));
 const excluded = raw.filter(q => !eligible.has(q.id)).map(q => q.id).sort();
 expect(excluded).toEqual(["voa-d137037f", "voa-dae9171e"]);
 let reported = false;
 const output = buildBank(fragments, observed => { expect(observed.counts).toEqual(report.counts); reported = true; });
 expect(reported).toBe(true);
 for (const bundle of Object.values(output)) {
  const ok = (id: string) => eligible.has(id) || officialIds.has(id);
  expect(bundle.questions.every(q => ok(q.id))).toBe(true);
  expect(bundle.tests.every(t => t.questionIds.every(ok))).toBe(true);
 }
});

it("filters duplicate quarantine options before public validation and partitioning", () => {
 const source = fragments.find(f => f.questions.some(q => !isOfficialExam(q)))!;
 const official = new Set(source.questions.filter(isOfficialExam).map(q => q.id));
 const fragment = structuredClone(source); fragment.questions = fragment.questions.filter(q => !official.has(q.id));
 const q = fragment.questions[0];
 q.options[1].text = q.options[0].text.toUpperCase();
 expect(ContentBundleSchema.safeParse(fragment).success).toBe(true);
 let duplicates = 0;
 const output = buildBank([fragment], report => { duplicates = report.counts["duplicate-options"]; });
 expect(duplicates).toBe(1);
 expect(Object.values(output).flatMap(b => b.questions).some(p => p.id === q.id)).toBe(false);
 expect(Object.values(output).flatMap(b => b.tests).some(t => t.questionIds.includes(q.id))).toBe(false);
});

it("filters email invitations and recomputes passage word counts across every grade", () => {
 const withInvitations = fragments.map(fragment => ({ ...fragment, passages: fragment.passages.map(passage => ({
  ...passage, body: `${passage.body}\n\nSend us an email at learningenglish@voanews.com.`,
 })) }));
 for (const grade of [6, 7, 8, 9]) {
  // Build each grade alone because shared passages are stored only in the first bundle that uses them.
  const output = buildBank(withInvitations.map(fragment => ({ ...fragment, questions: fragment.questions.filter(q => q.grade === grade) })));
  const passages = output[`bank-grade-${grade}.json`].passages;
  expect(passages.length).toBeGreaterThan(0);
  for (const passage of passages) {
   expect(passage.body).not.toMatch(/learningenglish@voanews\.com/i);
   expect(passage.wordCount).toBe(passage.body.split(/\s+/).filter(Boolean).length);
  }
 }
});

it("publishes exactly the 111 owner-approved official exam items in fixed per-year papers", () => {
  const official = rawFragments.flatMap(f => f.questions).filter(isOfficialExam);
  expect(official).toHaveLength(111);
  const output = generated(); const all = Object.values(output);
  const published = new Map(all.flatMap(b => b.questions).map(q => [q.id, q]));
  for (const q of official) {
    const p = published.get(q.id)!; expect(p, q.id).toBeDefined();
    expect(p.reviewStatus).toBe("published"); expect(p.reviewNote).toBe("owner-approved-bulk 2026-10-31");
    expect({ ...p, explanation: "", reviewStatus: "", reviewNote: "", reviewedAt: "", topicSlug: "" }).toEqual({ ...q, explanation: "", reviewStatus: "", reviewNote: "", reviewedAt: "", topicSlug: "" });
    expect(p.explanation).not.toMatch(/chờ|ocr|scan|Hà Nội/i);
    expect(p.sourceRef).toContain("ocr-transcribed");
  }
  const papers = output["bank-entrance.json"].tests.filter(t => t.slug.includes("de-chinh-thuc-"));
  expect(papers.map(t => t.slug)).toEqual(["thi-vao-lop-10/de-chinh-thuc-2024", "thi-vao-lop-10/de-chinh-thuc-2025", "thi-vao-lop-10/de-chinh-thuc-2026"]);
  expect(papers.flatMap(t => t.questionIds).sort()).toEqual(official.map(q => q.id).sort());
  const passages = new Map(all.flatMap(b => b.passages).map(p => [p.id, p]));
  for (const t of papers) {
    let last = 0;
    for (const id of t.questionIds) { const q = published.get(id)!; if (q.passageId) expect(passages.has(q.passageId)).toBe(true); const n = Number(/Question (\d+)/.exec(q.sourceRef!)![1]); expect(n).toBeGreaterThan(last); last = n; }
  }
  expect(all.flatMap(b => b.sources).some(s => s.id.startsWith("gov-"))).toBe(true);
  // Existing topic and mixed sets never contain official items.
  const ids = new Set(official.map(q => q.id));
  for (const t of all.flatMap(b => b.tests).filter(t => t.kind !== "entrance10")) for (const id of t.questionIds) expect(ids.has(id)).toBe(false);
});
