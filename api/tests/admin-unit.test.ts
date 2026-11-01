import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decrypt,
  encrypt,
  hashSecret,
  newRecoveryCodes,
  RECOVERY_CODE,
  safeEqual,
  totpCode,
  totpValid,
  verifySecret,
} from "../src/admin/crypto";
import { readHidden } from "../src/admin/create";
import type { TtyIn } from "../src/admin/create";
import { main } from "../src/cli";
import { loadServerConfig } from "../src/server/config";

// RFC 6238 appendix B secret "12345678901234567890" (SHA-1), truncated to 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("password hashing", () => {
  it("uses argon2id and verifies only the right password", async () => {
    const stored = await hashSecret("correct horse battery");
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifySecret(stored, "correct horse battery")).toBe(true);
    expect(await verifySecret(stored, "wrong")).toBe(false);
    expect(await verifySecret("not-a-hash", "x")).toBe(false);
  });
});

describe("totp", () => {
  it("matches RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpCode(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
  });
  it("accepts one step of drift, rejects two and malformed input", () => {
    const t = 1_234_567_890_000;
    expect(totpValid(RFC_SECRET, totpCode(RFC_SECRET, t, -1), t)).toBe(true);
    expect(totpValid(RFC_SECRET, totpCode(RFC_SECRET, t, 2), t)).toBe(false);
    expect(totpValid(RFC_SECRET, "12345", t)).toBe(false);
    expect(totpValid(RFC_SECRET, "abcdef", t)).toBe(false);
  });
  it("round-trips base32", () => {
    const bytes = Buffer.from("hello totp");
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });
});

describe("secret encryption and recovery codes", () => {
  const key = Buffer.alloc(32, 7);
  it("encrypts with AES-GCM and detects tampering or a wrong key", () => {
    const sealed = encrypt(key, "SECRET");
    expect(sealed).not.toContain("SECRET");
    expect(decrypt(key, sealed)).toBe("SECRET");
    expect(() => decrypt(Buffer.alloc(32, 8), sealed)).toThrow();
    const raw = Buffer.from(sealed, "base64url");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 1;
    expect(() => decrypt(key, raw.toString("base64url"))).toThrow();
  });
  it("makes 8 distinct well-formed recovery codes", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(RECOVERY_CODE);
  });
  it("compares in constant-time style without false positives", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

function fakeTty(
  isTTY: boolean,
  typed: string,
): { input: TtyIn; echoed: string[]; raw: boolean[] } {
  const echoed: string[] = [];
  const raw: boolean[] = [];
  let listener: ((chunk: string) => void) | undefined;
  const input: TtyIn = {
    isTTY,
    setRawMode: (on: boolean) => raw.push(on),
    resume: () => {
      // Deliver the keystrokes once the reader is listening.
      queueMicrotask(() => listener?.(typed));
    },
    pause: () => undefined,
    setEncoding: () => undefined,
    on: (_event, fn) => {
      listener = fn;
    },
    off: () => {
      listener = undefined;
    },
  };
  return { input, echoed, raw };
}

describe("readHidden", () => {
  it("refuses a non-TTY stdin", async () => {
    const tty = fakeTty(false, "secret\n");
    await expect(readHidden("P: ", tty.input, { write: () => undefined })).rejects.toThrow(/TTY/);
  });
  it("reads with raw mode on, handles backspace and never echoes the typed text", async () => {
    const tty = fakeTty(true, "secreX\u007ft-pass\r");
    const out: string[] = [];
    await expect(readHidden("Password: ", tty.input, { write: (t) => out.push(t) })).resolves.toBe(
      "secret-pass",
    );
    expect(tty.raw).toEqual([true, false]);
    expect(out.join("")).toBe("Password: \n");
  });
});

describe("admin:create CLI", () => {
  it("exits 1 without a TTY and takes no password argument", async () => {
    const errs: string[] = [];
    const tty = fakeTty(false, "");
    const code = await main(
      ["admin:create", "owner@example.com"],
      { out: () => undefined, err: (l) => errs.push(l) },
      { DATABASE_URL: "postgres://u@127.0.0.1:1/none" },
      { input: tty.input, output: { write: () => undefined } },
    );
    expect(code).toBe(1);
    expect(errs.join("")).toMatch(/TTY/);
    const strict = await main(
      ["admin:create", "owner@example.com", "--password", "x"],
      { out: () => undefined, err: (l) => errs.push(l) },
      { DATABASE_URL: "postgres://u@127.0.0.1:1/none" },
    );
    expect(strict).toBe(1);
  });
});

describe("admin config", () => {
  const base = { DATABASE_URL: "postgres://u@h/db" };
  it("enables auth only with all three settings and validates the TOTP key", () => {
    expect(loadServerConfig(base).adminAuth).toBeUndefined();
    const key = Buffer.alloc(32, 1).toString("base64");
    const full = {
      ...base,
      SESSION_HMAC_KEY: "k".repeat(40),
      TOTP_ENC_KEY: key,
      ADMIN_ORIGIN: "https://beejunior.meducation.vn/",
    };
    expect(loadServerConfig(full).adminAuth?.origin).toBe("https://beejunior.meducation.vn");
    expect(() => loadServerConfig({ ...full, TOTP_ENC_KEY: "a".repeat(40) })).toThrow(
      /TOTP_ENC_KEY/,
    );
  });
});
