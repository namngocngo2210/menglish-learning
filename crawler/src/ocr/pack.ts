/**
 * One-time packer (provenance tool). Combines the two raw transcription passes
 * kept under data/raw/extract (gitignored) into the committed extraction files
 * in crawler/ocr/. The build never reads images or data/raw/extract; it reads
 * only crawler/ocr/*.json, so builds are deterministic.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableJson } from '../util.js';
import { validateExtraction, type OcrExtraction, type OcrItem } from './merge.js';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const extract=join(root,'data/raw/extract');
const read=async(name:string)=>JSON.parse(await readFile(join(extract,name),'utf8'));
const seeds=JSON.parse(await readFile(join(root,'crawler/config/gov-seeds.json'),'utf8')) as OcrExtraction['seed'][];
const pageCounts:Record<number,{exam:number;key:number}>={2024:{exam:4,key:1},2025:{exam:4,key:1},2026:{exam:4,key:1}};
const norm=(items:OcrItem[]):OcrItem[]=>items.map(i=>({number:i.number,...(i.page?{page:i.page}:{}),instruction:i.instruction??'',passage:i.passage??null,stem:i.stem??'',options:i.options,needsFigure:!!i.needsFigure,...((i as {unreadable?:boolean}).unreadable?{unreadable:true}:{})})).sort((a,b)=>a.number-b.number);
const keyOf=(k:{answers:Record<string,string|null>})=>Object.fromEntries(Object.entries(k.answers).sort((a,b)=>Number(a[0])-Number(b[0])));
await mkdir(join(root,'crawler/ocr'),{recursive:true});
for(const seed of seeds){
  const y=seed.year;
  let crawledAt='';for(const f of await readdir(join(root,'data/raw/hanoi.edu.vn')))if(f.endsWith('.meta.json')){const m=JSON.parse(await readFile(join(root,'data/raw/hanoi.edu.vn',f),'utf8'));if(m.url===seed.url)crawledAt=m.fetchedAt;}
  if(!crawledAt)throw new Error('No cache metadata for '+seed.url);const a=await read(`claude-exam${y}.json`),b=await read(`codex-exam${y}.json`),ka=await read(`claude-key${y}.json`),kb=await read(`codex-key${y}.json`);
  const ext:OcrExtraction={schema:1,seed:{url:seed.url,answerKeyUrl:seed.answerKeyUrl,year:y,province:seed.province,grade:seed.grade,kind:seed.kind},examCode:a.examCode,keyCode:ka.code,header:a.header,pages:pageCounts[y],crawledAt,
    passA:{method:'ocr-transcribed',model:'claude-vision (sonnet)',items:norm(a.items),key:keyOf(ka)},
    passB:{method:'ocr-transcribed',model:'codex-vision (gpt-6.1-sol)',items:norm(b.items),key:keyOf(kb)}};
  if(String(b.examCode)!==String(a.examCode)||String(kb.code)!==String(ka.code))throw new Error('Exam code mismatch between passes for '+y);
  validateExtraction(ext);
  await writeFile(join(root,`crawler/ocr/hanoi-${y}.json`),stableJson(ext));
}
console.log('packed',seeds.length);
