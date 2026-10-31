import type { Key } from '../model.js';
/**
 * Merge logic for transcribed (OCR) official exam papers.
 *
 * Two independent transcription passes (A and B) of the same scanned paper
 * are compared. An item is kept only when both passes agree on the text
 * (stem, passage, options and underlines) AND both passes read the same
 * answer key entry from the official answer-key PDF. Everything else is
 * rejected and counted. Nothing here ever invents or repairs text or keys.
 */
export interface OcrItem { number:number; instruction?:string; passage?:string|null; stem:string; options:string[]; needsFigure?:boolean; unreadable?:boolean; page?:number }
export interface OcrPass { method:string; model:string; items:OcrItem[]; key:Record<string,string|null> }
export interface OcrExtraction {
  schema:1;
  seed:{url:string;answerKeyUrl:string;year:number;province:string;grade:number;kind:string};
  examCode:string; keyCode:string; header:string; pages:{exam:number;key:number}; crawledAt:string;
  passA:OcrPass; passB:OcrPass;
}
export type OcrPart='pronunciation'|'reading'|'transformation'|'mcq';
export interface MergedItem { number:number; instruction:string; passage?:string; stem:string; options:string[]; correctKey:Key; part:OcrPart }
export type RejectReason='missing-in-one-pass'|'figure-dependent'|'unreadable'|'text-mismatch'|'underline-mismatch'|'key-missing'|'key-mismatch'|'invalid-options';
export interface Rejected { number:number; reason:RejectReason }
export interface MergeResult { items:MergedItem[]; rejected:Rejected[]; extracted:number }

/** Formatting-only differences (quote style, dashes, spacing, bullets, blank length) never count as disagreement. */
export function canon(text:string|null|undefined):string{
  return (text??'').replace(/<\/?u>/g,'').replace(/[\u2018\u2019\u02bc`]/g,"'").replace(/[\u201c\u201d]/g,'"')
    .replace(/[\u2013\u2014\u2212]/g,'-').replace(/_{2,}|\u2026+|\.{4,}/g,'___').replace(/(^|\n)\s*[-*\u2022]\s+/g,'$1').replace(/\s+/g,'');
}
export function underlines(text:string):string[]{return [...text.matchAll(/<u>(.*?)<\/u>/g)].map(m=>canon(m[1]));}
const letter=(value:unknown):Key|undefined=>typeof value==='string'&&/^[ABCD]$/.test(value.trim().toUpperCase())?value.trim().toUpperCase() as Key:undefined;
export function partOf(instruction:string,hasPassage:boolean):OcrPart{
  if(/pronunciation|primary stress|position of (?:the )?(?:primary )?stress/i.test(instruction))return 'pronunciation';
  if(hasPassage)return 'reading';
  if(/closest in meaning to the original sentence|best made from the given cues/i.test(instruction))return 'transformation';
  return 'mcq';
}
/**
 * Structure-insensitive body signature. Passes may split the same printed text
 * differently between "passage" and "stem" (e.g. a dialogue line in the stem vs
 * in the passage) and may or may not echo the blank label "(13)". The sorted
 * multiset of characters still exposes any missing, extra or misread character.
 */
export function bodyOf(item:OcrItem):string{return [...canon([item.passage??'',item.stem].join('\n').replace(/\(\d{1,2}\)/g,'')).replace(/_/g,'')].sort().join('');}
export function mergePasses(ext:OcrExtraction):MergeResult{
  const index=(items:OcrItem[])=>{const m=new Map<number,OcrItem>();const dup=new Set<number>();for(const item of items){if(m.has(item.number))dup.add(item.number);m.set(item.number,item);}for(const n of dup)m.delete(n);return m;};
  const a=index(ext.passA.items),b=index(ext.passB.items);
  const numbers=[...new Set([...ext.passA.items,...ext.passB.items].map(i=>i.number))].sort((x,y)=>x-y);
  const items:MergedItem[]=[];const rejected:Rejected[]=[];
  for(const number of numbers){
    const x=a.get(number),y=b.get(number);const reject=(reason:RejectReason)=>{rejected.push({number,reason});};
    if(!x||!y){reject('missing-in-one-pass');continue;}
    if(x.needsFigure||y.needsFigure){reject('figure-dependent');continue;}
    if(x.unreadable||y.unreadable){reject('unreadable');continue;}
    if(x.options.length!==4||y.options.length!==4||x.options.some(o=>!o.trim())||new Set(x.options.map(o=>canon(o))).size!==4){reject('invalid-options');continue;}
    if(bodyOf(x)!==bodyOf(y)||x.options.some((o,i)=>canon(o)!==canon(y.options[i]))){reject('text-mismatch');continue;}
    const ua=underlines([x.stem,...x.options].join('\n')),ub=underlines([y.stem,...y.options].join('\n'));
    if(ua.join('|')!==ub.join('|')){reject('underline-mismatch');continue;}
    const ka=letter(ext.passA.key[String(number)]),kb=letter(ext.passB.key[String(number)]);
    if(!ka||!kb){reject('key-missing');continue;}
    if(ka!==kb){reject('key-mismatch');continue;}
    const instruction=(x.instruction??'').trim();
    items.push({number,instruction,...(x.passage?.trim()?{passage:x.passage.trim()}:{}),stem:x.stem.trim()||instruction,options:x.options.map(o=>o.trim()),correctKey:ka,part:partOf(instruction,!!x.passage?.trim())});
  }
  return {items,rejected,extracted:numbers.length};
}
export interface PartCounts { extracted:number; kept:number; rejected:number; byReason:Record<string,number>; byPart:Record<string,number> }
export function summarize(result:MergeResult):PartCounts{
  const byReason:Record<string,number>={},byPart:Record<string,number>={};
  for(const r of result.rejected)byReason[r.reason]=(byReason[r.reason]??0)+1;
  for(const i of result.items)byPart[i.part]=(byPart[i.part]??0)+1;
  return {extracted:result.extracted,kept:result.items.length,rejected:result.rejected.length,byReason:Object.fromEntries(Object.entries(byReason).sort()),byPart:Object.fromEntries(Object.entries(byPart).sort())};
}
/** Structural validation of a committed extraction file (fails loudly instead of importing bad data). */
export function validateExtraction(value:unknown):OcrExtraction{
  const e=value as OcrExtraction;
  if(!e||e.schema!==1||!e.seed||typeof e.seed.url!=='string'||!Number.isInteger(e.seed.year)||!e.examCode||!e.keyCode||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(e.crawledAt??''))throw new Error('Invalid OCR extraction header');
  for(const pass of [e.passA,e.passB]){
    if(!pass||!pass.method||!pass.model||!Array.isArray(pass.items)||typeof pass.key!=='object')throw new Error('Invalid OCR pass');
    for(const item of pass.items)if(!Number.isInteger(item.number)||typeof item.stem!=='string'||!Array.isArray(item.options))throw new Error('Invalid OCR item '+item?.number);
  }
  if(e.passA.method===e.passB.method&&e.passA.model===e.passB.model)throw new Error('Passes must be independent (different model or method)');
  return e;
}
