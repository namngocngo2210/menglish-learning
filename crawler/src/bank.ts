import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Bundle, Candidate, Key, Question } from './model.js';
import { classify, spreadGrades, topicFor, topicName, type Corpus } from './classify.js';
import { accepted, count, newReport, type Report } from './report.js';
import { hash, normalize, stableJson, words } from './util.js';
export interface Bank { bundles:{filename:string;bundle:Bundle}[]; report:Report }
const clozeKinds=new Set(['verb-form','agreement','function-word','comparison','content-cloze','reading-cloze','word-form']);
const iso=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value));
const url=(value:string)=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
export function rejection(item:Candidate,corpus:Corpus):string|undefined{
 if(!item.sourceUrl||!url(item.sourceUrl)||!item.sourceName||!item.license||!iso(item.crawledAt)||!item.sourceRef||item.source.id!==item.sourceId||item.source.name!==item.sourceName||item.source.license!==item.license||!url(item.source.baseUrl)||!item.source.attribution)return 'provenance';
 if(item.choices.length!==4||item.choices.some(s=>!s.trim())||new Set(item.choices.map(s=>s.trim().toLowerCase())).size!==4||item.choices.filter(s=>s===item.answer).length!==1)return 'options';
 if(!item.stem.trim()||item.stem.length>400)return 'stem-length';
 if((item.skill==='doc-hieu'||item.kind==='exam-reading')&&!item.passage)return 'missing-passage';
 if(item.passage){const p=item.passage;if(!p.sourceUrl||!url(p.sourceUrl)||!p.sourceName||!p.license||!iso(p.crawledAt)||!p.id||!p.title||!p.body||p.sourceId!==item.sourceId||p.sourceUrl!==item.sourceUrl||p.sourceName!==item.sourceName||p.license!==item.license||p.wordCount!==words(p.body).length||!p.wordCount||p.level<1||p.level>5)return 'passage';}
 if(clozeKinds.has(item.kind)){
 if((item.stem.match(/___/g)??[]).length!==1)return 'blank-count';
 if(!item.original.includes(item.answer)||item.stem.replace('___',item.answer)!==item.original)return 'answer-context';
 if(item.passage&&!item.passage.body.includes(item.original))return 'passage-context';
 for(const distractor of item.choices.filter(s=>s!==item.answer)){
 if(corpus.sentences.has(normalize(item.stem.replace('___',distractor))))return 'alternate-corpus-answer';
 }
 }else if(!item.kind.startsWith('exam-')&&!['definition','word-order'].includes(item.kind))return 'unknown-kind';
 // Official question wording and key are authoritative; generated non-cloze
 // formats carry their own source evidence rather than an artificial blank.
 if(item.kind==='word-order'&&item.answer!==item.original)return 'answer-context';
 return undefined;
}
export function assemble(input:Candidate[],corpus:Corpus):Bank{
 const report=newReport();const buckets=new Map<string,Bundle>();for(const source of ['voa','gov'])for(const grade of [6,7,8,9])buckets.set(`${source}-grade-${grade}.json`,{sources:[],passages:[],topics:[],questions:[],tests:[]});
 const seen=new Set<string>();const ready:Candidate[]=[];
 const ordered=[...input].sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl)||a.sourceRef.localeCompare(b.sourceRef)||a.stem.localeCompare(b.stem));
 for(const item of ordered){const reason=rejection(item,corpus);if(reason){count(report.rejections,reason);continue;}
 const key=normalize(item.stem)+(clozeKinds.has(item.kind)&&item.passage?'|'+item.passage.id:'');if(seen.has(key)){count(report.rejections,'duplicate');continue;}seen.add(key);ready.push(item);}
 const voa=ready.filter(i=>i.sourceId==='voa-learning-english');const grades=spreadGrades(voa.map(item=>{const c=classify(item.original,corpus);return {id:item.sourceRef,score:item.score??c.score,grade:item.grade??c.grade};}));const assigned=new Map(voa.map((item,i)=>[item,grades[i]]));
 for(const item of ready){const c=classify(item.original,corpus);const grade=assigned.get(item)??item.grade??c.grade;const difficulty=item.difficulty??c.difficulty;
 if(![6,7,8,9].includes(grade)||![1,2,3].includes(difficulty)){count(report.rejections,'classification');continue;}
 const slug=item.topicSlug??topicFor(item.original,item.skill).slug;if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){count(report.rejections,'topic');continue;}
 const source=item.sourceId==='voa-learning-english'?'voa':'gov';const bundle=buckets.get(`${source}-grade-${grade}.json`)!;
 const q:Question={id:source+'-'+hash(normalize(item.stem)+'|'+item.sourceRef).slice(0,8),type:'mcq',grade,skill:item.skill,topicSlug:slug,difficulty,...(item.passage?{passageId:item.passage.id}:{}),stem:item.stem,options:item.choices.map((text,i)=>({key:'ABCD'[i] as Key,text})),correctKey:'ABCD'[item.choices.indexOf(item.answer)] as Key,explanation:item.explanation,sourceId:item.sourceId,sourceUrl:item.sourceUrl,sourceRef:item.sourceRef,sourceName:item.sourceName,license:item.license,crawledAt:item.crawledAt,reviewStatus:'quarantine'};
 if(!q.explanation.trim()){count(report.rejections,'explanation');continue;}
 if([...buckets.values()].some(b=>b.questions.some(other=>other.id===q.id))){count(report.rejections,'id-collision');continue;}
 bundle.questions.push(q);if(!bundle.sources.some(s=>s.id===item.source.id))bundle.sources.push(item.source);
 if(item.passage&&!bundle.passages.some(p=>p.id===item.passage!.id))bundle.passages.push(item.passage);
 if(!bundle.topics.some(t=>t.grade===grade&&t.skill===item.skill&&t.slug===slug))bundle.topics.push({grade,skill:item.skill,slug,name:topicName(slug),description:`Luyện tập ${topicName(slug).toLowerCase()} từ nguồn đã ghi nhận; chờ chủ sở hữu duyệt.`});accepted(report,q,item.kind);
 }
 // A passage may serve multiple grades. Keep it in one stable fragment so
 // merging fragments preserves globally unique passage/source identifiers.
 const sourceIds=new Set<string>(),passageIds=new Set<string>();
 for(const bundle of buckets.values()){
 bundle.sources=bundle.sources.filter(s=>{if(sourceIds.has(s.id))return false;sourceIds.add(s.id);return true;}).sort((a,b)=>a.id.localeCompare(b.id));
 bundle.passages=bundle.passages.filter(p=>{if(passageIds.has(p.id))return false;passageIds.add(p.id);return true;}).sort((a,b)=>a.id.localeCompare(b.id));
 bundle.questions.sort((a,b)=>a.id.localeCompare(b.id));bundle.topics.sort((a,b)=>(a.skill+'|'+a.slug).localeCompare(b.skill+'|'+b.slug));}
 return {bundles:[...buckets].map(([filename,bundle])=>({filename,bundle})),report};
}
export async function writeBank(bank:Bank,out:string):Promise<void>{await mkdir(out,{recursive:true});for(const {filename,bundle} of bank.bundles)await writeFile(join(out,filename),stableJson(bundle));}
