import { expect, it } from 'vitest';
import { grammarItems, vocabularyItems, readingItems, wordOrderItems } from '../src/build/index.js';
import { corpusStats, classify, spreadGrades, topicFor } from '../src/classify.js';
import { assemble, writeBank } from '../src/bank.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Article, Candidate } from '../src/model.js';
const sentence='She has written a useful letter to her family.';
const article:Article={id:'123',url:'https://learningenglish.voanews.com/a/123.html',title:'Family',date:'2020-01-01',paragraphs:[Array(10).fill(sentence).join(' ')],glossary:[{word:'useful',definition:'helping people do something'},{word:'letter',definition:'a written message'},{word:'family',definition:'a group of related people'},{word:'garden',definition:'a place for plants'}],crawledAt:'2026-01-01T00:00:00.000Z'};
const stats=corpusStats([article.paragraphs.join(' '),'The workers are building houses carefully. People protect forests quickly. Students develop ideas slowly.']);
it('builds deterministic grammar with known inflections and one blank',()=>{
 const items=grammarItems(article,stats); expect(items.some(i=>i.answer==='written')).toBe(true); expect(items).toEqual(grammarItems(article,stats));
 for(const item of items){expect(item.stem.match(/___/g)).toHaveLength(1); expect(new Set(item.choices.map(s=>s.toLowerCase())).size).toBe(4); expect(item.choices.filter(s=>s===item.answer)).toHaveLength(1);}
 expect(grammarItems({...article,paragraphs:['She can swim in the river.']},stats).some(x=>x.answer==='can')).toBe(false);
});
it('builds attached glossary exercises and word-order choices',()=>{
 const reading=readingItems(article,stats); expect(reading.some(i=>i.kind==='definition')).toBe(true); expect(reading.every(i=>i.passage)).toBe(true);
 const orders=wordOrderItems(article,stats); expect(orders.length).toBeGreaterThan(0); for(const item of orders){expect(item.choices).toContain(item.original);expect(new Set(item.choices).size).toBe(4);}
 for(const build of [readingItems,vocabularyItems,wordOrderItems]) expect(build(article,stats)).toEqual(build(article,stats));
});
it('classifies topic rules and spreads concentrated scores across grades',()=>{
 expect(topicFor('We protect forests and the environment.','tu-vung').slug).toBe('moi-truong');
 expect(topicFor('She has written a letter.','ngu-phap').slug).toBe('thi-hien-tai-hoan-thanh');
 expect(classify(sentence,stats).grade).toBeGreaterThanOrEqual(6);
 expect(new Set(spreadGrades(Array.from({length:20},(_,i)=>({id:String(i),score:1,grade:6}))))).toEqual(new Set([6,7,8,9]));
});
it('rejects broken gates, deduplicates and produces byte-identical bundles',async()=>{
 const candidates=grammarItems(article,stats); const first=candidates.find(i=>i.answer==='written')!; expect(first).toBeDefined();
 const bad={...first,choices:['same','same','same','same']}; const missing={...first,crawledAt:''};
 const result=assemble([first,first,bad,missing],stats); expect(result.bundles.flatMap(b=>b.bundle.questions)).toHaveLength(1); expect(result.report.rejections.duplicate).toBe(1); expect(result.report.rejections.options).toBe(1); expect(result.report.rejections.provenance).toBe(1);
 const dir=await mkdtemp(resolve('test/.bank-')); try {await writeBank(result,dir); const file=resolve(dir,result.bundles.find(b=>b.bundle.questions.length)!.filename); const before=await readFile(file,'utf8');await writeBank(assemble([first,first,bad,missing],stats),dir);expect(await readFile(file,'utf8')).toBe(before);} finally {await rm(dir,{recursive:true,force:true});}
});
it('rejects alternate answers present elsewhere in the corpus',()=>{
 const item=grammarItems(article,stats).find(i=>i.answer==='written')!;
 const altered={...item,choices:[...item.choices.slice(0,3),'eaten']};
 const result=assemble([altered],corpusStats([sentence,sentence.replace('written','eaten')])); expect(result.bundles.flatMap(b=>b.bundle.questions)).toHaveLength(0);
});
