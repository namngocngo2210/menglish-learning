import { randomInt } from 'node:crypto';
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function normalizeCode(input: string): string | null {
 const code=input.trim().replace(/[\s-]/g,'').toUpperCase();
 return code.length===6 && [...code].every(c=>CODE_ALPHABET.includes(c)) ? code : null;
}
export function generateCode(occupied: (code: string)=>boolean, draw: (max: number)=>number = randomInt): string {
 for(let attempt=0;attempt<1000;attempt++) {
  const code=Array.from({length:6},()=>CODE_ALPHABET[draw(CODE_ALPHABET.length)]).join('');
  if(!occupied(code)) return code;
 }
 throw new Error('Code space unavailable');
}
