import { DUMMY_HASH, hashSecret, verifySecret } from "../admin/crypto";
import { HttpProblem } from "../server/problems";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

// shortcut: a short local list instead of a full breached-password corpus; extend it (or load a file) when abuse shows up.
const COMMON = new Set([
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "1234567890",
  "12345678901",
  "123456789a",
  "0123456789",
  "0000000000",
  "1111111111",
  "qwertyuiop",
  "qwerty1234",
  "qwerty12345",
  "1q2w3e4r5t",
  "iloveyou12",
  "letmein123",
  "welcome123",
  "admin12345",
  "abc1234567",
  "matkhau123",
  "matkhau1234",
  "beejunior1",
  "beejunior12",
  "beejunior123",
]);

/** Returns a machine-readable reason when the password is unacceptable (NIST/ASVS 2.1: length, no composition rules). */
export function passwordProblem(password: string, email: string): string | undefined {
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN) return "password_too_short";
  if (length > PASSWORD_MAX) return "password_too_long";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/u.test(password)) return "password_too_common";
  if (lower === email.toLowerCase() || lower === email.split("@")[0])
    return "password_matches_email";
  return undefined;
}

/**
 * Caps concurrent argon2id work (19 MiB each, docs/user-accounts.md 6.4): extra callers wait in a
 * short queue, and a full queue answers 429 instead of growing memory.
 */
export function createHashGate(concurrency = 2, maxQueue = 8) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(job: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      if (waiting.length >= maxQueue) throw new HttpProblem("rate_limited", "Busy", undefined, 1);
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else active += 1;
    try {
      return await job();
    } finally {
      const next = waiting.shift();
      if (next)
        next(); // hand the slot over without releasing it
      else active -= 1;
    }
  };
}

const gate = createHashGate();
const normal = (password: string): string => password.normalize("NFKC");

export const hashPassword = (password: string): Promise<string> =>
  gate(() => hashSecret(normal(password)));

/** A missing hash is checked against a dummy so unknown and wrong-password logins cost the same. */
export const checkPasswordHash = (
  stored: string | null | undefined,
  password: string,
): Promise<boolean> =>
  gate(async () => {
    const ok = await verifySecret(stored ?? DUMMY_HASH, normal(password));
    return ok && stored !== null && stored !== undefined;
  });
