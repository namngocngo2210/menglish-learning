import { describe, expect, it } from 'vitest';
import { parseVoa, articleUrl, sitemapUrls } from '../src/sources/voa.js';
import { parseExam, parseAnswerKey } from '../src/parse/exam.js';
import { allowedGovUrl } from '../src/sources/gov.js';
const html = (author: string, extra = '', caption = '') => `<script type="application/ld+json">${JSON.stringify({author:{'@type':'Person',name:author},datePublished:'2020-01-01 00:00:00Z'})}</script><h1>A clean story</h1><div class="wsw"><figure><figcaption><span class="caption">${caption}</span></figcaption></figure><p>Plants need clean water to grow in the garden.</p><p>Gardens help birds and bees live in the city.</p><p>Many people grow food on small balconies.</p><p>Clean water is important for every plant.</p>${extra}<h2>Words in This Story</h2><p><b>garden</b> - n. a place to grow plants</p></div>`;
describe('VOA parsing', () => {
 const url='https://learningenglish.voanews.com/a/123.html';
 it('retains original paragraphs and separates glossary', () => { const a = parseVoa(html('VOA Learning English'), url); expect(a?.paragraphs).toHaveLength(4); expect(a?.glossary[0]).toEqual({word:'garden', definition:'a place to grow plants'}); });
 it('ignores separately credited image captions', () => expect(parseVoa(html('VOA Learning English','','A bird (AP Photo)'), url)?.paragraphs).toHaveLength(4));
 it.each(['AP','Reuters','Associated Press','Jane Smith','VOA and Example News',''])('rejects non-VOA author %s', author => expect(parseVoa(html(author), url)).toBeNull());
 it.each(['<p>Mike Smith reported this story for the Associated Press.</p>','<p>Reporting by Reuters.</p>','<p>(AP) Plants grow.</p>','<p>Copyright Example Agency.</p>'])('rejects third-party text %s', extra => expect(parseVoa(html('VOA Learning English', extra), url)).toBeNull());
 it('only accepts article paths and reads sitemap locations', () => { expect(articleUrl('https://learningenglish.voanews.com/a/story/123.html')).toBe(true); expect(articleUrl('https://learningenglish.voanews.com/z/123')).toBe(false); expect(sitemapUrls('<urlset><url><loc>https://example.org/a</loc></url></urlset>')).toEqual(['https://example.org/a']); });
});
describe('official exams', () => {
 it('parses unambiguous keys and discards conflicts', () => expect([...parseAnswerKey('1. A 2. C\nCâu 3: B\n3. D')]).toEqual([[1,'A'],[2,'C']]));
 it('attaches reading passages and preserves item wording', () => {
 const text = 'Read the following passage and answer questions 1 to 2.\nA small bird lives near the river.\nQuestion 1. Where does the bird live?\nA. Near the river B. At school C. In town D. At sea\n2. What is small?\nA. A house B. A bird C. A town D. A tree';
 const items=parseExam(text, parseAnswerKey('1. A 2. B')); expect(items).toHaveLength(2); expect(items[0].passage).toContain('A small bird'); expect(items[1].passage).toBe(items[0].passage); expect(items[0].stem).toBe('Where does the bird live?');
 });
 it('skips missing keys and malformed options', () => expect(parseExam('1. Choose a word. A. one B. two C. three D. four', new Map())).toEqual([]));
 it('maps section instructions to pronunciation and transformations', () => { const items=parseExam('Choose the word with different stress.\n1. Choose a word. A. one B. two C. three D. four\nChoose the sentence closest in meaning.\n2. She is happy. A. one B. two C. three D. four', parseAnswerKey('1. A 2. B')); expect(items.map(x=>x.kind)).toEqual(['pronunciation','transformation']); });
 it('enforces host boundaries and forbidden names', () => { for(const url of ['https://moet.gov.vn/a.pdf','https://sogd.hanoi.edu.vn/a.pdf']) expect(allowedGovUrl(url)).toBe(true); for(const url of ['https://evil.edu.vn/a.pdf','https://moet.gov.vn.evil.com/a.pdf','https://vndoc.gov.vn/a.pdf','http://moet.gov.vn/a.pdf']) expect(allowedGovUrl(url)).toBe(false); });
});
it('does not treat a question beginning with an English article as an answer-key row',()=>{
 expect([...parseAnswerKey('1. A farmer lives near the river.\n2. B is a letter.')]).toEqual([]);
});
