import { z } from "zod";
import { GRADES, SKILLS, parseEntranceSlug, parseTestSlug } from "./routes";
import { isSlug } from "./slug";
const text = z.string().trim().min(1);
const slug = text.refine(isSlug, "Expected an ASCII kebab-case slug");
export const GradeSchema = z.union(GRADES.map((g) => z.literal(g)));
export const SkillSchema = z.enum(SKILLS);
export const OptionKeySchema = z.enum(["A", "B", "C", "D"]);
export const ReviewStatusSchema = z.enum([
  "quarantine",
  "draft",
  "in_review",
  "published",
  "rejected",
  "archived",
]);
export const SourceSchema = z.strictObject({
  id: text,
  name: text,
  baseUrl: z.url(),
  license: text,
  attribution: text,
});
export const PassageSchema = z.strictObject({
  id: text,
  sourceId: text,
  title: text,
  body: text,
  sourceUrl: z.url().optional(),
  sourceName: text.optional(),
  license: text.optional(),
  crawledAt: z.iso.datetime().optional(),
  wordCount: z.number().int().positive(),
  level: z.number().int().min(1).max(5),
});
export const TopicSchema = z.strictObject({
  grade: GradeSchema,
  skill: SkillSchema,
  slug,
  name: text,
  description: text,
});
export const QuestionSchema = z
  .strictObject({
    id: text,
    type: z.literal("mcq"),
    grade: GradeSchema,
    skill: SkillSchema,
    topicSlug: slug,
    difficulty: z.number().int().min(1).max(3),
    passageId: text.optional(),
    stem: text,
    options: z.array(z.strictObject({ key: OptionKeySchema, text })).length(4),
    correctKey: OptionKeySchema,
    explanation: text,
    sourceId: text,
    sourceUrl: z.url(),
    sourceRef: text.optional(),
    sourceName: text.optional(),
    license: text.optional(),
    crawledAt: z.iso.datetime().optional(),
    reviewStatus: ReviewStatusSchema,
    reviewNote: text.optional(),
    reviewedAt: z.iso.datetime().optional(),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.options.map((o) => o.key)).size !== 4)
      ctx.addIssue({ code: "custom", message: "Option keys must be unique", path: ["options"] });
    if (
      q.reviewStatus !== "quarantine" &&
      new Set(q.options.map((o) => o.text.toLowerCase())).size !== 4
    )
      ctx.addIssue({ code: "custom", message: "Option texts must be unique", path: ["options"] });
    if (!q.options.some((o) => o.key === q.correctKey))
      ctx.addIssue({ code: "custom", message: "Missing correct option", path: ["correctKey"] });
  });
export const TestSchema = z
  .strictObject({
    slug: text,
    grade: GradeSchema,
    skill: SkillSchema.optional(),
    topicSlug: slug.optional(),
    kind: z.enum(["topic", "mixed", "entrance10"]),
    title: text,
    questionIds: z.array(text).min(1),
    publishedAt: z.iso.datetime(),
    seed: text.optional(),
    optionOrder: z.record(text, z.string().regex(/^(?!.*(.).*\1)[ABCD]{4}$/)).optional(),
  })
  .superRefine((test, ctx) => {
    const { topicSlug } = test;
    if (test.kind === "entrance10") {
      if (
        !parseEntranceSlug(test.slug) ||
        test.grade !== 9 ||
        test.skill !== undefined ||
        topicSlug !== undefined
      )
        ctx.addIssue({
          code: "custom",
          message: "Entrance tests require grade 9, an entrance slug and no skill or topic",
          path: ["slug"],
        });
    } else {
      const route = parseTestSlug(test.slug);
      if (
        !route ||
        !test.skill ||
        !topicSlug ||
        route.grade !== test.grade ||
        route.skill !== test.skill ||
        route.topic !== topicSlug
      )
        ctx.addIssue({
          code: "custom",
          message: "Test slug disagrees with grade, skill or topic",
          path: ["slug"],
        });
    }
    if (
      test.optionOrder &&
      Object.keys(test.optionOrder).some((id) => !test.questionIds.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        message: "Option order references a question outside the test",
        path: ["optionOrder"],
      });
    if (new Set(test.questionIds).size !== test.questionIds.length)
      ctx.addIssue({ code: "custom", message: "Duplicate question ids", path: ["questionIds"] });
  });
export const ContentBundleSchema = z.strictObject({
  sources: z.array(SourceSchema),
  passages: z.array(PassageSchema),
  topics: z.array(TopicSchema),
  questions: z.array(QuestionSchema),
  tests: z.array(TestSchema),
});
export type Source = z.infer<typeof SourceSchema>;
export type Passage = z.infer<typeof PassageSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Test = z.infer<typeof TestSchema>;
export type ContentBundle = z.infer<typeof ContentBundleSchema>;
export type OptionKey = z.infer<typeof OptionKeySchema>;
