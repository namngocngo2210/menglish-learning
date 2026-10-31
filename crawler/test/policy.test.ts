import { expect, it } from 'vitest';
import { parseVoa } from '../src/sources/voa.js';
import { govItems } from '../src/sources/gov.js';
import { assemble, rejection } from '../src/bank.js';
import { corpusStats } from '../src/classify.js';
import { grammarItems } from '../src/build/index.js';
import irregular from '../src/rules/irregular-verbs.json' with {type:'json'};
import type { Article } from '../src/model.js';
const seed={url:'https://moet.gov.vn/exam.pdf',year:2025,province:'Hà Nội',grade:9,kind:'entrance10'};
it('does not interpret the first word of a question as its key',()=>{
 expect(govItems('1. A farmer works here. A. one B. two C. three D. four','1. A farmer works here. A. one B. two C. three D. four',seed,'2026-01-01T00:00:00Z')).toEqual([]);
});
it('uses a labeled answer section in the same paper',()=>{
 const text='1. A farmer works here. A. one B. two C. three D. four\nĐÁP ÁN\n1. B';
 expect(govItems(text,text,seed,'2026-01-01T00:00:00Z')[0]?.answer).toBe('two');
});
it('checks photo captions for wire-service credits',()=>{
 const html='<h1>Garden</h1><time datetime="2020-01-01"></time><div class="authors">VOA Learning English</div><div class="caption">Photo by Reuters</div><div class="wsw"><p>Plants grow in a garden every year.</p></div>';
 expect(parseVoa(html,'https://learningenglish.voanews.com/a/123.html')).toBeNull();
});
it('has at least 150 explicit irregular verb entries',()=>expect(Object.keys(irregular).length).toBeGreaterThanOrEqual(150));
it('checks blank, missing passage, source evidence and matching metadata',()=>{
 const a:Article={id:'1',url:'https://learningenglish.voanews.com/a/1.html',title:'Test',date:'2020-01-01',crawledAt:'2026-01-01T00:00:00Z',paragraphs:['She has written a long letter to her family.'],glossary:[]};const corpus=corpusStats(a.paragraphs);const item=grammarItems(a,corpus)[0];
 expect(rejection({...item,stem:'No blank.'},corpus)).toBe('blank-count');
 expect(rejection({...item,skill:'doc-hieu'},corpus)).toBe('missing-passage');
 expect(rejection({...item,license:'unknown'},corpus)).toBe('provenance');
 expect(rejection({...item,original:'Different sentence.'},corpus)).toBe('answer-context');
 const result=assemble([],corpus); expect(result.bundles).toHaveLength(8);expect(result.bundles.every(b=>b.bundle.tests.length===0&&b.bundle.questions.length===0)).toBe(true);
});
it('classifies official function-word options as grammar',()=>{
 const items=govItems('1. He arrived ___ London. A. in B. on C. at D. by','1. A',seed,'2026-01-01T00:00:00Z');
 expect(items[0]?.skill).toBe('ngu-phap');expect(items[0]?.topicSlug).toBe('gioi-tu');
});
