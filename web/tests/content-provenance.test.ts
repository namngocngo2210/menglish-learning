import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ContentBundleSchema, PassageSchema, QuestionSchema } from "@/lib/content/types";
const sample = JSON.parse(readFileSync("content/tests/grade-6.json", "utf8"));
const provenance = { sourceName: "VOA Learning English", license: "Public domain (work of the US Government)", crawledAt: "2026-01-01T00:00:00Z" };
it("accepts optional provenance while preserving old samples and strict fields", () => {
 expect(ContentBundleSchema.safeParse(sample).success).toBe(true);
 const question = { ...sample.questions[0], ...provenance };
 expect(QuestionSchema.safeParse(question).success).toBe(true);
 expect(QuestionSchema.safeParse({ ...question, crawledAt: "yesterday" }).success).toBe(false);
 expect(QuestionSchema.safeParse({ ...question, unknown: true }).success).toBe(false);
 const passage = { id: "p1", sourceId: "voa-learning-english", title: "Title", body: "A short passage.", wordCount: 3, level: 1 };
 expect(PassageSchema.safeParse(passage).success).toBe(true);
 expect(PassageSchema.safeParse({ ...passage, ...provenance, sourceUrl: "https://learningenglish.voanews.com/a/123.html" }).success).toBe(true);
 expect(PassageSchema.safeParse({ ...passage, crawledAt: "invalid" }).success).toBe(false);
 expect(PassageSchema.safeParse({ ...passage, unknown: true }).success).toBe(false);
});
