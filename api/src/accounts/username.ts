import { randomBytes } from "node:crypto";
import { isBlockedName } from "./nickname";

const RESERVED = [
  "admin",
  "administrator",
  "root",
  "support",
  "beejunior",
  "bee",
  "meducation",
  "menglish",
  "system",
  "moderator",
  "mod",
  "staff",
  "owner",
  "official",
  "help",
  "null",
  "undefined",
  "api",
  "www",
  "mail",
  "postmaster",
  "webmaster",
  "security",
  "test",
];

/** Returns the lowercase username, or undefined when it is malformed, email-like, reserved or blocked. */
export function cleanUsername(input: string): string | undefined {
  const name = input.normalize("NFKC").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,19}$/.test(name)) return undefined;
  if (/^\d+$/.test(name) || /\d{6}/.test(name)) return undefined; // phone-number-like
  if (/\.(com|vn|net|org|edu|info)$/.test(name)) return undefined; // looks like an address
  if (RESERVED.includes(name.replace(/[._-]/g, ""))) return undefined;
  return isBlockedName(name) ? undefined : name;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
/** Unique-looking name for Google sign-ups ("bj" + 8 chars); the caller retries on a unique violation. */
export function generateUsername(): string {
  const bytes = randomBytes(8);
  return "bj" + Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}
