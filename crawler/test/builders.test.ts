import { expect, it } from 'vitest';
import { grammarItems, vocabularyItems, readingItems, wordOrderItems } from '../src/build/index.js';
import { corpusStats } from '../src/classify.js';
import { rejection } from '../src/bank.js';
import type { Article, Candidate } from '../src/model.js';
const make=(text:string):Article=>({id:'42',url:'https://learningenglish.voanews.com/a/42.html',title:'Example',date:'2021-01-01',paragraphs:[text],glossary:[],crawledAt:'2026-01-01T00:00:00Z'});
function choices(item:Candidate){expect(item.choices).toHaveLength(4);expect(new Set(item.choices.map(s=>s.toLowerCase())).size).toBe(4);expect(item.choices.filter(s=>s===item.answer)).toHaveLength(1);}
it('produces verb forms, fixed prepositions, comparison and agreement',()=>{
 const article=make('She has written a long letter to her family. They depend on clean water every day. This tree is taller than the old house. They are working in the garden now.');const stats=corpusStats(article.paragraphs);
 const items=grammarItems(article,stats);expect(new Set(items.map(x=>x.kind))).toEqual(new Set(['verb-form','function-word','comparison','agreement']));
 for(const item of items){choices(item);expect(item.stem.match(/___/g)).toHaveLength(1);expect(rejection(item,stats)).toBeUndefined();}
});
it('builds frequency-matched content cloze from real corpus words',()=>{
 const article=make('The government announced a useful protection plan for forests.');const stats=corpusStats([...article.paragraphs,'People need education and information about pollution.']);
 const items=vocabularyItems(article,stats).filter(x=>x.kind==='content-cloze');expect(items.length).toBeGreaterThan(0);
 for(const item of items){choices(item);expect(item.stem.replace('___',item.answer)).toBe(item.original);expect(rejection(item,stats)).toBeUndefined();}
});
it('requires four corpus-attested family members for a word-form item',()=>{
 const article=make('The director will decide the result after the meeting.');const stats=corpusStats([...article.paragraphs,'The decision was decisive and expressed decisively.']);
 const items=vocabularyItems(article,stats).filter(x=>x.kind==='word-form');expect(items).toHaveLength(1);choices(items[0]);expect(items[0].answer).toBe('decide');expect(vocabularyItems(article,corpusStats(article.paragraphs)).filter(x=>x.kind==='word-form')).toEqual([]);
});
it('does not emit a passage shorter than eighty words or cut a paragraph',()=>{
 const short=make('She has written a letter to her family.');expect(readingItems(short,corpusStats(short.paragraphs))).toEqual([]);
 const large={...short,paragraphs:[Array(401).fill('word').join(' ')]};expect(readingItems(large,corpusStats(large.paragraphs))).toEqual([]);
});
it('skips ambiguous grammar and non-simple word-order sentences',()=>{
 const article=make('She may come to the meeting tomorrow. A tall tree grows near the river. He said, "I have a large garden."');const stats=corpusStats(article.paragraphs);
 expect(grammarItems(article,stats).some(i=>['may','the','a'].includes(i.answer))).toBe(false);expect(wordOrderItems(article,stats)).toEqual([]);
});
it('builds past and perfect agreement only with explicit subject evidence',()=>{
 const article=make('They were walking near the river yesterday. She has written a letter to her parents.');const stats=corpusStats(article.paragraphs);
 const items=grammarItems(article,stats).filter(i=>i.kind==='agreement');expect(items.map(i=>i.answer)).toEqual(['were','has']);for(const item of items){choices(item);expect(rejection(item,stats)).toBeUndefined();}
});
it('supports analytic comparison and possessive pronoun cloze',()=>{
 const article=make('This garden is more beautiful than the public park. She visits her mother in the village every week.');const stats=corpusStats(article.paragraphs);
 const items=grammarItems(article,stats);expect(items.some(i=>i.answer==='more beautiful')).toBe(true);expect(items.some(i=>i.answer==='her')).toBe(true);for(const item of items){choices(item);expect(rejection(item,stats)).toBeUndefined();}
});
it('recognizes common regular base verbs and doubled inflections',()=>{
 const article=make('She will walk to the village after school. They have stopped the car near a small house.');const stats=corpusStats([...article.paragraphs,'People walk and stop.']);
 const items=grammarItems(article,stats).filter(i=>i.kind==='verb-form');expect(items.map(i=>i.answer)).toEqual(['walk','stopped']);expect(items.find(i=>i.answer==='stopped')?.choices).toContain('stopping');for(const item of items)choices(item);
});
