import { createHash } from 'node:crypto';
export const hash=(value:string)=>createHash('sha1').update(value).digest('hex');
export const normalize=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const words=(text:string):string[]=>text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)??[];
export const sentences=(text:string)=>text.match(/[^.!?\n]+[.!?]+(?:\s|$)|[^.!?\n]+$/g)?.map(s=>s.trim()).filter(Boolean)??[];
export function shuffle<T>(items:readonly T[],seed:string):T[]{
 let state=parseInt(hash(seed).slice(0,8),16)||1; const out=[...items];
 for(let i=out.length-1;i>0;i--){state^=state<<13;state^=state>>>17;state^=state<<5; const j=(state>>>0)%(i+1);[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
export const stableJson=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
