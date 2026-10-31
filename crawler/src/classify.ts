import closed from './rules/closed-classes.json' with {type:'json'};
import grammar from './rules/grade-grammar.json' with {type:'json'};
import topics from './rules/topics.json' with {type:'json'};
import { normalize, sentences, words } from './util.js';
import type { Skill } from './model.js';
export interface Corpus { counts:Map<string,number>; rank:Map<string,number>; sentences:Set<string> }
export function corpusStats(texts:string[]):Corpus{const counts=new Map<string,number>();for(const word of words(texts.join(' ')))counts.set(word,(counts.get(word)??0)+1);const ordered=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));return {counts,rank:new Map(ordered.map(([word],i)=>[word,i+1])),sentences:new Set(texts.flatMap(sentences).map(normalize))};}
export function classify(text:string,corpus:Corpus,level?:number):{grade:number;difficulty:number;score:number}{
 const tokens=words(text);const length=tokens.length||1;const average=tokens.reduce((sum,w)=>sum+w.length,0)/length;const sentenceLength=length/Math.max(1,sentences(text).length);const rare=tokens.filter(w=>(corpus.rank.get(w)??Infinity)>Math.max(20,corpus.rank.size*.6)).length/length;
 const grammarGrade=Math.max(6,...grammar.filter(r=>new RegExp(r.pattern,'i').test(text)).map(r=>r.grade));
 const score=average*.8+sentenceLength*.12+rare*4+(grammarGrade-6)*.8+(level?level*.35:0);
 let grade=score<5.3?6:score<6.5?7:score<7.7?8:9;
 if(level)grade=Math.max(5+level,Math.min(6+level,grade));grade=Math.max(grade,grammarGrade);
 return {grade,difficulty:score<5.8?1:score<7.3?2:3,score};
}
export function spreadGrades(items:{id:string;score:number;grade:number}[]):number[]{
 if(items.length<4)return items.map(x=>x.grade);const counts=new Map<number,number>();for(const item of items)counts.set(item.grade,(counts.get(item.grade)??0)+1);
 if(Math.max(...counts.values())/items.length<=.6&&counts.size===4)return items.map(x=>x.grade);
 const sorted=items.map((x,i)=>({...x,i})).sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id));const out:number[]=[];sorted.forEach((item,index)=>out[item.i]=6+Math.min(3,Math.floor(index*4/items.length)));return out;
}
const names:Record<string,string>={'chung':'Tổng hợp','gioi-tu':'Giới từ','mao-tu':'Mạo từ','su-hoa-hop-chu-vi':'Sự hòa hợp chủ vị','dang-tu':'Dạng từ','sap-xep-tu':'Sắp xếp từ','viet-lai-cau':'Viết lại câu','phat-am-trong-am':'Phát âm và trọng âm',...Object.fromEntries(grammar.map(r=>[r.slug,r.name])),...Object.fromEntries(Object.entries(topics).map(([slug,t])=>[slug,t.name]))};
export const topicName=(slug:string)=>names[slug]??names.chung;
export function topicFor(text:string,skill:Skill):{slug:string;name:string}{
 if(skill==='viet-cau')return {slug:'sap-xep-tu',name:names['sap-xep-tu']};
 if(skill==='ngu-phap'){const rule=grammar.find(r=>new RegExp(r.pattern,'i').test(text));return {slug:rule?.slug??'chung',name:rule?.name??names.chung};}
 const tokens=new Set(words(text));const scores=Object.entries(topics).map(([slug,t])=>({slug,name:t.name,score:t.words.filter(w=>tokens.has(w)).length})).sort((a,b)=>b.score-a.score||a.slug.localeCompare(b.slug));
 return scores[0]?.score?{slug:scores[0].slug,name:scores[0].name}:{slug:'chung',name:names.chung};
}

export function examTopic(stem:string,choices:string[]):{skill:Skill;slug:string}{
 const options=choices.map(s=>s.trim().toLowerCase());
 const classes:{words:string[];slug:string}[]=[
 {words:closed.prepositions,slug:'gioi-tu'}, {words:closed.articles,slug:'mao-tu'},
 {words:closed.modals,slug:'dong-tu-khuyet-thieu'}, {words:closed.pronouns,slug:'dang-tu'},
 {words:['is','are','am','was','were','be','been','being','has','have','had'],slug:'su-hoa-hop-chu-vi'},
 {words:closed.auxiliaries,slug:'thi-hien-tai-don'}, {words:closed.conjunctions,slug:'chung'}, {words:closed['wh-words'],slug:'chung'}
 ];
 const group=classes.find(group=>options.every(option=>group.words.includes(option)));
 if(group)return {skill:'ngu-phap',slug:group.slug};
 const topic=topicFor(stem,'ngu-phap');return topic.slug==='chung'?{skill:'tu-vung',slug:topicFor(stem,'tu-vung').slug}:{skill:'ngu-phap',slug:topic.slug};
}
