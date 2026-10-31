import derivations from '../rules/derivations.json' with {type:'json'};
import type { Article, Candidate } from '../model.js';
import type { Corpus } from '../classify.js';
import { words, shuffle } from '../util.js';
import { articleSentences, blankWord, candidate } from './common.js';
import { identifyVerb } from './grammar.js';
export function category(word:string,corpus:Corpus):string|undefined{
 if(/ly$/.test(word))return 'adverb';if(/(?:ful|less|ous|ive|able|ible|al|ic)$/.test(word))return 'adjective';if(/(?:tion|sion|ment|ness|ity|ship)s?$/.test(word))return 'noun';
 if(/(?:ed|ing)$/.test(word)||identifyVerb(word,corpus))return 'verb';return undefined;
}
const inflection=(word:string)=>/(ed|ing|ly|s)$/.exec(word)?.[1]??'';
export function vocabularyItems(article:Article,corpus:Corpus):Candidate[]{
 const out:Candidate[]=[];const preferred=new Set(article.glossary.map(g=>g.word.toLowerCase()));
 for(const sentence of articleSentences(article)){
 const tokens=words(sentence);const candidates=[...new Set(tokens)].sort((a,b)=>Number(preferred.has(b))-Number(preferred.has(a))||a.localeCompare(b));
 for(const word of candidates){if(word.length<4)continue;const kind=category(word,corpus);if(!kind)continue;const count=corpus.counts.get(word)??1;
 const pool=[...corpus.counts].filter(([other,n])=>other!==word&&!tokens.includes(other)&&category(other,corpus)===kind&&inflection(word)===inflection(other)&&Math.abs(Math.log2(n)-Math.log2(count))<=1).map(([w])=>w).sort();if(pool.length<3)continue;
 const exact=sentence.match(new RegExp(`\\b${word}\\b`,'i'))?.[0];if(!exact||exact!==exact.toLowerCase()||sentence.search(new RegExp(`\\b${exact}\\b`))===0)continue; // skip capitalised words (case leaks the answer) and sentence-initial blanks
 out.push(candidate(article,corpus,'tu-vung','content-cloze',sentence,blankWord(sentence,exact),exact,[exact,...shuffle(pool,article.id+'|'+out.length).slice(0,3)],out.length,'Từ trong bài gốc phù hợp với ngữ cảnh; các lựa chọn có cùng nhóm từ và dạng biến đổi.'));break;
 }
 for(const family of derivations.families){if(!family.every(w=>corpus.counts.has(w)))continue;const word=family.find(w=>tokens.includes(w));if(!word)continue;const index=family.indexOf(word);
 // Restrict derivational questions to slots with a visible syntactic signal.
 const signals=[new RegExp(`\\b(?:to|will|must|can) ${word}\\b`),new RegExp(`\\b(?:a|the|this|their) ${word}\\b`),new RegExp(`\\b(?:very|seems|is) ${word}\\b`),new RegExp(`\\b${word} [a-z]+(?:ed|ing)\\b`)];
 if(!signals[index].test(sentence))continue;const item=candidate(article,corpus,'tu-vung','word-form',sentence,blankWord(sentence,word),word,family,out.length,`Vị trí trong câu cần ${['động từ','danh từ','tính từ','trạng từ'][index]} trong họ từ này.`);item.topicSlug='dang-tu';out.push(item);}
 }
 return out;
}
