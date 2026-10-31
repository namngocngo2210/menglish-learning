import { readFile } from 'node:fs/promises';
import hosts from '../../config/gov-hosts.json' with { type:'json' };
import type { HttpClient } from '../http.js';
import type { Candidate, Source } from '../model.js';
import { hash, words } from '../util.js';
import { extractPdf, parseAnswerKey, parseExam } from '../parse/exam.js';
import { examTopic } from '../classify.js';
export interface GovSeed {url:string;year:number;province:string;grade:number;kind:string;answerKeyUrl?:string}
export function allowedGovUrl(url:string):boolean{try{const u=new URL(url);const host=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!hosts.forbidden.some(part=>host.includes(part))&&hosts.allowed.some(pattern=>pattern.startsWith('*.')?host.endsWith('.'+pattern.slice(2)):host===pattern);}catch{return false;}}
export async function loadSeeds(path:URL|string=new URL('../../config/gov-seeds.json',import.meta.url)):Promise<GovSeed[]>{
 const seeds:unknown=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(seeds))throw new Error('Seeds must be an array');
 for(const seed of seeds){if(!seed||!allowedGovUrl(seed.url)||!Number.isInteger(seed.year)||seed.year<1900||![6,7,8,9].includes(seed.grade)||typeof seed.province!=='string'||!seed.province.trim()||typeof seed.kind!=='string'||!seed.kind.trim()||(seed.answerKeyUrl&&!allowedGovUrl(seed.answerKeyUrl)))throw new Error('Invalid or forbidden official seed');}
 return (seeds as GovSeed[]).sort((a,b)=>a.url.localeCompare(b.url));
}
export async function crawlGov(client:HttpClient,seeds:GovSeed[],onError:(url:string,error:unknown)=>void):Promise<void>{for(const seed of seeds){for(const url of [seed.url,seed.answerKeyUrl].filter((s):s is string=>!!s)){if(!allowedGovUrl(url))throw new Error('Forbidden official URL');try{const response=await client.get(url);if(!response.body.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Official URL did not return a PDF');}catch(error){onError(url,error);}}}}
export function govItems(text:string,keyText:string,seed:GovSeed,crawledAt:string):Candidate[]{
 const origin=new URL(seed.url).origin;const source:Source={id:'gov-'+hash(origin+'|'+seed.province).slice(0,8),name:`Sở/Bộ GD&ĐT – ${seed.province}`,baseUrl:origin,license:'Văn bản chính thức của cơ quan nhà nước',attribution:`${seed.province} – ${seed.year}`};
 // Embedded keys must be under an explicit answer-key heading; question
 // stems beginning with "A ..." are never evidence of a correct answer.
 if(text===keyText){const heading=/(?:^|\n)\s*(?:ĐÁP ÁN|DAP AN|ANSWER KEY|ANSWERS)\s*[:\-]?[^\n]*\n/i.exec(keyText);if(!heading)return [];keyText=keyText.slice(heading.index+heading[0].length);text=text.slice(0,heading.index);}
 return parseExam(text,parseAnswerKey(keyText)).map(item=>{
 const inferred=examTopic(item.stem,item.choices);
 const skill=item.kind==='reading'?'doc-hieu':item.kind==='pronunciation'?'tu-vung':item.kind==='transformation'?'viet-cau':inferred.skill;
 const sourceRef=`${seed.year} | ${seed.province} | ${seed.kind} | Question ${item.number}`;
 return {source,sourceId:source.id,sourceName:source.name,sourceUrl:seed.url,sourceRef,license:source.license,crawledAt,kind:'exam-'+item.kind,skill,grade:seed.grade,stem:item.stem,original:item.stem,choices:item.choices,answer:item.choices['ABCD'.indexOf(item.correctKey)],explanation:`Đáp án ${item.correctKey} theo đáp án chính thức, câu ${item.number} (${seed.province}, ${seed.year}).`,...(item.kind==='pronunciation'?{topicSlug:'phat-am-trong-am'}:item.kind==='transformation'?{topicSlug:'viet-lai-cau'}:item.kind==='mcq'?{topicSlug:inferred.slug}:{}),...(item.passage?{passage:{id:'gov-p-'+hash(seed.url+'|'+item.passage).slice(0,12),sourceId:source.id,sourceUrl:seed.url,sourceName:source.name,license:source.license,crawledAt,title:`${seed.kind} – ${seed.year}`,body:item.passage,wordCount:words(item.passage).length,level:Math.min(5,seed.grade-4)}}:{})};
 });
}
export {extractPdf};
