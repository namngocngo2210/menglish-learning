import type { Article, Candidate, Passage, Skill } from '../model.js';
import { VOA } from '../model.js';
import { classify, type Corpus } from '../classify.js';
import { hash, sentences, shuffle, words } from '../util.js';
export function passageFor(article:Article):Passage|undefined{
 const kept:string[]=[];let count=0;for(const paragraph of article.paragraphs){const n=words(paragraph).length;if(count+n>400)break;kept.push(paragraph);count+=n;}
 if(count<80)return undefined;
 return {id:'voa-p-'+hash(article.id+'|'+kept.join('\n\n')).slice(0,12),sourceId:VOA.id,sourceUrl:article.url,sourceName:VOA.name,license:VOA.license,crawledAt:article.crawledAt,title:article.title,body:kept.join('\n\n'),wordCount:count,level:article.level??2};
}
export function candidate(article:Article,corpus:Corpus,skill:Skill,kind:string,original:string,stem:string,answer:string,choices:string[],index:number,rule:string):Candidate{
 const classification=classify(original,corpus,article.level);
 return {source:VOA,sourceId:VOA.id,sourceName:VOA.name,license:VOA.license,sourceUrl:article.url,sourceRef:`VOA ${article.id} | ${kind} ${index}`,crawledAt:article.crawledAt,skill,kind,original,stem,answer,choices:shuffle(choices,`${article.id}|${index}`),explanation:`Đáp án đúng là “${answer}”: ${rule}`, ...classification};
}
export function articleSentences(article:Article):string[]{return article.paragraphs.flatMap(sentences).filter(s=>s.length<=360&&words(s).length>=6&&!/["“”]|https?:|\b(?:AP|Reuters|VOA)\b/.test(s));}
export function blankWord(sentence:string,word:string):string{return sentence.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`),'___');}
