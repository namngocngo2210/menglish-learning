import type { Key } from '../model.js';
export interface ExamItem { number:number; stem:string; choices:string[]; correctKey:Key; passage?:string; kind:'reading'|'pronunciation'|'transformation'|'mcq' }
export function parseAnswerKey(text:string):Map<number,Key>{
 const values=new Map<number,Set<Key>>();
 for(const match of text.matchAll(/(?:Câu\s*|Question\s*)?(\d{1,3})\s*[.:)\-]\s*([ABCD])\b(?=\s*(?:$|\r?\n|(?:Câu\s*|Question\s*)?\d{1,3}\s*[.:)\-]))/gi)){const n=Number(match[1]),key=match[2].toUpperCase() as Key;const keys=values.get(n)??new Set<Key>();keys.add(key);values.set(n,keys);}
 return new Map([...values].filter(([,v])=>v.size===1).map(([n,v])=>[n,[...v][0]]));
}
const instruction=/(?:Read the (?:following )?(?:passage|text)|Choose the (?:word|sentence)|Mark the letter|closest in meaning|different (?:stress|sound)|pronounc|trọng âm|phát âm|Viết lại)/i;
function sectionKind(text:string):ExamItem['kind']{
 if(/read the (?:following )?(?:passage|text)|đọc.*đoạn/i.test(text))return 'reading';
 if(/stress|pronounc|underlined.*(?:differ|sound)|trọng âm|phát âm/i.test(text))return 'pronunciation';
 if(/sentence.*(?:closest|same).*meaning|sentence transformation|Viết lại/i.test(text))return 'transformation';
 return 'mcq';
}
export function parseExam(text:string,keys:Map<number,Key>):ExamItem[]{
 const markers=[...text.matchAll(/(?:^|\n)\s*(?:Question\s+|Câu\s+)?(\d{1,3})\s*[.:)]\s*/g)];const out:ExamItem[]=[];let section:ExamItem['kind']='mcq',passage:string|undefined;
 for(let i=0;i<markers.length;i++){
 const marker=markers[i];const before=text.slice(i?markers[i-1].index!+markers[i-1][0].length:0,marker.index);
 const instructions=before.split('\n').filter(line=>instruction.test(line));
 if(instructions.length){const last=instructions.at(-1)!;section=sectionKind(last);if(section==='reading'){const offset=before.lastIndexOf(last)+last.length;passage=before.slice(offset).trim()||undefined;}else passage=undefined;}
 const number=Number(marker[1]);const key=keys.get(number);if(!key)continue;
 let block=text.slice(marker.index!+marker[0].length,markers[i+1]?.index??text.length).trim();
 // Section instructions belong to the next item, never to option D.
 const lines=block.split('\n');const stop=lines.findIndex(line=>instruction.test(line));if(stop>=0)block=lines.slice(0,stop).join('\n');
 const options=[...block.matchAll(/(?:^|\s)([ABCD])\s*[.)]\s*/g)];if(options.length!==4||options.map(m=>m[1]).join('')!=='ABCD')continue;
 const stem=block.slice(0,options[0].index).trim();const choices=options.map((m,j)=>block.slice(m.index!+m[0].length,options[j+1]?.index??block.length).trim());
 if(!stem||choices.some(s=>!s)||new Set(choices.map(s=>s.toLowerCase())).size!==4)continue;
 if(section==='reading'&&!passage)continue;
 out.push({number,stem,choices,correctKey:key,kind:section,...(passage?{passage}:{})});
 }
 // Repeated numbering is ambiguous across paper variants.
 const counts=new Map<number,number>();for(const item of out)counts.set(item.number,(counts.get(item.number)??0)+1);
 return out.filter(item=>counts.get(item.number)===1);
}
export async function extractPdf(bytes:Uint8Array):Promise<string>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false}).promise;
 try {const pages:string[]=[];for(let page=1;page<=pdf.numPages;page++){const content=await(await pdf.getPage(page)).getTextContent();let text='';let lastY:number|undefined;for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}pages.push(text);}return pages.join('\n');} finally {await pdf.destroy();}
}
