import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/** OWASP minimum for argon2id: m=19 MiB, t=2, p=1. 2 = Algorithm.Argon2id (const enum). */
const ARGON = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashSecret = (plain: string): Promise<string> => hash(plain, ARGON);

export async function verifySecret(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}

/** Verified when the email is unknown, so unknown and wrong-password logins cost the same. */
export const DUMMY_HASH = await hashSecret(randomBytes(16).toString("hex"));

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const hmacHex = (key: string, value: string): string =>
  createHmac("sha256", key).update(value).digest("hex");

export const newToken = (): string => randomBytes(32).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

/** AES-256-GCM; output = base64url(iv | tag | ciphertext). `key` is 32 raw bytes. */
export function encrypt(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function decrypt(key: Buffer, sealed: string): string {
  const raw = Buffer.from(sealed, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32.charAt((acc >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += B32.charAt((acc << (5 - bits)) & 31);
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let acc = 0;
  const out: number[] = [];
  for (const char of text.toUpperCase()) {
    const index = B32.indexOf(char);
    if (index < 0) continue;
    acc = (acc << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP (HMAC-SHA1, 6 digits) for the 30 s step containing `atMs`. */
export function totpCode(secret: string, atMs: number, stepOffset = 0): string {
  const counter = Math.floor(atMs / 30_000) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = (mac[mac.length - 1] ?? 0) & 15;
  const value = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

/** Accepts the previous, current and next step (clock drift). */
export function totpValid(secret: string, code: string, atMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let ok = false;
  for (const step of [-1, 0, 1]) ok = safeEqual(totpCode(secret, atMs, step), code) || ok;
  return ok;
}

export const newTotpSecret = (): string => base32Encode(randomBytes(20));

/** Recovery codes look like `abcde-fghij` (random, 50 bits); only argon2id hashes are stored. */
export function newRecoveryCodes(count = 8): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const part = (): string =>
    Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return Array.from({ length: count }, () => `${part()}-${part()}`);
}

export const RECOVERY_CODE = /^[a-z0-9]{5}-[a-z0-9]{5}$/;
