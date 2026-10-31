export type Skill = 'doc-hieu' | 'ngu-phap' | 'tu-vung' | 'viet-cau';
export type Key = 'A' | 'B' | 'C' | 'D';
export interface Source { id:string; name:string; baseUrl:string; license:string; attribution:string }
export interface Provenance { sourceId:string; sourceUrl:string; sourceName:string; license:string; crawledAt:string; sourceRef:string }
export interface Article { id:string; url:string; title:string; date:string; paragraphs:string[]; glossary:{word:string;definition:string}[]; level?:number; crawledAt:string }
export interface Passage { id:string; sourceId:string; sourceUrl:string; sourceName:string; license:string; crawledAt:string; title:string; body:string; wordCount:number; level:number }
export interface Candidate extends Provenance { source:Source; kind:string; skill:Skill; stem:string; original:string; answer:string; choices:string[]; explanation:string; topicSlug?:string; passage?:Passage; grade?:number; score?:number; difficulty?:number }
export interface Question extends Provenance { id:string; type:'mcq'; grade:number; skill:Skill; topicSlug:string; difficulty:number; passageId?:string; stem:string; options:{key:Key;text:string}[]; correctKey:Key; explanation:string; reviewStatus:'quarantine' }
export interface Bundle { sources:Source[]; passages:Passage[]; topics:{grade:number;skill:Skill;slug:string;name:string;description:string}[]; questions:Question[]; tests:[] }
export const VOA:Source={id:'voa-learning-english',name:'VOA Learning English',baseUrl:'https://learningenglish.voanews.com',license:'Public domain (work of the US Government)',attribution:'VOA Learning English – Voice of America, public domain'};
