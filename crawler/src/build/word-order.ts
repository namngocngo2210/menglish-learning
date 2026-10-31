import type { Article, Candidate } from '../model.js';
import type { Corpus } from '../classify.js';
import { words } from '../util.js';
import { articleSentences, candidate } from './common.js';
export function wordOrderItems(article:Article,corpus:Corpus):Candidate[]{
 const out:Candidate[]=[];
 for(const sentence of articleSentences(article)){
 const tokens=sentence.replace(/[.!?]$/,'').split(/\s+/);if(tokens.length<6||tokens.length>14||/[,;:()“”"'’]/.test(sentence)||! /^(?:He|She|They|We|It|You) (?:has|have|is|are|was|were|will|can|must) [a-z]+\b/.test(sentence)||!sentence.endsWith('.'))continue;
 const [subject,aux,...rest]=tokens;const bad=[`${aux} ${rest[0]} ${subject} ${rest.slice(1).join(' ')}.`,`${subject} ${rest.join(' ')} ${aux}.`,`${rest.join(' ')} ${aux} ${subject}.`];
 if(new Set([sentence,...bad].map(s=>s.toLowerCase())).size!==4||words(sentence).length!==tokens.length)continue;
 const item=candidate(article,corpus,'viet-cau','word-order',sentence,`Choose the correct order: ${tokens.join(' / ')}`,sentence,[sentence,...bad],out.length,'Câu gốc theo trật tự chủ ngữ, trợ động từ và phần còn lại của câu.');item.topicSlug='sap-xep-tu';out.push(item);
 }
 return out;
}
