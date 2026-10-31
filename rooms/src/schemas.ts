import { z } from 'zod';
import { SkillSchema, KeySchema } from './bank';
export const TestSpecSchema=z.discriminatedUnion('mode',[
 z.strictObject({mode:z.literal('fixed'),slug:z.string().max(200)}),
 z.strictObject({mode:z.literal('mix'),grade:z.union([z.literal(6),z.literal(7),z.literal(8),z.literal(9)]),skills:z.array(SkillSchema).min(1).max(4).refine(s=>new Set(s).size===s.length),topicSlug:z.string().min(1).max(100).nullable(),size:z.union([z.literal(10),z.literal(20),z.literal(40)]),difficulty:z.enum(['balanced','easy','medium','hard'])})
]);
export type TestSpec=z.infer<typeof TestSpecSchema>;
const settings={maxPlayers:z.number().int().min(2).max(45),timeLimitMinutes:z.union([z.null(),z.literal(15),z.literal(30)]),test:TestSpecSchema};
export const CreateSchema=z.strictObject({name:z.string().max(200),maxPlayers:settings.maxPlayers.default(10),timeLimitMinutes:settings.timeLimitMinutes.default(null),test:settings.test});
export type CreateInput=z.input<typeof CreateSchema>;
export const SettingsSchema=z.strictObject({maxPlayers:settings.maxPlayers.optional(),timeLimitMinutes:settings.timeLimitMinutes.optional(),locked:z.boolean().optional(),test:settings.test.optional()});
export const JoinSchema=z.strictObject({name:z.string().max(200)});
export const KickSchema=z.strictObject({playerId:z.string().min(1).max(100)});
export const AnswerSchema=z.strictObject({questionId:z.string().min(1).max(200),key:KeySchema.nullable()});
export const ReportSchema=z.strictObject({reason:z.enum(['ten_khong_phu_hop','noi_dung_sai','khac'])});
export const EmptySchema=z.strictObject({});
