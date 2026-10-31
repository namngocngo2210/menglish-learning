import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ContentBundleSchema } from "@/lib/content/types";

it("validates all available quarantine fragments without publishing tests", () => {
 const directory = join(process.cwd(), "content/quarantine");
 if (!existsSync(directory)) return;
 const ids = new Set<string>();
 for (const filename of readdirSync(directory).filter(name => name.endsWith(".json")).sort()) {
  const bundle = ContentBundleSchema.parse(JSON.parse(readFileSync(join(directory, filename), "utf8")));
  expect(bundle.tests, filename).toEqual([]);
  for (const question of bundle.questions) {
   expect(question.reviewStatus, `${filename}: ${question.id}`).toBe("quarantine");
   expect(ids.has(question.id), `${filename}: duplicate ${question.id}`).toBe(false);
   ids.add(question.id);
  }
 }
});
