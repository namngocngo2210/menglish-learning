import type { Candidate, Skill, Source } from '../model.js';
import { examTopic } from '../classify.js';
import { hash, words } from '../util.js';
import { mergePasses, summarize, type MergedItem, type OcrExtraction, type PartCounts } from './merge.js';
export const OCR_STATUS='ocr-transcribed' as const;
export interface OcrOutcome extends PartCounts { examCode:string; keyCode:string; method:string; models:string[]; rejectedItems:{number:number;reason:string}[] }
/** Quarantine candidates from an agreed OCR transcription. Same provenance model as text-layer official exams. */
export function ocrCandidates(ext:OcrExtraction,merged:MergedItem[]):Candidate[]{
  const seed=ext.seed;const origin=new URL(seed.url).origin;
  const source:Source={id:'gov-'+hash(origin+'|'+seed.province).slice(0,8),name:`Sở/Bộ GD&ĐT – ${seed.province}`,baseUrl:origin,license:'Văn bản chính thức của cơ quan nhà nước',attribution:`${seed.province} – ${seed.year}`};
  return merged.map(item=>{
    const inferred=examTopic(item.stem,item.options);
    const skill:Skill=item.part==='reading'?'doc-hieu':item.part==='pronunciation'?'tu-vung':item.part==='transformation'?'viet-cau':inferred.skill;
    const sourceRef=`${seed.year} | ${seed.province} | ${seed.kind} | Mã đề ${ext.examCode} | Question ${item.number} | ${OCR_STATUS}`;
    return {source,sourceId:source.id,sourceName:source.name,sourceUrl:seed.url,sourceRef,license:source.license,crawledAt:ext.crawledAt,kind:'exam-'+item.part,skill,grade:seed.grade,stem:item.stem,original:item.stem,choices:item.options,answer:item.options['ABCD'.indexOf(item.correctKey)],
      explanation:`Đáp án ${item.correctKey} theo đáp án chính thức (mã đề ${ext.examCode}), câu ${item.number} (${seed.province}, ${seed.year}). Nội dung chép lại từ bản scan (${OCR_STATUS}); chờ chủ sở hữu duyệt.`,
      ...(item.part==='pronunciation'?{topicSlug:'phat-am-trong-am'}:item.part==='transformation'?{topicSlug:'viet-lai-cau'}:item.part==='mcq'?{topicSlug:inferred.slug}:{}),
      ...(item.passage?{passage:{id:'gov-p-'+hash(seed.url+'|'+item.passage).slice(0,12),sourceId:source.id,sourceUrl:seed.url,sourceName:source.name,license:source.license,crawledAt:ext.crawledAt,title:`${seed.kind} – ${seed.year}`,body:item.passage,wordCount:words(item.passage).length,level:Math.min(5,seed.grade-4)}}:{})};
  });
}
export function ocrOutcome(ext:OcrExtraction):{outcome:OcrOutcome;candidates:Candidate[]}{
  const result=mergePasses(ext);
  return {candidates:ocrCandidates(ext,result.items),outcome:{...summarize(result),examCode:ext.examCode,keyCode:ext.keyCode,method:'ocr-transcribed',models:[ext.passA.model,ext.passB.model],rejectedItems:result.rejected.map(r=>({number:r.number,reason:r.reason}))}};
}
