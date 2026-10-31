import { expect, it } from "vitest";
import { VOCAB_LEXICON } from "../lib/topics/lexicon";
import { TOPIC_REGISTRY, getTopicDef, isConcreteTopic } from "../lib/topics/registry";
it("has unique, substantial handwritten topic definitions and reserves tong-hop", () => {
 const paragraphs: string[] = [];
 for (const [skill, defs] of Object.entries(TOPIC_REGISTRY)) {
  expect(new Set(defs.map(d => d.slug)).size).toBe(defs.length);
  for (const d of defs) {
   expect(d.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
   expect(d.slug).not.toBe("tong-hop"); expect(d.name.length).toBeGreaterThan(0);
   expect(d.summary.length).toBeLessThanOrEqual(140); expect(d.summary.length).toBeGreaterThan(0);
   expect(d.intro.length).toBeGreaterThanOrEqual(2); expect(d.intro.length).toBeLessThanOrEqual(3);
   expect(d.intro.join(" ").split(/\s+/).length, d.slug).toBeGreaterThanOrEqual(90);
   paragraphs.push(...d.intro);
   expect(getTopicDef(skill, d.slug)).toBe(d); expect(isConcreteTopic(skill, d.slug)).toBe(true);
  }
  expect(isConcreteTopic(skill, "tong-hop")).toBe(false);
 }
 expect(new Set(paragraphs).size).toBe(paragraphs.length);
 expect(TOPIC_REGISTRY["ngu-phap"]).toHaveLength(17); expect(TOPIC_REGISTRY["tu-vung"]).toHaveLength(10);
 expect(getTopicDef("doc-hieu", "chung")).toBeUndefined();
});

it("provides at least forty curated English keywords for every vocabulary theme", () => {
 expect(Object.keys(VOCAB_LEXICON).sort()).toEqual(TOPIC_REGISTRY["tu-vung"].map(t => t.slug).sort());
 for (const keywords of Object.values(VOCAB_LEXICON)) {
  expect(new Set(keywords).size).toBeGreaterThanOrEqual(40);
  for (const keyword of keywords) expect(keyword).toMatch(/^[a-z]+$/);
 }
});
