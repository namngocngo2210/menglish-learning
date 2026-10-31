export type Rng = () => number;
/** xmur3 string hash followed by mulberry32; independent of platform and locale. */
export function createRng(seed: string): Rng {
 let hash = 1779033703 ^ seed.length;
 for (let i = 0; i < seed.length; i++) {
  hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353);
  hash = hash << 13 | hash >>> 19;
 }
 hash = Math.imul(hash ^ hash >>> 16, 2246822507);
 hash = Math.imul(hash ^ hash >>> 13, 3266489909);
 let state = (hash ^ hash >>> 16) >>> 0;
 return () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let value = Math.imul(state ^ state >>> 15, state | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
 };
}
export function shuffle<T>(array: readonly T[], rng: Rng): T[] {
 const result = [...array];
 for (let i = result.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [result[i], result[j]] = [result[j], result[i]];
 }
 return result;
}
