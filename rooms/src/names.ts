import blocklist from './blocklist.json';
import { fail } from './errors';
const plain=(name:string)=>name.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
export const nameIdentity=(name:string)=>plain(name.normalize('NFKC')).trim().replace(/\s+/g,' ');
const compact=(name:string)=>plain(name).replace(/[\s._-]/g,'').replace(/0/g,'o').replace(/3/g,'e').replace(/[@4]/g,'a').replace(/5/g,'s');
const blocked=blocklist.map(compact);
export function validateName(input:string):string {
 const name=input.normalize('NFKC').trim().replace(/ +/g,' ');
 const form=compact(name);
 const variants=[form.replace(/1/g,'i'),form.replace(/1/g,'l')];
 if([...name].length<2 || [...name].length>20 || !/^[\p{L}\p{M}\p{N} ._-]+$/u.test(name) || !/\p{L}/u.test(name) || /\d{6}/.test(name) || /http|www|zalo|facebook|fb|tiktok|telegram|whatsapp|instagram|snapchat|discord/.test(form) || variants.some(v=>blocked.some(b=>v.includes(b)))) {
  fail('name_rejected',422,'Tên này không dùng được, hãy chọn tên khác');
 }
 return name;
}
