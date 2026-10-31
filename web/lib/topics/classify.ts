import type { Question } from "../content/types";
import { TOPIC_REGISTRY } from "./registry";
import { VOCAB_LEXICON } from "./lexicon";
export type ClassifyInput = Pick<Question, "skill" | "stem" | "options" | "correctKey" | "explanation" | "topicSlug">;
export type Classification = { topic: string | null; rule: string };
const result = (topic: string, rule: string): Classification => ({ topic, rule });
const none = (rule = "unclassified"): Classification => ({ topic: null, rule });
const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];
const possessives = new Set("my your his her its our their".split(" "));
const prepositions = new Set("in on at to for from with without by of about above below under over between among into onto through across along around behind beside near during before after until since within beyond against upon off out up down".split(" "));
const irregularPast = new Set("was were had did went came saw ate drank took gave made wrote read ran swam sang began broke brought bought caught chose cut drew drove fell felt found flew forgot got grew heard held kept knew learnt learned left lost met paid put rode rang rose said sat sent slept sold spoke spent stood taught told thought understood wore won built became".split(" "));
const isPast = (word: string) => /[a-z]+ed$/.test(word) || irregularPast.has(word);
// Recognize comparative forms without treating arbitrary nouns ending in -er as adjectives.
const comparativeForms = new Set<string>();
for (const base of "big small tall short long high low fast slow hard soft old young new wide narrow large nice late early easy happy heavy busy cheap rich poor warm cold hot cool light dark deep near far strong weak bright clean clever quiet simple safe thin thick close great quick hungry friendly silly lazy wet dry brave kind noisy funny ugly pretty healthy lucky angry sad fit fine strange smart sharp sweet fresh dark fair modern gentle shallow calm rough tough smooth proud steep".split(" ")) {
 comparativeForms.add(base + "er"); comparativeForms.add(base + "est");
 if (base.endsWith("e")) { comparativeForms.add(base + "r"); comparativeForms.add(base + "st"); }
 if (base.endsWith("y")) { comparativeForms.add(base.slice(0, -1) + "ier"); comparativeForms.add(base.slice(0, -1) + "iest"); }
 if (/[aeiou][b-df-hj-np-tv-z]$/.test(base)) { comparativeForms.add(base + base.at(-1) + "er"); comparativeForms.add(base + base.at(-1) + "est"); }
}

// Expand only common suffixes once; scoring then uses exact token lookups.
// Each distinct root contributes at most once per text, including in long passages.
const lexicalIndexes = new Map<readonly string[], Map<string, Set<string>>>();
for (const roots of Object.values(VOCAB_LEXICON)) {
 const index = new Map<string, Set<string>>();
 for (const root of new Set(roots)) {
  const forms = [root, ...["s", "es", "ed", "er", "ers", "ing", "ly", "ment", "ments", "ness", "ful", "less", "tion", "tions", "al", "ally", "ist", "ists"].map(suffix => root + suffix)];
  if (root.endsWith("e")) forms.push(...["ing", "ed", "er", "ers"].map(suffix => root.slice(0, -1) + suffix));
  if (root.endsWith("y")) forms.push(root.slice(0, -1) + "ies", root.slice(0, -1) + "ied");
  forms.push(...["ing", "ed", "er", "ers"].map(suffix => root + root.at(-1) + suffix));
  for (const form of forms) {
   const entries = index.get(form) ?? new Set<string>(); entries.add(root); index.set(form, entries);
  }
 }
 // Merge every connected family sharing a generated form, including transitive
 // collisions such as breath -> breathing <- breathe.
 const parents = new Map(roots.map(root => [root, root]));
 const family = (root: string): string => {
  const parent = parents.get(root)!;
  if (parent === root) return root;
  const canonical = family(parent); parents.set(root, canonical); return canonical;
 };
 for (const entries of index.values()) {
  const [first, ...rest] = entries;
  for (const root of rest) {
   const a = family(first); const b = family(root);
   const aFirst = a.length < b.length || (a.length === b.length && a < b);
   if (a !== b) parents.set(aFirst ? b : a, aFirst ? a : b);
  }
 }
 for (const [form, entries] of index) index.set(form, new Set([...entries].map(family)));
 lexicalIndexes.set(roots, index);
}
function lexicalScore(text: string, roots: readonly string[]): number {
 const found = new Set<string>(); const index = lexicalIndexes.get(roots)!;
 for (const token of new Set(words(text))) for (const root of index.get(token) ?? []) found.add(root);
 return found.size;
}
function vocabulary(q: ClassifyInput, passage?: { title: string; body: string }): Classification {
 if (/họ từ|word.family/i.test(q.explanation)) return none("vocab-word-family");
 const correct = q.options.find(o => o.key === q.correctKey)?.text ?? "";
 const scores = TOPIC_REGISTRY["tu-vung"].map((topic, order) => {
  const lexicon = VOCAB_LEXICON[topic.slug];
  // Distractor options are never evidence: only the stem and the correct answer, counted as distinct strong keywords.
  const own = lexicalScore(`${q.stem} ${correct}`, lexicon);
  const inAnswer = lexicalScore(correct, lexicon);
  // Passage evidence is a category cue only: distinct keywords, capped, and it can never decide alone.
  const context = passage ? Math.min(4, lexicalScore(passage.title, lexicon)) + Math.min(6, lexicalScore(passage.body, lexicon)) : 0;
  return { topic: topic.slug, own, inAnswer, context, score: own * 10 + context, order };
 }).sort((a, b) => b.score - a.score || a.order - b.order);
 const [best, runnerUp] = scores;
 // Accept only with >= 2 distinct strong keywords from stem + correct answer and a clear margin over the runner-up,
 // or one strong keyword that IS the correct answer plus a passage category cue (>= 4 distinct passage keywords).
 // The tested word itself (the correct answer) must be a topic keyword: topic nouns in a stem around a generic verb are not topic vocabulary.
 const strong = best.inAnswer >= 1 && best.own >= 2 && best.own - runnerUp.own >= 1;
 const cued = best.own === 1 && best.inAnswer === 1 && runnerUp.own === 0 && best.context >= 4 && best.context - runnerUp.context >= 2;
 if (!strong && !cued) return none("vocab-insufficient-evidence");
 return result(best.topic, strong ? "vocab-lexicon" : "vocab-lexicon-cue");
}
/** Ordered first-match rules; crawler topicSlug is deliberately never consulted. */
export function classifyQuestion(q: ClassifyInput, passage?: { title: string; body: string }): Classification {
 if (q.skill !== "ngu-phap" && q.skill !== "tu-vung") return none("non-target-skill");
 if (q.skill === "tu-vung") return vocabulary(q, passage);
 const stem = q.stem.toLowerCase(); const explanation = q.explanation.toLowerCase();
 const options = q.options.map(o => o.text.toLowerCase().trim());
 const correct = q.options.find(o => o.key === q.correctKey)?.text.toLowerCase().trim() ?? "";
 const before = words(stem.split(/_{3,}/)[0]);
 const previous = before.at(-1) ?? "";
 const explanationTrigger = /sau\s+[“"'‘]([a-z]+)[”"'’]/.exec(explanation)?.[1];
 const trigger = explanationTrigger ?? previous;
 const participle = explanation.includes("phân từ quá khứ");
 const ing = /v-ing/.test(explanation) || /ing$/.test(correct);
 const base = explanation.includes("nguyên thể") || (correct.length > 0 && !/\s/.test(correct) && options.some(o => o === `${correct}s` || o === `${correct}es` || o === `${correct}ing` || o === `${correct}ed`));
 if (explanation.includes("tính từ sở hữu") || options.every(o => possessives.has(o))) return result("tinh-tu-so-huu", "grammar-possessive");
 if (explanation.includes("giới từ") || options.every(o => prepositions.has(o))) return result("gioi-tu", "grammar-preposition");
 if (options.every(o => /^(a|an|the|no article|no article needed|ø|∅|không dùng mạo từ)$/.test(o))) return result("mao-tu", "grammar-article");
 const comparison = options.some(o => /^(more|most|less|least)(\s|$)|^(better|best|worse|worst|further|furthest|farther|farthest)$/.test(o) || comparativeForms.has(o));
 if (/___\s+than\b|\bthan\s+___|\bas\s+___\s+as\b|\bas\s+\w+\s+as\s+___/.test(stem) || comparison) return result("so-sanh", "grammar-comparison");
 // Tense variants of one infinitive after 'to' do not supply a conditional answer set.
 const conditionalOptions = trigger !== "to" && (options.some(o => /^(would|will|could|should|might|had|were)(\b|$)/.test(o)) ||
  (options.some(isPast) && /\b(would|will|had)\b/.test(stem)));
 if (/\b(if|unless)\b/.test(stem.replace(/\bas if\b/g, "")) && conditionalOptions) return result("cau-dieu-kien", "grammar-conditional");
 const questionPrefix = before.length === 0 || (before.length === 2 && /^(do|does|did|can|could|will|would|should|may|might|must|have|has|had)$/.test(before[0]) && /^(i|you|he|she|it|we|they)$/.test(previous)) || /^(who|what|when|where|why|how|which|whose|am|is|are|was|were|do|does|did|have|has|had|can|could|will|would|shall|should|may|might|must)$/.test(previous);
 if (stem.trim().endsWith("?") && questionPrefix) return result("cau-hoi", "grammar-question");
 if (/^(am|is|are|was|were|been|being|be)$/.test(trigger) && participle) return result("cau-bi-dong", "grammar-passive");
 if ((/^(have|has)$/.test(trigger) && participle) || explanation.includes("hiện tại hoàn thành")) return result("thi-hien-tai-hoan-thanh", "grammar-present-perfect");
 if (trigger === "had" && participle) return result("thi-qua-khu-hoan-thanh", "grammar-past-perfect");
 if (/^(am|is|are)$/.test(trigger) && ing) return result("thi-hien-tai-tiep-dien", "grammar-present-continuous");
 if (/^(was|were)$/.test(trigger) && ing) return result("thi-qua-khu-tiep-dien", "grammar-past-continuous");
 if (trigger === "will") return result("thi-tuong-lai-don", "grammar-will");
 if (/^(can|could|may|might|must|should|would|shall|ought)$/.test(trigger)) return result("dong-tu-khuyet-thieu", "grammar-modal");
 if (trigger === "to") return result("dong-tu-nguyen-mau-co-to", "grammar-to-infinitive");
 if (/chủ ngữ/.test(explanation) && /[“"'](am|is|are)[”"']/.test(explanation)) return result("dong-tu-to-be", "grammar-be");
 if (/^(do|does|did)$/.test(trigger) && base) return result(trigger === "did" ? "thi-qua-khu-don" : "thi-hien-tai-don", "grammar-do-base");
 if (/\b(yesterday|last|ago)\b|\bin\s+(?:1[0-9]{3}|20[0-9]{2})\b|\bwhen i was\b/.test(stem) && isPast(correct)) return result("thi-qua-khu-don", "grammar-past-marker");
 const singular = /^(he|she|it)$/.test(previous) || /\b(?:a|an|the|my|your|his|her|our|their)\s+[a-z]+\s*$/.test(stem.split("___")[0]) && !previous.endsWith("s");
 if (singular && /\b(every|usually|always|often|never|sometimes)\b/.test(stem) && /[a-z]+(?:s|es)$/.test(correct)) return result("thi-hien-tai-don", "grammar-present-marker");
 return none();
}
