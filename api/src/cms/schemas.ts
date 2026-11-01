import { GradeSchema, OptionKeySchema, SkillSchema } from "@bj/core";
import { z } from "zod";
import { STATUSES } from "./transitions";

const text = z.string().trim().min(1);
export const IdSchema = z.string().regex(/^\d{1,18}$/, "Expected a numeric id");
const nullableUrl = z.url().nullable().optional();

const OPTIONS = z
  .array(z.strictObject({ key: OptionKeySchema, text }))
  .length(4)
  .superRefine((options, ctx) => {
    if (new Set(options.map((o) => o.key)).size !== 4)
      ctx.addIssue({ code: "custom", message: "Option keys must be unique" });
    if (new Set(options.map((o) => o.text.toLowerCase())).size !== 4)
      ctx.addIssue({ code: "custom", message: "Option texts must be unique" });
  });

const draftOrQuarantine = z.enum(["quarantine", "draft"]).default("draft");

const sourceBase = z.strictObject({
  code: text,
  name: text,
  base_url: z.url(),
  license: text,
  attribution: text,
  allowed_hosts: z.array(z.string().regex(/^(\*\.)?[a-z0-9][a-z0-9.-]*$/)).max(50),
  enabled: z.boolean(),
});

const passageBase = z.strictObject({
  external_id: text,
  source_id: IdSchema,
  title: text,
  body: text,
  word_count: z.number().int().positive(),
  level: z.number().int().min(1).max(5),
  source_url: nullableUrl,
});

const questionBase = z.strictObject({
  external_id: text,
  grade: GradeSchema,
  skill: SkillSchema,
  topic_id: IdSchema,
  difficulty: z.number().int().min(1).max(3),
  passage_id: IdSchema.nullable().optional(),
  stem: text,
  options: OPTIONS,
  correct_key: OptionKeySchema,
  explanation: text,
  source_id: IdSchema,
  source_url: z.url(),
  source_ref: text.nullable().optional(),
});

const OPTION_ORDER = /^(?!.*(.).*\1)[ABCD]{4}$/;
const testBase = z.strictObject({
  slug: text,
  grade: GradeSchema,
  skill: SkillSchema.nullable().optional(),
  topic_id: IdSchema.nullable().optional(),
  kind: z.enum(["topic", "mixed", "entrance10"]),
  title: text,
  seed: z.string().optional(),
  items: z
    .array(z.strictObject({ question_id: IdSchema, option_order: z.string().regex(OPTION_ORDER) }))
    .max(200)
    .optional(),
});

const presetBase = z.strictObject({
  name: text,
  grade: GradeSchema,
  skill: SkillSchema.nullable().optional(),
  config: z.strictObject({
    size: z.number().int().min(1).max(100),
    difficultyMix: z
      .strictObject({
        1: z.number().min(0).optional(),
        2: z.number().min(0).optional(),
        3: z.number().min(0).optional(),
      })
      .optional(),
    skillMix: z.partialRecord(SkillSchema, z.number().min(0)).optional(),
    maxGroup: z.number().int().min(1).optional(),
  }),
});

const none = (v: unknown): boolean => v === null || v === undefined;
type Q = z.infer<typeof questionBase>;
const checkQuestion = (
  q: { options?: Q["options"] | undefined; correct_key?: string | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (q.options && q.correct_key && !q.options.some((o) => o.key === q.correct_key))
    ctx.addIssue({ code: "custom", message: "Missing correct option", path: ["correct_key"] });
};
const checkTest = (t: z.infer<typeof testBase>, ctx: z.RefinementCtx): void => {
  const bare = none(t.skill) && none(t.topic_id);
  if ((t.kind === "entrance10") !== bare)
    ctx.addIssue({
      code: "custom",
      message: "Entrance tests have no skill or topic; other kinds need both",
      path: ["kind"],
    });
  if (t.kind !== "entrance10" && (none(t.skill) || none(t.topic_id)))
    ctx.addIssue({ code: "custom", message: "skill and topic_id are required", path: ["skill"] });
  if (new Set(t.items?.map((i) => i.question_id)).size !== (t.items?.length ?? 0))
    ctx.addIssue({ code: "custom", message: "Duplicate question ids", path: ["items"] });
};

/** Create validates a whole row; update is a non-empty partial, re-validated merged with the stored row. */
export const SCHEMAS = {
  sources: { create: sourceBase, update: sourceBase.partial() },
  passages: {
    create: passageBase.extend({ review_status: draftOrQuarantine }),
    update: passageBase.partial(),
  },
  questions: {
    create: questionBase.extend({ review_status: draftOrQuarantine }).superRefine(checkQuestion),
    update: questionBase.partial().superRefine(checkQuestion),
  },
  tests: { create: testBase.superRefine(checkTest), update: testBase.partial() },
  "mixer-presets": { create: presetBase, update: presetBase.partial() },
} as const;

export const TransitionSchema = z.strictObject({
  to: z.enum(STATUSES),
  note: z.string().trim().min(1).max(1000).optional(),
});

export const BulkSchema = z
  .strictObject({
    to: z.enum(STATUSES),
    note: z.string().trim().min(1).max(1000).optional(),
    expected_count: z.number().int().min(1),
    ids: z.array(IdSchema).min(1).max(200).optional(),
    filter: z
      .strictObject({
        status: z.enum(STATUSES),
        grade: GradeSchema.optional(),
        skill: SkillSchema.optional(),
        topic_id: IdSchema.optional(),
        source_id: IdSchema.optional(),
      })
      .optional(),
  })
  .refine((b) => (b.ids === undefined) !== (b.filter === undefined), {
    message: "Provide exactly one of ids or filter",
  });

export const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: IdSchema.optional(),
  status: z.enum(STATUSES).optional(),
  grade: z.coerce.number().int().min(6).max(9).optional(),
  skill: SkillSchema.optional(),
  topic_id: IdSchema.optional(),
  source_id: IdSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const ReportSchema = z.strictObject({
  question_id: text.max(100),
  reason: z.enum(["wrong_answer", "typo", "unclear", "offensive", "other"]),
  note: z.string().trim().max(500).optional(),
  website: z.string().max(200).optional(),
});

export const ReportPatchSchema = z.strictObject({
  status: z.enum(["resolved", "dismissed"]),
  handled_note: z.string().trim().max(500).optional(),
});
