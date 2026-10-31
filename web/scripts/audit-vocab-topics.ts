// Usage: tsx scripts/audit-vocab-topics.ts [perGrade=30] [seed=1]
// Prints a reproducible random sample of vocabulary questions per grade that were assigned a
// concrete topic, so a human can judge precision. Also prints counts per topic/grade.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ContentBundleSchema } from "../lib/content/types";
import { classifyEligibleQuestions } from "./lib/build-bank";
import { guardQuestions } from "./lib/guards";

const perGrade = Number(process.argv[2] ?? 30);
let seed = Number(process.argv[3] ?? 1);
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const directory = join(process.cwd(), "content/quarantine");
const fragments = readdirSync(directory).filter(f => f.endsWith(".json")).sort().map(f => ContentBundleSchema.parse(JSON.parse(readFileSync(join(directory, f), "utf8"))));
const questions = guardQuestions(fragments.flatMap(f => f.questions).filter(q => q.reviewStatus === "quarantine")).questions;
const entries = classifyEligibleQuestions(questions, fragments.flatMap(f => f.passages)).filter(e => e.question.skill === "tu-vung");
for (const grade of [6, 7, 8, 9]) {
 const g = entries.filter(e => e.question.grade === grade);
 const hits = g.filter(e => e.classification.topic !== null);
 const counts = new Map<string, number>();
 hits.forEach(e => counts.set(e.classification.topic!, (counts.get(e.classification.topic!) ?? 0) + 1));
 console.log(`\n=== Grade ${grade}: ${g.length} vocab, ${hits.length} classified; ${JSON.stringify(Object.fromEntries(counts))}`);
 const pool = [...hits];
 for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
 pool.slice(0, perGrade).forEach((e, i) => {
  const q = e.question;
  const correct = q.options.find(o => o.key === q.correctKey)?.text;
  console.log(`${i + 1}. [${e.classification.topic}] ${q.stem}  => ${correct}  | ${q.options.map(o => o.text).join(" / ")}`);
 });
}
