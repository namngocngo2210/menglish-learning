import { describe, it, expect } from 'vitest';
import { generateCode, normalizeCode, CODE_ALPHABET } from '../src/codes';
import { permutation, toOriginal, toDisplay } from '../src/perm';
import { validateName, nameIdentity } from '../src/names';
import { issueToken, hashToken, tokenMatches } from '../src/tokens';
import { rankPlayers } from '../src/ranking';
import { applyOptionOrder } from '../../web/lib/mixer';

describe('codes', () => {
 it('generates unambiguous codes and normalizes input', () => {
  for(let i=0;i<200;i++) expect(generateCode(() => false)).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  expect(normalizeCode(' ab-cd 23 ')).toBe('ABCD23');
  expect(normalizeCode('ABC0XY')).toBeNull();
 });
 it('retries live and tombstone collisions', () => {
  let n=0; expect(generateCode(code => code === '222222', () => n++ < 6 ? 0 : 1)).toBe('333333');
 });
});
describe('permutation and tokens', () => {
 it('is deterministic, diverse and round trips with the existing mixer', () => {
  const orders=new Set<string>();
  const q={options: (['A','B','C','D'] as const).map(key=>({key,text:key})),correctKey:'C' as const};
  for(let i=0;i<500;i++) {
   const p=permutation('secret',`p${i}`,'q1'); orders.add(p);
   expect([...p].sort().join('')).toBe('ABCD'); expect(permutation('secret',`p${i}`,'q1')).toBe(p);
   const view=applyOptionOrder(q,p);
   expect(toOriginal(p,view.correctKey)).toBe('C');
   for(const k of ['A','B','C','D'] as const) expect(toOriginal(p,toDisplay(p,k))).toBe(k);
  }
  expect(orders.size).toBeGreaterThan(15);
 });
 it('stores only hashes and rejects wrong tokens', () => {
  const t=issueToken(); expect(Buffer.from(t,'base64url')).toHaveLength(16);
  expect(tokenMatches(hashToken(t),t)).toBe(true); expect(tokenMatches(hashToken(t),'wrong')).toBe(false);
 });
});
describe('names', () => {
 it.each(['Nguyễn An','Bảo Ngọc','Minh_2','Ａｎ','An - Bee'])('accepts %s',name=>expect(validateName(name)).toBeTruthy());
 it.each(['A','a'.repeat(21),'1234','An123456','http abc','www abc','zalo An','FB An','tiktok An','a@b','An😀','An\u202e','f.u.c.k','sh1t','địt','d1t','bu11y'])('rejects %s',name=>expect(()=>validateName(name)).toThrow('Tên này không dùng được, hãy chọn tên khác'));
 it('normalizes spaces and duplicate identity',()=>{expect(validateName('  Bảo   An  ')).toBe('Bảo An');expect(nameIdentity('Đặng An')).toBe(nameIdentity('dang an'));});
});
it('ranks ties by join order, ignoring submission time',()=>{
 const rows=rankPlayers([{playerId:'b',correct:3,joinedOrder:2,submittedAt:1},{playerId:'c',correct:1,joinedOrder:3,submittedAt:0},{playerId:'a',correct:3,joinedOrder:1,submittedAt:9}]);
 expect(rows.map(p=>[p.playerId,p.rank])).toEqual([['a',1],['b',1],['c',3]]);
});
