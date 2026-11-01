import { describe, expect, it } from "vitest";
import { SCHEMAS, BulkSchema, ReportSchema } from "../src/cms/schemas";
import { STATUSES, TRANSITIONS, canTransition } from "../src/cms/transitions";

describe("review state machine", () => {
  it("matches the table for every (from, to) pair and rejects self-transitions", () => {
    for (const from of STATUSES)
      for (const to of STATUSES) {
        const expected = TRANSITIONS[from].includes(to);
        expect(canTransition("question", from, to), `${from}->${to}`).toBe(expected);
        if (from === to) expect(expected).toBe(false);
      }
  });

  it("reaches published only from in_review", () => {
    for (const from of STATUSES)
      expect(canTransition("passage", from, "published")).toBe(from === "in_review");
  });

  it("tests never move to quarantine or rejected", () => {
    expect(canTransition("test", "draft", "rejected")).toBe(false);
    expect(canTransition("test", "draft", "in_review")).toBe(true);
  });
});

const question = {
  external_id: "q-1",
  grade: 6,
  skill: "ngu-phap",
  topic_id: "1",
  difficulty: 1,
  stem: "She ___ to school.",
  options: [
    { key: "A", text: "go" },
    { key: "B", text: "goes" },
    { key: "C", text: "going" },
    { key: "D", text: "gone" },
  ],
  correct_key: "B",
  explanation: "x",
  source_id: "1",
  source_url: "https://example.com/q",
};

describe("cms schemas", () => {
  const create = SCHEMAS.questions.create;
  it("accepts a valid question and defaults to draft", () => {
    expect(create.parse(question).review_status).toBe("draft");
  });

  it.each([
    ["unknown field", { ...question, extra: 1 }],
    ["review_status published", { ...question, review_status: "published" }],
    ["three options", { ...question, options: question.options.slice(0, 3) }],
    [
      "duplicate option text",
      { ...question, options: question.options.map((o) => ({ ...o, text: "same" })) },
    ],
    ["difficulty 4", { ...question, difficulty: 4 }],
    ["grade 5", { ...question, grade: 5 }],
    ["non numeric topic", { ...question, topic_id: "abc" }],
  ])("rejects %s", (_name, body) => {
    expect(create.safeParse(body).success).toBe(false);
  });

  it("checks the correct key against the options on update too", () => {
    expect(SCHEMAS.questions.update.safeParse({ correct_key: "C" }).success).toBe(true);
    expect(
      SCHEMAS.questions.update.safeParse({
        correct_key: "B",
        options: question.options.map((o) => ({ ...o, key: o.key === "B" ? "A" : o.key })),
      }).success,
    ).toBe(false);
  });

  it("validates test items and entrance rules", () => {
    const t = { slug: "x", grade: 9, kind: "entrance10", title: "T" };
    const ok = (extra: object) => SCHEMAS.tests.create.safeParse({ ...t, ...extra }).success;
    expect(ok({})).toBe(true);
    expect(ok({ skill: "ngu-phap", topic_id: "1" })).toBe(false);
    expect(ok({ kind: "topic" })).toBe(false);
    expect(ok({ items: [{ question_id: "1", option_order: "ABCD" }] })).toBe(true);
    expect(ok({ items: [{ question_id: "1", option_order: "AABC" }] })).toBe(false);
    expect(
      ok({
        items: [
          { question_id: "1", option_order: "ABCD" },
          { question_id: "1", option_order: "BACD" },
        ],
      }),
    ).toBe(false);
  });

  it("requires exactly one of ids or filter in bulk bodies", () => {
    const base = { to: "draft", expected_count: 1 };
    expect(BulkSchema.safeParse({ ...base, ids: ["1"] }).success).toBe(true);
    expect(BulkSchema.safeParse({ ...base, filter: { status: "quarantine" } }).success).toBe(true);
    expect(BulkSchema.safeParse(base).success).toBe(false);
    expect(BulkSchema.safeParse({ ...base, ids: ["1"], filter: { status: "draft" } }).success).toBe(
      false,
    );
    expect(BulkSchema.safeParse({ ...base, ids: ["1"], expected_count: 0 }).success).toBe(false);
  });

  it("caps report notes at 500 characters", () => {
    const r = { question_id: "q", reason: "typo" };
    expect(ReportSchema.safeParse({ ...r, note: "x".repeat(500) }).success).toBe(true);
    expect(ReportSchema.safeParse({ ...r, note: "x".repeat(501) }).success).toBe(false);
  });
});
