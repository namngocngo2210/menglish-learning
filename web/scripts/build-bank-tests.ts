import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ContentBundleSchema } from "../lib/content/types";
import { buildBank, serializeBundle } from "./lib/build-bank";
const directory = join(process.cwd(), "content/quarantine");
const fragments = readdirSync(directory).filter(file => file.endsWith(".json")).sort().map(file => ContentBundleSchema.parse(JSON.parse(readFileSync(join(directory, file), "utf8"))));
const output = buildBank(fragments, report => {
 console.log("Guards (before partitioning; first matching reason wins):");
 for (const [reason, count] of Object.entries(report.counts)) console.log(`  ${reason}: ${count}`);
 console.log(`  Total excluded: ${report.excluded}; eligible: ${report.questions.length}`);
});
for (const [file, bundle] of Object.entries(output)) {
 writeFileSync(join(process.cwd(), "content/tests", file), serializeBundle(bundle));
 console.log(`${file}: ${bundle.tests.length} tests, ${bundle.questions.length} questions`);
}
for (const grade of [6, 7, 8, 9]) {
 const bundle = output[`bank-grade-${grade}.json`];
 console.log(`Grade ${grade}: ${bundle.questions.length} published questions`);
 for (const kind of ["topic", "mixed", "entrance10"] as const) {
  const count = Object.values(output).flatMap(b => b.tests).filter(t => t.grade === grade && t.kind === kind).length;
  console.log(`  ${kind}: ${count} tests`);
 }
}
