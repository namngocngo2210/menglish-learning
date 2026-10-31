import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ContentBundleSchema, PassageSchema, QuestionSchema } from "@/lib/content/types";
const bank = JSON.parse(readFileSync("content/tests/bank-grade-6.json", "utf8"));
const provenance = { sourceName: "VOA Learning English", license: "Public domain (work of the US Government)", crawledAt: "2026-01-01T00:00:00Z" };
it("preserves real bank provenance and strict fields", () => {
 expect(ContentBundleSchema.safeParse(bank).success).toBe(true);
 const question = { ...bank.questions[0], ...provenance };
 expect(QuestionSchema.safeParse(question).success).toBe(true);
 expect(QuestionSchema.safeParse({ ...question, crawledAt: "yesterday" }).success).toBe(false);
 expect(QuestionSchema.safeParse({ ...question, unknown: true }).success).toBe(false);
 const passage = { id: "p1", sourceId: "voa-learning-english", title: "Title", body: "A short passage.", wordCount: 3, level: 1 };
 expect(PassageSchema.safeParse(passage).success).toBe(true);
 expect(PassageSchema.safeParse({ ...passage, ...provenance, sourceUrl: "https://learningenglish.voanews.com/a/123.html" }).success).toBe(true);
 expect(PassageSchema.safeParse({ ...passage, crawledAt: "invalid" }).success).toBe(false);
 expect(PassageSchema.safeParse({ ...passage, unknown: true }).success).toBe(false);
});

it("retains source, license and crawl provenance on every promoted question", async () => {
 const { loadBundle } = await import("@/lib/content/load");
 for (const q of loadBundle().questions) {
  expect(q.sourceUrl).toMatch(/^https:\/\//); expect(q.sourceName).toBe("VOA Learning English");
  expect(q.license).toMatch(/Public domain/i); expect(Number.isNaN(Date.parse(q.crawledAt!))).toBe(false);
 }
});

it("accepts optional strict review metadata and rejects malformed approval fields", () => {
 const q = { ...bank.questions[0] }; delete q.reviewNote; delete q.reviewedAt;
 expect(QuestionSchema.safeParse(q).success).toBe(true);
 expect(QuestionSchema.safeParse({ ...q, reviewNote: "owner-approved-bulk 2026-10-31", reviewedAt: "2026-10-31T00:00:00.000Z" }).success).toBe(true);
 for (const fields of [{ reviewNote: " " }, { reviewNote: 1 }, { reviewedAt: "2026-10-31" }, { reviewedAt: "yesterday" }]) {
  expect(QuestionSchema.safeParse({ ...q, ...fields }).success).toBe(false);
 }
});
