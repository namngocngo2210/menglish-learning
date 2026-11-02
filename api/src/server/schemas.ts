import { ContentBundleSchema, GradeSchema, SkillSchema } from "@bj/core";
import { z } from "zod";

export const HealthSchema = z.strictObject({ status: z.literal("ok") });

export const GradeSummarySchema = z.strictObject({
  grade: GradeSchema,
  tests: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
});
export const GradesResponseSchema = z.strictObject({ items: z.array(GradeSummarySchema) });

export const TopicsQuerySchema = z.strictObject({
  grade: z.coerce.number().pipe(GradeSchema).optional(),
  skill: SkillSchema.optional(),
});
export const TopicSummarySchema = z.strictObject({
  grade: GradeSchema,
  skill: SkillSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tests: z.number().int().nonnegative(),
});
export const TopicsResponseSchema = z.strictObject({ items: z.array(TopicSummarySchema) });

/** Content test slug (internal id; public URLs are English, see docs/url-map.md), e.g. lop-6/ngu-phap/thi-hien-tai-don/de-1 or thi-vao-lop-10/de-1. */
export const TestParamsSchema = z.strictObject({
  "*": z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*){1,3}$/),
});
const OptionSchema = z.strictObject({ key: z.enum(["A", "B", "C", "D"]), text: z.string() });
export const PublicTestSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  grade: GradeSchema,
  skill: SkillSchema.optional(),
  topicSlug: z.string().optional(),
  kind: z.enum(["topic", "mixed", "entrance10"]),
  publishedAt: z.iso.datetime(),
  questions: z.array(
    z.strictObject({
      id: z.string(),
      stem: z.string(),
      options: z.array(OptionSchema).length(4),
      correctKey: z.enum(["A", "B", "C", "D"]),
      explanation: z.string(),
      difficulty: z.number().int().min(1).max(3),
      passageId: z.string().optional(),
    }),
  ),
  passages: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      body: z.string(),
      wordCount: z.number().int(),
      level: z.number().int(),
    }),
  ),
});

export const SnapshotSchema = ContentBundleSchema;

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  instance: z.string(),
  request_id: z.string(),
  errors: z.array(z.strictObject({ path: z.string(), message: z.string() })).optional(),
});
