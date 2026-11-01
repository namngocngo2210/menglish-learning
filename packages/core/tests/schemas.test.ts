import { describe, expect, it } from "vitest";
import { ContentBundleSchema, QuestionSchema, TestSchema } from "../src/index";

const baseQuestion = {
  id: "voa-00000001",
  type: "mcq",
  grade: 6,
  skill: "ngu-phap",
  topicSlug: "thi-hien-tai-don",
  difficulty: 1,
  stem: "She ___ to school every day.",
  options: [
    { key: "A", text: "go" },
    { key: "B", text: "goes" },
    { key: "C", text: "going" },
    { key: "D", text: "gone" },
  ],
  correctKey: "B",
  explanation: "Third person singular takes -es.",
  sourceId: "voa-learning-english",
  sourceUrl: "https://example.com/a",
  reviewStatus: "published",
} as const;

const baseTest = {
  slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
  grade: 6,
  skill: "ngu-phap",
  topicSlug: "thi-hien-tai-don",
  kind: "topic",
  title: "Thì hiện tại đơn - Đề 1",
  questionIds: ["voa-00000001"],
  publishedAt: "2026-10-31T00:00:00.000Z",
} as const;

describe("QuestionSchema", () => {
  it("accepts a well-formed question when every field is valid", () => {
    expect(QuestionSchema.safeParse(baseQuestion).success).toBe(true);
  });

  it("rejects unknown fields when the object is strict", () => {
    expect(QuestionSchema.safeParse({ ...baseQuestion, extra: 1 }).success).toBe(false);
  });

  it("rejects duplicate option keys when keys repeat", () => {
    const options = baseQuestion.options.map((o, i) => (i === 3 ? { ...o, key: "A" } : o));
    const result = QuestionSchema.safeParse({ ...baseQuestion, options });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate option texts when the question is not quarantined", () => {
    const options = baseQuestion.options.map((o, i) => (i === 3 ? { ...o, text: "GO" } : o));
    expect(QuestionSchema.safeParse({ ...baseQuestion, options }).success).toBe(false);
    expect(
      QuestionSchema.safeParse({ ...baseQuestion, options, reviewStatus: "quarantine" }).success,
    ).toBe(true);
  });

  it("rejects a question when the correct key is not among the options", () => {
    const options = baseQuestion.options.map((o) => ({ ...o, key: o.key === "B" ? "A" : o.key }));
    expect(QuestionSchema.safeParse({ ...baseQuestion, options }).success).toBe(false);
  });

  it("rejects a non-slug topic and a grade outside 6-9", () => {
    expect(QuestionSchema.safeParse({ ...baseQuestion, topicSlug: "Not A Slug" }).success).toBe(
      false,
    );
    expect(QuestionSchema.safeParse({ ...baseQuestion, grade: 5 }).success).toBe(false);
  });
});

describe("TestSchema", () => {
  it("accepts a topic test when the slug agrees with grade, skill and topic", () => {
    expect(TestSchema.safeParse(baseTest).success).toBe(true);
  });

  it("rejects a topic test when the slug disagrees with its topic", () => {
    expect(TestSchema.safeParse({ ...baseTest, topicSlug: "gioi-tu" }).success).toBe(false);
  });

  it("accepts an entrance test only without skill or topic and for grade 9", () => {
    const entrance = {
      slug: "thi-vao-lop-10/de-1",
      grade: 9,
      kind: "entrance10",
      title: "Đề 1",
      questionIds: ["a"],
      publishedAt: "2026-10-31T00:00:00.000Z",
    };
    expect(TestSchema.safeParse(entrance).success).toBe(true);
    expect(TestSchema.safeParse({ ...entrance, skill: "ngu-phap" }).success).toBe(false);
    expect(TestSchema.safeParse({ ...entrance, grade: 8 }).success).toBe(false);
  });

  it("rejects duplicate question ids and option orders for unknown questions", () => {
    expect(TestSchema.safeParse({ ...baseTest, questionIds: ["a", "a"] }).success).toBe(false);
    expect(
      TestSchema.safeParse({ ...baseTest, optionOrder: { "voa-other": "ABCD" } }).success,
    ).toBe(false);
    expect(
      TestSchema.safeParse({ ...baseTest, optionOrder: { "voa-00000001": "AABC" } }).success,
    ).toBe(false);
    expect(
      TestSchema.safeParse({ ...baseTest, optionOrder: { "voa-00000001": "DCBA" } }).success,
    ).toBe(true);
  });
});

describe("ContentBundleSchema", () => {
  it("accepts an empty bundle and rejects extra top-level keys", () => {
    const empty = { sources: [], passages: [], topics: [], questions: [], tests: [] };
    expect(ContentBundleSchema.safeParse(empty).success).toBe(true);
    expect(ContentBundleSchema.safeParse({ ...empty, extra: [] }).success).toBe(false);
  });
});
