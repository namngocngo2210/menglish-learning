import { describe, expect, it } from "vitest";
import { validateQuestion } from "./validate";
import type { QuestionForm } from "./validate";

const ok: QuestionForm = {
  external_id: "q1",
  grade: "6",
  skill: "ngu-phap",
  topic_id: "1",
  difficulty: "2",
  passage_id: "",
  stem: "She ___ home.",
  options: ["go", "goes", "going", "gone"],
  correct_key: "B",
  explanation: "Ngôi thứ ba số ít.",
  source_id: "1",
  source_url: "https://example.com/a",
  source_ref: "",
};

describe("validateQuestion", () => {
  it("accepts a valid question", () => {
    expect(validateQuestion(ok)).toEqual({});
  });
  it("rejects duplicate options, bad url and bad difficulty", () => {
    const e = validateQuestion({
      ...ok,
      options: ["go", "GO", "x", "y"],
      source_url: "javascript:alert(1)",
      difficulty: "4",
    });
    expect(Object.keys(e).sort()).toEqual(["difficulty", "options", "source_url"]);
  });
});
