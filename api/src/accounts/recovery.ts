import { randomBytes } from "node:crypto";
import type pg from "pg";
import { sha256Hex } from "../admin/crypto";

export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars, no 0/O/1/I/L
const LIMIT = 248; // 8 * 31: bytes at or above this are dropped so there is no modulo bias

function newCode(): string {
  let out = "";
  while (out.length < 20) {
    for (const b of randomBytes(32)) {
      if (b < LIMIT && out.length < 20) out += ALPHABET[b % 31] ?? "";
    }
  }
  return out.match(/.{5}/g)?.join("-") ?? out;
}

/** Uppercase, no spaces or dashes: what is hashed and compared. */
export const normalizeCode = (input: string): string => input.toUpperCase().replace(/[\s-]/g, "");

export const hashCode = (input: string): string => sha256Hex(normalizeCode(input));

/** Replaces every code of the user with fresh ones; only the sha256 is stored. Returns the plain codes once. */
export async function regenerateCodes(client: pg.PoolClient, userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newCode);
  await client.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
  for (const code of codes)
    await client.query("INSERT INTO recovery_codes (user_id, code_sha256) VALUES ($1,$2)", [
      userId,
      hashCode(code),
    ]);
  return codes;
}

/** Single use: true only for the one caller that flips used_at. */
export async function consumeCode(
  client: pg.PoolClient,
  userId: string,
  code: string,
  at: Date,
): Promise<boolean> {
  const { rowCount } = await client.query(
    "UPDATE recovery_codes SET used_at = $3 WHERE user_id = $1 AND code_sha256 = $2 AND used_at IS NULL",
    [userId, hashCode(code), at],
  );
  return rowCount === 1;
}
