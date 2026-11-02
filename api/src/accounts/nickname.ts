import blocklist from "./nickname-blocklist.json";

// Same rules as the practice rooms (rooms/src/names.ts); copied because api must not import rooms.
const plain = (name: string): string =>
  name.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
const leet = (s: string): string =>
  s.replace(/0/g, "o").replace(/3/g, "e").replace(/[@4]/g, "a").replace(/5/g, "s");
const compact = (name: string): string => leet(plain(name)).replace(/[\s._-]/g, "");
const spaced = (name: string): string =>
  leet(plain(name)).replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();

const entries = blocklist.map((word) => ({ compact: compact(word), spaced: spaced(word) }));

// Entries of 4+ compact chars match as substrings; shorter ones only as a whole word so names like "Long" stay allowed.
const blockedBy = (form: string, words: string): boolean =>
  entries.some((e) =>
    e.compact.length >= 4
      ? form.includes(e.compact)
      : form === e.compact || ` ${words} `.includes(` ${e.spaced} `),
  );

/** Shared with usernames: platform names, blocklist words and their leet/spacing variants. */
export function isBlockedName(name: string): boolean {
  const form = compact(name);
  if (/http|www|zalo|facebook|fb|tiktok|telegram|whatsapp|instagram|snapchat|discord/.test(form))
    return true;
  const words = spaced(name);
  for (const digit of ["i", "l"]) {
    if (blockedBy(form.replace(/1/g, digit), words.replace(/1/g, digit))) return true;
  }
  return false;
}

/** Returns the cleaned nickname, or undefined when it is too short/long, has odd characters or is blocked. */
export function cleanNickname(input: string): string | undefined {
  const name = input.normalize("NFKC").trim().replace(/ +/g, " ");
  const length = Array.from(name).length;
  if (length < 2 || length > 20) return undefined;
  if (!/^[\p{L}\p{M}\p{N} ._-]+$/u.test(name) || !/\p{L}/u.test(name) || /\d{6}/.test(name))
    return undefined;
  return isBlockedName(name) ? undefined : name;
}
