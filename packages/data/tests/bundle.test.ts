import { describe, expect, it } from "vitest";
import { buildBundle } from "../src/bundle";
import type { PublicRows } from "../src/bundle";

const options = [
  { key: "A", text: "a" },
  { key: "B", text: "b" },
  { key: "C", text: "c" },
  { key: "D", text: "d" },
];

function rows(): PublicRows {
  return {
    sources: [
      { code: "voa", name: "VOA", base_url: "https://x.org", license: "L", attribution: "A" },
    ],
    topics: [
      { grade: 6, skill: "ngu-phap", slug: "thi-hien-tai-don", name: "T", description: "d" },
    ],
    passages: [],
    questions: [
      {
        id: "q1",
        grade: 6,
        skill: "ngu-phap",
        topic_slug: "thi-hien-tai-don",
        difficulty: 2,
        passage_id: null,
        stem: "s",
        options,
        correct_key: "A",
        explanation: "e",
        source_code: "voa",
        source_url: "https://x.org/q",
        source_ref: "ref",
        crawled_at: new Date("2026-01-02T03:04:05.000Z"),
      },
    ],
    tests: [
      {
        slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
        grade: 6,
        skill: "ngu-phap",
        topic_slug: "thi-hien-tai-don",
        kind: "topic",
        title: "Đề 1",
        seed: "",
        published_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    testItems: [
      {
        test_slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
        position: 1,
        question_id: "q1",
        option_order: "ABCD",
      },
    ],
  };
}

describe("buildBundle", () => {
  it("maps rows to a ContentBundle without optional fields that are empty", () => {
    const bundle = buildBundle(rows());
    expect(bundle.tests[0]).toEqual({
      slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
      grade: 6,
      skill: "ngu-phap",
      topicSlug: "thi-hien-tai-don",
      kind: "topic",
      title: "Đề 1",
      questionIds: ["q1"],
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(bundle.questions[0]?.crawledAt).toBe("2026-01-02T03:04:05.000Z");
    expect(bundle.questions[0]?.sourceRef).toBe("ref");
    expect(bundle.questions[0]?.passageId).toBeUndefined();
  });

  it("keeps optional passage fields, the seed and non-default option orders", () => {
    const input = rows();
    input.passages = [
      {
        id: "p1",
        source_code: "voa",
        title: "P",
        body: "B",
        word_count: 5,
        level: 2,
        source_url: "https://x.org/p",
        crawled_at: new Date("2026-02-03T00:00:00.000Z"),
      },
    ];
    input.questions = [{ ...(input.questions[0] as object), passage_id: "p1", source_code: "voa" }];
    input.tests = [{ ...(input.tests[0] as object), seed: "s1" }];
    input.testItems = [
      {
        test_slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
        position: 1,
        question_id: "q1",
        option_order: "DCBA",
      },
    ];
    const bundle = buildBundle(input);
    expect(bundle.passages[0]).toMatchObject({
      sourceUrl: "https://x.org/p",
      crawledAt: "2026-02-03T00:00:00.000Z",
      sourceName: "VOA",
    });
    expect(bundle.tests[0]?.seed).toBe("s1");
    expect(bundle.tests[0]?.optionOrder).toEqual({ q1: "DCBA" });
  });

  it("builds entrance tests that have no skill or topic", () => {
    const input = rows();
    input.tests = [
      {
        slug: "thi-vao-lop-10/de-1",
        grade: 9,
        skill: null,
        topic_slug: null,
        kind: "entrance10",
        title: "Đề thi",
        seed: "",
        published_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    input.questions = [{ ...(input.questions[0] as object), grade: 9 }];
    input.testItems = [
      { test_slug: "thi-vao-lop-10/de-1", position: 1, question_id: "q1", option_order: "ABCD" },
    ];
    const test = buildBundle(input).tests[0];
    expect(test?.skill).toBeUndefined();
    expect(test?.topicSlug).toBeUndefined();
  });

  it("rejects a malformed row instead of building a broken bundle", () => {
    const broken = rows();
    broken.questions = [{ id: "q1" }];
    expect(() => buildBundle(broken)).toThrow();
  });

  it("rejects a bundle whose test references an unknown option permutation", () => {
    const broken = rows();
    broken.testItems = [
      {
        test_slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
        position: 1,
        question_id: "q1",
        option_order: "AAAA",
      },
    ];
    expect(() => buildBundle(broken)).toThrow();
  });
});
