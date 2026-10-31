import { it, expect } from 'vitest';
import { buildRoomsBank } from '../scripts/build-bank';
import { BankSchema, QuestionStore } from '../src/bank';
import { readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const realDir=fileURLToPath(new URL('../../web/content/tests',import.meta.url));
it('builds the real bank with server answers and keeps it out of public',async()=>{
 const bank=await buildRoomsBank(realDir); expect(bank.questions.length).toBeGreaterThan(0);
 expect(bank.questions.every(q=>q.correctKey && q.explanation)).toBe(true);
 expect(()=>new QuestionStore(bank)).not.toThrow();
 async function scan(dir:string):Promise<string[]> { const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?scan(`${dir}/${e.name}`):Promise.resolve([e.name])))).flat(); }
 expect(await scan(fileURLToPath(new URL('../../web/public',import.meta.url)))).not.toContain('bank-rooms.json');
});
it('drops unpublished questions, affected tests and unreferenced passages',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./bank-fixture-',import.meta.url)));
 try {
  const q={id:'q',grade:7,skill:'ngu-phap',topicSlug:'topic',difficulty:1,stem:'Stem',options:['A','B','C','D'].map(key=>({key,text:key})),correctKey:'A',explanation:'EXPL-SECRET-q',reviewStatus:'published'};
  const test={slug:'lop-7/ngu-phap/topic/de-1',grade:7,kind:'topic',title:'Test',questionIds:['q']};
  await writeFile(`${dir}/bank-a.json`,JSON.stringify({questions:[q,{...q,id:'draft',reviewStatus:'draft'}],passages:[{id:'unused',title:'Unused',body:'Unused'}],tests:[test,{...test,slug:'bad',questionIds:['q','draft']}]}));
  const bank=await buildRoomsBank(dir);expect(bank.questions.map(q=>q.id)).toEqual(['q']);expect(bank.tests).toHaveLength(1);expect(bank.passages).toEqual([]);
  expect(BankSchema.safeParse({...bank,unexpected:true}).success).toBe(false);
  expect(()=>new QuestionStore({...bank,tests:[{...bank.tests[0],questionIds:['missing']}]})).toThrow();
 } finally {await rm(dir,{recursive:true,force:true});}
});
