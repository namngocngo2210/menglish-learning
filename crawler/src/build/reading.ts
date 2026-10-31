import type { Article, Candidate } from '../model.js';
import type { Corpus } from '../classify.js';
import { sentences, words, shuffle } from '../util.js';
import { candidate, passageFor } from './common.js';
import { vocabularyItems } from './vocabulary.js';
export function readingItems(article:Article,corpus:Corpus):Candidate[]{
 const passage=passageFor(article);if(!passage)return [];
 const out:Candidate[]=vocabularyItems({...article,paragraphs:passage.body.split('\n\n')},corpus).filter(i=>i.kind==='content-cloze').map(i=>({...i,skill:'doc-hieu' as const,kind:'reading-cloze',sourceRef:i.sourceRef.replace('content-cloze','reading-cloze'),passage}));
 const glossary=article.glossary.filter(g=>/^[a-z]+$/i.test(g.word)&&g.definition.length>8&&g.definition.length<250&&words(passage.body).includes(g.word.toLowerCase()));
 // Distractors are always other glossary words, including those outside the
 // excerpt. Definitions must be distinct; duplicate definitions are ambiguous.
 const unique=article.glossary.filter(g=>/^[a-z]+$/i.test(g.word)&&article.glossary.filter(other=>other.word.toLowerCase()===g.word.toLowerCase()).length===1&&article.glossary.filter(other=>other.definition.toLowerCase()===g.definition.toLowerCase()).length===1);
 if(unique.length>=4){for(const entry of glossary){if(!unique.includes(entry))continue;const distractors=shuffle(unique.filter(g=>g.word!==entry.word),article.id+'|'+out.length).slice(0,3).map(g=>g.word);
 const stem=`Which word in “Words in This Story” means “${entry.definition}”?`;
 out.push({...candidate(article,corpus,'doc-hieu','definition',entry.word+' — '+entry.definition,stem,entry.word,[entry.word,...distractors],out.length,`Mục “Words in This Story” định nghĩa từ này là “${entry.definition}”.`),passage});}}
 return out;
}
