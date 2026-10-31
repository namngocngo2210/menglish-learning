import { createHmac } from 'node:crypto';
import { createRng, shuffle } from '../../web/lib/mixer/random';
export type Key = 'A'|'B'|'C'|'D';
export function permutation(permKey: string, playerId: string, questionId: string): string {
 const seed=createHmac('sha256',permKey).update(`${playerId}|${questionId}`).digest('hex');
 return shuffle(['A','B','C','D'],createRng(seed)).join('');
}
export const toOriginal=(perm: string,display: Key): Key => perm['ABCD'.indexOf(display)] as Key;
export const toDisplay=(perm: string,original: Key): Key => 'ABCD'[perm.indexOf(original)] as Key;
