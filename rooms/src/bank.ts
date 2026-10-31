import { readFile } from 'node:fs/promises';
import { z } from 'zod';
export const SkillSchema=z.enum(['doc-hieu','ngu-phap','tu-vung','viet-cau']);
export const KeySchema=z.enum(['A','B','C','D']);
const text=z.string().min(1);
const grade=z.union([z.literal(6),z.literal(7),z.literal(8),z.literal(9)]);
export const BankSchema=z.strictObject({
 questions:z.array(z.strictObject({id:text,grade,skill:SkillSchema,topicSlug:text,difficulty:z.union([z.literal(1),z.literal(2),z.literal(3)]),passageId:text.optional(),stem:text,options:z.array(z.strictObject({key:KeySchema,text})).length(4),correctKey:KeySchema,explanation:text}).refine(q=>new Set(q.options.map(o=>o.key)).size===4)),
 passages:z.array(z.strictObject({id:text,title:text,body:text})),
 tests:z.array(z.strictObject({slug:text,grade,skill:SkillSchema.optional(),topicSlug:text.optional(),kind:z.enum(['topic','mixed','entrance10']),title:text,questionIds:z.array(text).min(1).refine(ids=>new Set(ids).size===ids.length)}))
});
export type RoomsBank=z.infer<typeof BankSchema>;
export type BankQuestion=RoomsBank['questions'][number];
export class QuestionStore {
 readonly questions:Map<string,BankQuestion>;
 readonly passages:Map<string,RoomsBank['passages'][number]>;
 readonly tests:Map<string,RoomsBank['tests'][number]>;
 constructor(input:unknown) {
  const bank=BankSchema.parse(input);
  this.questions=new Map(bank.questions.map(q=>[q.id,q]));this.passages=new Map(bank.passages.map(p=>[p.id,p]));this.tests=new Map(bank.tests.map(t=>[t.slug,t]));
  if(this.questions.size!==bank.questions.length || this.passages.size!==bank.passages.length || this.tests.size!==bank.tests.length) throw new Error('Duplicate bank identifiers');
  for(const q of bank.questions) if(q.passageId && !this.passages.has(q.passageId)) throw new Error('Missing bank passage');
  for(const t of bank.tests) if(t.questionIds.some(id=>!this.questions.has(id))) throw new Error('Missing bank question');
 }
 static async load(path:string) {return new QuestionStore(JSON.parse(await readFile(path,'utf8')));}
}
