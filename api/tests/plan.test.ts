import type { ContentBundle, Question } from "@bj/core";
import { describe, expect, it } from "vitest";
import { readContentDir } from "../src/import/files";
import type { LayerFile } from "../src/import/files";
import { PlanError, buildPlan } from "../src/import/plan";
import { CONTENT_DIR } from "./content-dir";

const source = {
  id: "voa-learning-english",
  name: "VOA",
  baseUrl: "https://learningenglish.voanews.com",
  license: "Public domain",
  attribution: "VOA",
};

function question(id: string, extra: Partial<Question> = {}): Question {
  return {
    id,
    type: "mcq",
    grade: 6,
    skill: "ngu-phap",
    topicSlug: "thi-hien-tai-don",
    difficulty: 1,
    stem: `Stem ${id}`,
    options: [
      { key: "A", text: "one" },
      { key: "B", text: "two" },
      { key: "C", text: "three" },
      { key: "D", text: "four" },
    ],
    correctKey: "A",
    explanation: "Because.",
    sourceId: source.id,
    sourceUrl: "https://example.com/x",
    reviewStatus: "quarantine",
    ...extra,
  };
}

const empty = (): ContentBundle => ({
  sources: [],
  passages: [],
  topics: [],
  questions: [],
  tests: [],
});
const layer = (kind: LayerFile["layer"], bundle: Partial<ContentBundle>): LayerFile => ({
  layer: kind,
  name: `${kind}.json`,
  bundle: { ...empty(), ...bundle },
});

describe("buildPlan", () => {
  it("lets the published layer override the quarantine layer when both carry the question", () => {
    const quarantined = question("voa-1", { topicSlug: "gioi-tu", explanation: "old" });
    const published = question("voa-1", {
      topicSlug: "mao-tu",
      explanation: "new",
      reviewStatus: "published",
      reviewedAt: "2026-10-31T00:00:00.000Z",
    });
    const plan = buildPlan([
      layer("quarantine", { sources: [source], questions: [quarantined] }),
      layer("published", { sources: [source], questions: [published] }),
    ]);
    const [q] = plan.questions;
    expect(plan.questions).toHaveLength(1);
    expect(q).toMatchObject({
      topicKey: "6/ngu-phap/mao-tu",
      explanation: "new",
      reviewStatus: "published",
      publishedAt: "2026-10-31T00:00:00.000Z",
    });
  });

  it("keeps an optional field of the earlier layer when the later layer omits it", () => {
    const quarantined = question("voa-1", { sourceRef: "ref-from-crawler" });
    const published = question("voa-1", {
      reviewStatus: "published",
      reviewedAt: "2026-10-31T00:00:00.000Z",
    });
    const plan = buildPlan([
      layer("quarantine", { sources: [source], questions: [quarantined] }),
      layer("published", { questions: [published] }),
    ]);
    expect(plan.questions[0]?.sourceRef).toBe("ref-from-crawler");
  });

  it("derives a topic that no bundle declares from the question classification", () => {
    const plan = buildPlan([
      layer("quarantine", {
        sources: [source],
        questions: [question("voa-1", { topicSlug: "tinh-tu-so-huu" })],
      }),
    ]);
    const derived = plan.topics.find((t) => t.slug === "tinh-tu-so-huu");
    expect(derived).toMatchObject({ derived: true, name: "Tính từ sở hữu" });
  });

  it("falls back to the slug as display name when the registry has no definition", () => {
    const plan = buildPlan([
      layer("quarantine", {
        sources: [source],
        questions: [question("voa-1", { skill: "viet-cau", topicSlug: "chung" })],
      }),
    ]);
    expect(plan.topics.find((t) => t.slug === "chung")).toMatchObject({
      name: "chung",
      derived: true,
    });
  });

  it("publishes a passage only when one of its questions is published", () => {
    const passages = [
      { id: "p-1", sourceId: source.id, title: "T1", body: "Body one", wordCount: 2, level: 1 },
      { id: "p-2", sourceId: source.id, title: "T2", body: "Body two", wordCount: 2, level: 1 },
    ];
    const plan = buildPlan([
      layer("quarantine", {
        sources: [source],
        passages,
        questions: [
          question("voa-1", { passageId: "p-1", skill: "doc-hieu", topicSlug: "chung" }),
          question("voa-2", { passageId: "p-2", skill: "doc-hieu", topicSlug: "chung" }),
        ],
      }),
      layer("published", {
        questions: [
          question("voa-1", {
            passageId: "p-1",
            skill: "doc-hieu",
            topicSlug: "chung",
            reviewStatus: "published",
            reviewedAt: "2026-10-30T00:00:00.000Z",
          }),
        ],
      }),
    ]);
    const byId = Object.fromEntries(plan.passages.map((p) => [p.externalId, p]));
    expect(byId["p-1"]).toMatchObject({
      reviewStatus: "published",
      publishedAt: "2026-10-30T00:00:00.000Z",
    });
    expect(byId["p-2"]).toMatchObject({ reviewStatus: "quarantine", publishedAt: null });
  });

  it("orders test items by questionIds and defaults the option order to ABCD", () => {
    const published = (id: string) =>
      question(id, { reviewStatus: "published", reviewedAt: "2026-10-31T00:00:00.000Z" });
    const plan = buildPlan([
      layer("published", {
        sources: [source],
        topics: [
          {
            grade: 6,
            skill: "ngu-phap",
            slug: "thi-hien-tai-don",
            name: "Thì hiện tại đơn",
            description: "d",
          },
        ],
        questions: [published("voa-1"), published("voa-2")],
        tests: [
          {
            slug: "lop-6/ngu-phap/thi-hien-tai-don/de-1",
            grade: 6,
            skill: "ngu-phap",
            topicSlug: "thi-hien-tai-don",
            kind: "topic",
            title: "Đề 1",
            questionIds: ["voa-2", "voa-1"],
            optionOrder: { "voa-1": "DCBA" },
            publishedAt: "2026-10-31T00:00:00.000Z",
          },
        ],
      }),
    ]);
    expect(plan.tests[0]?.items).toEqual([
      { questionExternalId: "voa-2", optionOrder: "ABCD" },
      { questionExternalId: "voa-1", optionOrder: "DCBA" },
    ]);
  });

  it("reports every broken reference in one PlanError", () => {
    const attempt = () =>
      buildPlan([
        layer("quarantine", {
          questions: [
            question("voa-1", { sourceId: "missing-source", passageId: "missing-passage" }),
          ],
        }),
      ]);
    expect(attempt).toThrow(PlanError);
    try {
      attempt();
    } catch (error) {
      expect((error as PlanError).problems).toEqual([
        "question voa-1: unknown source missing-source",
        "question voa-1: unknown passage missing-passage",
      ]);
    }
  });

  it("rejects a published question that has no reviewedAt", () => {
    expect(() =>
      buildPlan([
        layer("published", {
          sources: [source],
          questions: [question("voa-1", { reviewStatus: "published" })],
        }),
      ]),
    ).toThrow("published without reviewedAt");
  });

  it("rejects tests inside a quarantine file and duplicate test slugs", () => {
    const test = {
      slug: "thi-vao-lop-10/de-1",
      grade: 9 as const,
      kind: "entrance10" as const,
      title: "Đề 1",
      questionIds: ["voa-1"],
      publishedAt: "2026-10-31T00:00:00.000Z",
    };
    const published = question("voa-1", {
      reviewStatus: "published",
      reviewedAt: "2026-10-31T00:00:00.000Z",
    });
    expect(() => buildPlan([layer("quarantine", { sources: [source], tests: [test] })])).toThrow(
      "must not contain tests",
    );
    expect(() =>
      buildPlan([
        layer("published", { sources: [source], questions: [published], tests: [test, test] }),
      ]),
    ).toThrow("duplicate test slug");
  });
});

describe("buildPlan on the real seed content", () => {
  const plan = buildPlan(readContentDir(CONTENT_DIR));

  it("produces the counts of the import-parity table (blueprint 3.6)", () => {
    const status = (s: string) => plan.questions.filter((q) => q.reviewStatus === s).length;
    expect({
      published: status("published"),
      quarantine: status("quarantine"),
      questions: plan.questions.length,
      passages: plan.passages.length,
      publishedPassages: plan.passages.filter((p) => p.reviewStatus === "published").length,
      tests: plan.tests.length,
      testItems: plan.tests.reduce((n, t) => n + t.items.length, 0),
      sources: plan.sources.length,
      topics: plan.topics.length,
      derivedTopics: plan.topics.filter((t) => t.derived).length,
    }).toEqual({
      published: 2698,
      quarantine: 2,
      questions: 2700,
      passages: 50,
      publishedPassages: 50,
      tests: 316,
      testItems: 4590,
      sources: 2,
      topics: 146,
      derivedTopics: 31,
    });
  });

  it("keeps VOA 2587 + gov 111 published questions and test kinds 238/57/21", () => {
    const published = plan.questions.filter((q) => q.reviewStatus === "published");
    expect(published.filter((q) => q.externalId.startsWith("voa-"))).toHaveLength(2587);
    expect(published.filter((q) => q.externalId.startsWith("gov-"))).toHaveLength(111);
    const kind = (k: string) => plan.tests.filter((t) => t.kind === k).length;
    expect([kind("mixed"), kind("topic"), kind("entrance10")]).toEqual([238, 57, 21]);
  });

  it("parses the official-exam provenance of all 111 gov questions", () => {
    const gov = plan.questions.filter(
      (q) => q.externalId.startsWith("gov-") && q.reviewStatus === "published",
    );
    expect(gov.every((q) => "year" in q.provenance && "examCode" in q.provenance)).toBe(true);
  });
});
