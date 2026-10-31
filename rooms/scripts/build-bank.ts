import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';
import { BankSchema, QuestionStore, type RoomsBank } from '../src/bank';
const raw=z.object({questions:z.array(z.object({id:z.string(),reviewStatus:z.string()}).passthrough()),passages:z.array(z.object({id:z.string()}).passthrough()),tests:z.array(z.object({questionIds:z.array(z.string())}).passthrough())});
const pick=(obj:Record<string,unknown>,keys:string[])=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]]));
export async function buildRoomsBank(testsDir:string):Promise<RoomsBank> {
 const bundles=await Promise.all((await readdir(testsDir)).filter(f=>/^bank-.*\.json$/.test(f)).sort().map(async f=>raw.parse(JSON.parse(await readFile(resolve(testsDir,f),'utf8')))));
 const published=bundles.flatMap(b=>b.questions).filter(q=>q.reviewStatus==='published');
 const ids=new Set(published.map(q=>q.id));
 const passageIds=new Set(published.map(q=>q.passageId).filter(Boolean));
 const bank=BankSchema.parse({
  questions:published.map(q=>pick(q,['id','grade','skill','topicSlug','difficulty','passageId','stem','options','correctKey','explanation'])),
  passages:bundles.flatMap(b=>b.passages).filter(p=>passageIds.has(p.id)).map(p=>pick(p,['id','title','body'])),
  tests:bundles.flatMap(b=>b.tests).filter(t=>t.questionIds.every(id=>ids.has(id))).map(t=>pick(t,['slug','grade','skill','topicSlug','kind','title','questionIds']))
 });
 new QuestionStore(bank);
 return bank;
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
 const bank=await buildRoomsBank(fileURLToPath(new URL('../../web/content/tests/',import.meta.url)));
 const dir=new URL('../data/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('bank-rooms.json',dir),JSON.stringify(bank));
 console.log(`Rooms bank: ${bank.questions.length} questions, ${bank.passages.length} passages, ${bank.tests.length} tests`);
}
