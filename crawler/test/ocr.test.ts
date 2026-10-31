import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canon, mergePasses, partOf, summarize, underlines, validateExtraction, type OcrExtraction, type OcrItem } from '../src/ocr/merge.js';
import { ocrCandidates, ocrOutcome } from '../src/ocr/candidates.js';
import { assemble } from '../src/bank.js';
import { corpusStats } from '../src/classify.js';
const instruction='Mark the letter A, B, C, or D on your answer sheet to indicate the correct answer to each of the following questions.';
const item=(number:number,extra:Partial<OcrItem>={}):OcrItem=>({number,instruction,passage:null,stem:`Question stem ${number} ______ here.`,options:['one','two','three','four'],needsFigure:false,...extra});
const ext=(a:OcrItem[],b:OcrItem[],ka:Record<string,string|null>,kb:Record<string,string|null>=ka):OcrExtraction=>({schema:1,seed:{url:'https://hanoi.edu.vn/x.pdf',answerKeyUrl:'https://hanoi.edu.vn/k.pdf',year:2025,province:'Hà Nội',grade:9,kind:'tuyen-sinh-10-ngoai-ngu-khong-chuyen'},examCode:'001',keyCode:'001',header:'h',pages:{exam:1,key:1},crawledAt:'2026-10-31T14:00:00.000Z',passA:{method:'ocr-transcribed',model:'model-a',items:a,key:ka},passB:{method:'ocr-transcribed',model:'model-b',items:b,key:kb}});
describe('ocr merge', () => {
  it('keeps an item only when both passes agree on text and key', () => {
    const r=mergePasses(ext([item(1)],[item(1)],{'1':'B'}));
    expect(r.items).toHaveLength(1);expect(r.items[0]).toMatchObject({number:1,correctKey:'B',part:'mcq'});expect(r.rejected).toEqual([]);
  });
  it('rejects text disagreement, key disagreement and missing keys with counted reasons', () => {
    const r=mergePasses(ext([item(1),item(2),item(3),item(4)],[item(1,{options:['one','two','three','fourr']}),item(2),item(3),item(4)],{'1':'A','2':'A','3':null},{'1':'A','2':'B','3':'A'}));
    expect(r.items).toHaveLength(0);
    expect(Object.fromEntries(r.rejected.map(x=>[x.number,x.reason]))).toEqual({1:'text-mismatch',2:'key-mismatch',3:'key-missing',4:'key-missing'});
    expect(summarize(r).byReason).toEqual({'key-mismatch':1,'key-missing':2,'text-mismatch':1});
  });
  it('drops items without any official key entry (never guesses one)', () => {
    expect(mergePasses(ext([item(5)],[item(5)],{})).items).toHaveLength(0);
    expect(mergePasses(ext([item(5)],[item(5)],{'5':'E'})).rejected[0].reason).toBe('key-missing');
  });
  it('rejects items present in one pass only, figure-dependent, unreadable and invalid options', () => {
    const r=mergePasses(ext([item(1),item(2,{needsFigure:true}),item(3,{unreadable:true}),item(4,{options:['a','a','b','c']})],[item(2,{needsFigure:true}),item(3),item(4,{options:['a','a','b','c']})],{'1':'A','2':'A','3':'A','4':'A'}));
    expect(Object.fromEntries(r.rejected.map(x=>[x.number,x.reason]))).toEqual({1:'missing-in-one-pass',2:'figure-dependent',3:'unreadable',4:'invalid-options'});
  });
  it('ignores formatting-only differences but not misread words', () => {
    expect(canon('Don\u2019t \u201cgo\u201d \u2013 now')).toBe(canon("Don't \"go\" - now"));
    expect(canon('a ______ b')).toBe(canon('a _____ b'));
    const a=item(1,{stem:'He said \u201chi\u201d.'}),b=item(1,{stem:'He said "hi".'});
    expect(mergePasses(ext([a],[b],{'1':'A'})).items).toHaveLength(1);
    expect(mergePasses(ext([item(1,{stem:'in front of the board'})],[item(1,{stem:'in front the board'})],{'1':'A'})).rejected[0].reason).toBe('text-mismatch');
  });
  it('tolerates passage/stem splitting and blank labels but requires equal underlines', () => {
    const a=item(8,{stem:'Dialogue intro.',passage:'- Emily: Hi'}),b=item(8,{stem:'- Emily: Hi',passage:'Dialogue intro.'});
    expect(mergePasses(ext([a],[b],{'8':'C'})).items).toHaveLength(1);
    expect(mergePasses(ext([item(13,{stem:'(13)',passage:'text (13)______ more'})],[item(13,{stem:'',passage:'text ______ more'})],{'13':'A'})).items).toHaveLength(1);
    expect(underlines('pr<u>o</u>blem p<u>o</u>pular')).toEqual(['o','o']);
    const u1=item(4,{stem:'',options:['purpo<u>se</u>','surprise','course','practise']}),u2=item(4,{stem:'',options:['purpo<u>s</u>e','surprise','course','practise']});
    expect(mergePasses(ext([u1],[u2],{'4':'B'})).rejected[0].reason).toBe('underline-mismatch');
  });
  it('classifies parts from the printed instruction', () => {
    expect(partOf('... differs from the other three in pronunciation ...',false)).toBe('pronunciation');
    expect(partOf('... the position of primary stress ...',false)).toBe('pronunciation');
    expect(partOf('... closest in meaning to the original sentence ...',false)).toBe('transformation');
    expect(partOf('... best made from the given cues ...',false)).toBe('transformation');
    expect(partOf(instruction,true)).toBe('reading');expect(partOf(instruction,false)).toBe('mcq');
  });
  it('requires independent passes and a complete header', () => {
    const good=ext([item(1)],[item(1)],{'1':'A'});expect(validateExtraction(good)).toBe(good);
    expect(()=>validateExtraction({...good,passB:{...good.passB,model:'model-a'}})).toThrow(/independent/);
    expect(()=>validateExtraction({...good,crawledAt:''})).toThrow(/header/);
    expect(()=>validateExtraction({...good,schema:2})).toThrow();
  });
  it('builds quarantine candidates with provenance and passes the bank gates', () => {
    const e=ext([item(1,{stem:'He ______ to school.',options:['go','goes','going','gone']}),item(2,{stem:'(2)',passage:'A short text with a blank (2)______ in it for the reader.',options:['aa','bb','cc','dd']})],[item(1,{stem:'He ______ to school.',options:['go','goes','going','gone']}),item(2,{stem:'(2)',passage:'A short text with a blank (2)______ in it for the reader.',options:['aa','bb','cc','dd']})],{'1':'B','2':'C'});
    const {candidates,outcome}=ocrOutcome(e);
    expect(outcome).toMatchObject({kept:2,rejected:0,examCode:'001',method:'ocr-transcribed'});
    expect(candidates[0]).toMatchObject({sourceUrl:e.seed.url,license:'Văn bản chính thức của cơ quan nhà nước',crawledAt:e.crawledAt,answer:'goes',kind:'exam-mcq',grade:9});
    expect(candidates[0].sourceRef).toContain('ocr-transcribed');expect(candidates[1].passage?.body).toContain('short text');expect(candidates[1].answer).toBe('cc');
    const bank=assemble(ocrCandidates(e,mergePasses(e).items),corpusStats([]));
    const questions=bank.bundles.flatMap(b=>b.bundle.questions);
    expect(questions).toHaveLength(2);expect(questions.every(q=>q.reviewStatus==='quarantine')).toBe(true);
    expect(JSON.stringify(assemble(candidates,corpusStats([])).bundles)).toBe(JSON.stringify(bank.bundles));
  });
  it('does not collapse same-numbered blanks of different papers as duplicates', () => {
    const mk=(code:string)=>({...ext([item(13,{stem:'(13)',passage:'Some passage text with a blank (13)______ right here today.'})],[item(13,{stem:'(13)',passage:'Some passage text with a blank (13)______ right here today.'})],{'13':'A'}),examCode:code});
    const all=[mk('001'),mk('002')].flatMap(e=>ocrCandidates(e,mergePasses(e).items));
    expect(assemble(all,corpusStats([])).bundles.flatMap(b=>b.bundle.questions)).toHaveLength(2);
  });
});
describe('committed Hà Nội extractions', () => {
  it('validate, are deterministic and every kept item has an agreed official key', async () => {
    const dir=resolve('ocr');const names=(await readdir(dir)).filter(n=>n.endsWith('.json')).sort();expect(names.length).toBeGreaterThanOrEqual(3);
    for(const name of names){
      const e=validateExtraction(JSON.parse(await readFile(resolve(dir,name),'utf8')));const a=mergePasses(e),b=mergePasses(e);
      expect(a).toEqual(b);expect(a.items.length+a.rejected.length).toBe(a.extracted);
      for(const i of a.items){expect(e.passA.key[String(i.number)]).toBe(i.correctKey);expect(e.passB.key[String(i.number)]).toBe(i.correctKey);expect(i.options).toHaveLength(4);}
    }
  });
});
