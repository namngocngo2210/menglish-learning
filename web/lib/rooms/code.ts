/** Mirrors rooms/src/codes.ts (service-side source of truth). */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;
/** Strips spaces/dashes, upper-cases, and returns null unless it is a valid 6-char room code. */
export function normalizeRoomCode(input: string): string | null {
 const code = input.trim().replace(/[\s-]/g, "").toUpperCase();
 return code.length === CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c)) ? code : null;
}
export const isValidRoomCode = (input: string): boolean => normalizeRoomCode(input) !== null;
