import blocklist from './blocklist.json';
import { fail } from './errors';
const plain=(name:string)=>name.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
export const nameIdentity=(name:string)=>plain(name.normalize('NFKC')).trim().replace(/\s+/g,' ');
const leet=(s:string)=>s.replace(/0/g,'o').replace(/3/g,'e').replace(/[@4]/g,'a').replace(/5/g,'s');
const squash=(s:string)=>s.replace(/[\s._-]/g,'');
const compact=(name:string)=>squash(leet(plain(name)));
/** Words separated by spaces/._- after leet folding, e.g. "L.o.n" stays caught by the compact whole-name check. */
const spaced=(name:string)=>leet(plain(name)).replace(/[._-]/g,' ').replace(/\s+/g,' ').trim();
// Entries whose compact form is >= 4 chars match as a substring of the compact name (catches "xxfuckxx");
// shorter entries only match as a whole word / whole name so common Vietnamese names such as "Long" stay allowed.
const entries=blocklist.map(w=>({compact:compact(w),spaced:spaced(w)}));
function blockedBy(form:string,words:string):boolean {
 return entries.some(e=>e.compact.length>=4?form.includes(e.compact):(form===e.compact||` ${words} `.includes(` ${e.spaced} `)));
}
export function validateName(input:string):string {
 const name=input.normalize('NFKC').trim().replace(/ +/g,' ');
 const form=compact(name);
 const forms=[form.replace(/1/g,'i'),form.replace(/1/g,'l')];
 const words=[spaced(name).replace(/1/g,'i'),spaced(name).replace(/1/g,'l')];
 if([...name].length<2 || [...name].length>20 || !/^[\p{L}\p{M}\p{N} ._-]+$/u.test(name) || !/\p{L}/u.test(name) || /\d{6}/.test(name) || /http|www|zalo|facebook|fb|tiktok|telegram|whatsapp|instagram|snapchat|discord/.test(form) || forms.some((f,i)=>blockedBy(f,words[i]))) {
  fail('name_rejected',422,'Tên này không dùng được, hãy chọn tên khác');
 }
 return name;
}
