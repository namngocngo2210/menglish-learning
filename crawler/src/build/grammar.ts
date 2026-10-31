import irregular from '../rules/irregular-verbs.json' with {type:'json'};
import regular from '../rules/regular-verbs.json' with {type:'json'};
import closed from '../rules/closed-classes.json' with {type:'json'};
import type { Article, Candidate } from '../model.js';
import type { Corpus } from '../classify.js';
import { articleSentences, blankWord, candidate } from './common.js';
export interface Forms { base:string;past:string;participle:string;s:string;ing:string }
export function forms(base:string):Forms{
 const known=(irregular as Record<string,Omit<Forms,'base'>>)[base];if(known)return {base,...known};
 const doubled=regular.doubleFinal.includes(base);
 const consonantY=/[^aeiou]y$/.test(base);const ed=base.endsWith('e')?base+'d':doubled?base+base.at(-1)+'ed':consonantY?base.slice(0,-1)+'ied':base+'ed';
 const ing=base.endsWith('ie')?base.slice(0,-2)+'ying':base.endsWith('e')&&!regular.keepFinalE.includes(base)?base.slice(0,-1)+'ing':doubled?base+base.at(-1)+'ing':base+'ing';
 return {base,past:ed,participle:ed,s:consonantY?base.slice(0,-1)+'ies':/(?:s|x|z|ch|sh|o)$/.test(base)?base+'es':base+'s',ing};
}
const verbIndexes=new WeakMap<Corpus,Map<string,Forms>>();
export function identifyVerb(word:string,corpus:Corpus):Forms|undefined{
 let index=verbIndexes.get(corpus);
 if(!index){
 index=new Map<string,Forms>();
 for(const base of Object.keys(irregular)){const entry=forms(base);for(const form of Object.values(entry))if(!index.has(form))index.set(form,entry);}
 // Build the corpus-derived regular inflection index once, rather than
 // scanning the entire vocabulary for each distractor in each sentence.
 for(const base of regular.bases){if(!corpus.counts.has(base))continue;const entry=forms(base);for(const form of Object.values(entry))if(!index.has(form))index.set(form,entry);}
 for(const base of [...corpus.counts.keys()].sort()){if(!/^[a-z]{3,}$/.test(base))continue;const entry=forms(base);for(const form of Object.values(entry))if(form!==base&&!index.has(form))index.set(form,entry);}
 verbIndexes.set(corpus,index);
 }
 return index.get(word);
}
export function grammarItems(article:Article,corpus:Corpus):Candidate[]{
 const out:Candidate[]=[];
 for(const sentence of articleSentences(article)){
 for(const match of sentence.matchAll(/\b(have|has|had|is|are|was|were|will|to|can|could|must|should|may|might|would)\s+([a-z]+)\b/g)){
 const signal=match[1],word=match[2];const verb=identifyVerb(word,corpus);if(!verb)continue;
 const expected=/^(?:have|has|had)$/.test(signal)?verb.participle:/^(?:is|are|was|were)$/.test(signal)?verb.ing:verb.base;
 if(word!==expected)continue;const choices=[...new Set([verb.base,verb.s,verb.past,verb.ing,verb.participle])];if(choices.length<4)continue;
 // A base and participle may be identical; in those cases the distinct choices
 // still represent different surface forms and exactly one fills this slot.
 const selected=[word,...choices.filter(w=>w!==word).slice(0,3)];
 const stem=sentence.slice(0,match.index!)+match[0].replace(new RegExp(`${word}$`),'___')+sentence.slice(match.index!+match[0].length);
 out.push(candidate(article,corpus,'ngu-phap','verb-form',sentence,stem,word,selected,out.length,`Sau “${signal}”, cấu trúc này dùng dạng ${/^(?:have|has|had)$/.test(signal)?'phân từ quá khứ':/^(?:is|are|was|were)$/.test(signal)?'V-ing':'nguyên thể'} của động từ “${verb.base}”.`));
 }
 const agreement=/^(He|She|It|They|We|You|I) (is|are|am)\b/.exec(sentence);
 if(agreement&&({He:'is',She:'is',It:'is',They:'are',We:'are',You:'are',I:'am'} as Record<string,string>)[agreement[1]]===agreement[2]){
 const item=candidate(article,corpus,'ngu-phap','agreement',sentence,blankWord(sentence,agreement[2]),agreement[2],['is','are','am','be'],out.length,`Chủ ngữ “${agreement[1]}” đi với “${agreement[2]}” ở hiện tại.`);item.topicSlug='su-hoa-hop-chu-vi';out.push(item);}
 const perfectAgreement=/^(He|She|It|They|We|You|I) (has|have) ([a-z]+)\b/.exec(sentence);
 if(perfectAgreement){const [,subject,answer,participle]=perfectAgreement;const verb=identifyVerb(participle,corpus);const singular=['He','She','It'].includes(subject);if(verb&&participle===verb.participle&&answer===(singular?'has':'have')){
 const options=singular?['has','have','am','are']:['have','has','am','is'];
 const item=candidate(article,corpus,'ngu-phap','agreement',sentence,blankWord(sentence,answer),answer,options,out.length,`Chủ ngữ “${subject}” dùng “${answer}” trong cấu trúc hiện tại hoàn thành.`);item.topicSlug='su-hoa-hop-chu-vi';out.push(item);}}
 const pastAgreement=/^(He|She|It|They|We|You|I) (was|were)\b/.exec(sentence);
 if(pastAgreement&&/\b(?:yesterday|last (?:week|year|month)|ago)\b/.test(sentence)){const [,subject,answer]=pastAgreement;const singular=['He','She','It','I'].includes(subject);if(answer===(singular?'was':'were')){
 const item=candidate(article,corpus,'ngu-phap','agreement',sentence,blankWord(sentence,answer),answer,['was','were',...(subject==='I'?['is','are']:['am','be'])],out.length,`Chủ ngữ “${subject}” dùng “${answer}” trong câu trần thuật quá khứ với dấu hiệu thời gian rõ ràng.`);item.topicSlug='su-hoa-hop-chu-vi';out.push(item);}}
 // Closed-class cloze only for lexically fixed constructions. Open choices
 // such as can/may/must or a/the are deliberately never generated.
 for(const match of sentence.matchAll(/\b(depend|depends|depending|relies|rely|insist|insists) (on)\b/g)){
 const index=match.index!+match[0].length-2;const item=candidate(article,corpus,'ngu-phap','function-word',sentence,sentence.slice(0,index)+'___'+sentence.slice(index+2),'on',['on',...closed.prepositions.filter(w=>w!=='on').slice(0,3)],out.length,`Cụm “${match[1]} on” dùng giới từ “on”.`);item.topicSlug='gioi-tu';out.push(item);}
 const possessives:Record<string,string[]>={his:['he','him','his','himself'],her:['she','her','hers','herself'],their:['they','them','their','themselves']};
 for(const match of sentence.matchAll(/\b(his|her|their) (?:mother|father|family|brother|sister|country|school|house)\b/g)){
 const answer=match[1];if(!possessives[answer].every(w=>closed.pronouns.includes(w)))continue;
 const item=candidate(article,corpus,'ngu-phap','function-word',sentence,blankWord(sentence,answer),answer,possessives[answer],out.length,`Trước danh từ chỉ người/vật cần tính từ sở hữu “${answer}”, không dùng đại từ chủ ngữ, tân ngữ hay phản thân.`);item.topicSlug='dang-tu';out.push(item);}
 for(const adjective of ['beautiful','important','difficult','expensive','interesting']){
 const match=new RegExp(`\\b(more ${adjective}) than\\b`).exec(sentence)??new RegExp(`\\bthe (most ${adjective}) (?:of all|in the)\\b`).exec(sentence);if(!match)continue;
 const answer=match[1];const item=candidate(article,corpus,'ngu-phap','comparison',sentence,blankWord(sentence,answer),answer,[adjective,`more ${adjective}`,`most ${adjective}`,`as ${adjective} as`],out.length,'Tính từ dài dùng “more” với “than”, hoặc “the most” khi so sánh nhất.');item.topicSlug='so-sanh';out.push(item);}
 const adjectives:Record<string,[string,string,string]>={tall:['taller','tallest','more tall'],small:['smaller','smallest','more small'],long:['longer','longest','more long'],fast:['faster','fastest','more fast'],young:['younger','youngest','more young'],old:['older','oldest','more old']};
 for(const [base,[comparative,superlative]] of Object.entries(adjectives)){
 const match=new RegExp(`\\b(${comparative}) than\\b`).exec(sentence)??new RegExp(`\\bthe (${superlative}) (?:of all|in the)\\b`).exec(sentence);if(!match)continue;
 const answer=match[1];const item=candidate(article,corpus,'ngu-phap','comparison',sentence,blankWord(sentence,answer),answer,[base,comparative,superlative,`as ${base} as`],out.length,'Dấu hiệu “than” dùng so sánh hơn; cấu trúc “the … of all/in the” dùng so sánh nhất.');item.topicSlug='so-sanh';out.push(item);}
 }
 return out;
}
