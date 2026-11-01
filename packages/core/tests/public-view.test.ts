import { describe, expect, it } from "vitest";
import { selectPublicContent } from "../src/public-view";
import type { ContentBundle } from "../src/schemas";

const source = (id: string) => ({
  id,
  name: id,
  baseUrl: "https://example.org",
  license: "CC0",
  attribution: "x",
});
type Question = ContentBundle["questions"][number];
const question = (id: string, reviewStatus: Question["reviewStatus"]): Question => ({
  id,
  type: "mcq",
  grade: 6,
  skill: "ngu-phap",
  topicSlug: "thi-hien-tai-don",
  difficulty: 1,
  stem: "stem",
  options: [
    { key: "A", text: "a" },
    { key: "B", text: "b" },
    { key: "C", text: "c" },
    { key: "D", text: "d" },
  ],
  correctKey: "A",
  explanation: "why",
  sourceId: "voa",
  sourceUrl: "https://example.org/q",
  reviewStatus,
});

function bundle(): ContentBundle {
  return {
    sources: [source("voa"), source("unused")],
    passages: [],
    topics: [
      { grade: 6, skill: "ngu-phap", slug: "thi-hien-tai-don", name: "T", description: "d" },
      { grade: 6, skill: "ngu-phap", slug: "ngoai-le", name: "E", description: "d" },
    ],
    questions: [question("q1", "published"), question("q2", "draft"), question("q3", "published")],
    tests: [
      {
        slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
        grade: 6,
        skill: "ngu-phap",
        topicSlug: "thi-hien-tai-don",
        kind: "topic",
        title: "Đề 1",
        questionIds: ["q1", "q3"],
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        slug: "lop-6/ngu-phap/ngoai-le/de-1",
        grade: 6,
        skill: "ngu-phap",
        topicSlug: "ngoai-le",
        kind: "topic",
        title: "Đề ẩn",
        questionIds: ["q1", "q2"],
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("selectPublicContent", () => {
  it("keeps only published questions and fully published tests", () => {
    const result = selectPublicContent(bundle());
    expect(result.questions.map((q) => q.id)).toEqual(["q1", "q3"]);
    expect(result.tests.map((t) => t.slug)).toEqual(["lop-6/ngu-phap/thi-hien-tai-don/de-1"]);
  });

  it("drops topics without tests and sources nobody references", () => {
    const result = selectPublicContent(bundle());
    expect(result.topics.map((t) => t.slug)).toEqual(["thi-hien-tai-don"]);
    expect(result.sources.map((s) => s.id)).toEqual(["voa"]);
  });

  it("keeps passages referenced by published questions only, preserving order", () => {
    const input = bundle();
    const passage = (id: string) => ({
      id,
      sourceId: "voa",
      title: id,
      body: "body",
      wordCount: 10,
      level: 1,
    });
    input.passages = [passage("p2"), passage("p1")];
    input.questions[0] = { ...question("q1", "published"), passageId: "p1" };
    expect(selectPublicContent(input).passages.map((p) => p.id)).toEqual(["p1"]);
    input.questions[2] = { ...question("q3", "published"), passageId: "p2" };
    expect(selectPublicContent(input).passages.map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("does not mutate its input", () => {
    const input = bundle();
    selectPublicContent(input);
    expect(input.questions).toHaveLength(3);
    expect(input.tests).toHaveLength(2);
  });
});
