import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
export const issueToken = () => randomBytes(16).toString('base64url');
export const issuePlayerId = () => 'p_'+randomBytes(8).toString('hex');
export const hashToken = (token: string) => createHash('sha256').update(token).digest();
export function tokenMatches(hash: Buffer, token: string): boolean { const candidate=hashToken(token); return hash.length===candidate.length && timingSafeEqual(hash,candidate); }
