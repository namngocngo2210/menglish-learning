import { describe, expect, it } from "vitest";
import { CONSENT_TEXTS, POLICY_VERSION, consentMatches } from "../src/accounts/consent-texts";
import { createMemoryMailer, createUnconfiguredMailer } from "../src/accounts/mailer";
import { cleanNickname } from "../src/accounts/nickname";
import { createHashGate, passwordProblem } from "../src/accounts/password";
import { loadServerConfig } from "../src/server/config";

describe("passwordProblem", () => {
  it("accepts long passphrases without composition rules and rejects weak ones with stable codes", () => {
    expect(passwordProblem("correct horse battery", "a@b.test")).toBeUndefined();
    expect(passwordProblem("short", "a@b.test")).toBe("password_too_short");
    expect(passwordProblem("x".repeat(129), "a@b.test")).toBe("password_too_long");
    expect(passwordProblem("Password123", "a@b.test")).toBe("password_too_common");
    expect(passwordProblem("aaaaaaaaaaaa", "a@b.test")).toBe("password_too_common");
    expect(passwordProblem("somebody.long", "somebody.long@b.test")).toBe("password_matches_email");
  });
});

describe("cleanNickname", () => {
  it("keeps ordinary Vietnamese names and rejects blocked words, contact data and bad length", () => {
    expect(cleanNickname("  Bông   Sen ")).toBe("Bông Sen");
    expect(cleanNickname("Long")).toBe("Long");
    expect(cleanNickname("f.u.c.k")).toBeUndefined();
    expect(cleanNickname("xxfuckxx")).toBeUndefined();
    expect(cleanNickname("a")).toBeUndefined();
    expect(cleanNickname("telegram bé")).toBeUndefined();
    expect(cleanNickname("<script>")).toBeUndefined();
  });
});

describe("consent texts", () => {
  it("matches only the current policy version and exact text hash", () => {
    const good = { policyVersion: POLICY_VERSION, textHash: CONSENT_TEXTS.account.textHash };
    expect(consentMatches("account", good)).toBe(true);
    expect(consentMatches("child_progress", good)).toBe(false);
    expect(consentMatches("account", { ...good, policyVersion: "other" })).toBe(false);
    expect(CONSENT_TEXTS.account.textHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hash gate", () => {
  it("runs at most `concurrency` jobs, queues the next ones and answers rate_limited when the queue is full", async () => {
    const gate = createHashGate(2, 2);
    let running = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const job = () =>
      gate(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => release.push(resolve));
        running -= 1;
        return "done";
      });
    const first = [job(), job(), job(), job()]; // 2 running + 2 queued
    await Promise.resolve();
    await expect(job()).rejects.toMatchObject({ code: "rate_limited" });
    while (first.length > 0 && release.length > 0) {
      release.shift()?.();
      await new Promise((resolve) => setImmediate(resolve));
    }
    while (release.length > 0) release.shift()?.();
    expect(await Promise.all(first)).toEqual(["done", "done", "done", "done"]);
    expect(peak).toBe(2);
    expect(await gate(() => Promise.resolve("again"))).toBe("again"); // slots were handed back
  });
});

describe("mailers", () => {
  it("keeps messages in memory for tests and fails loudly when no provider is configured", async () => {
    const mailer = createMemoryMailer();
    await mailer.send({ to: "a@b.test", subject: "s", text: "t" });
    expect(mailer.outbox).toHaveLength(1);
    await expect(
      createUnconfiguredMailer().send({ to: "a@b.test", subject: "s", text: "t" }),
    ).rejects.toThrow("not configured");
  });
});

describe("accounts config", () => {
  const base = { DATABASE_URL: "postgres://x/y" };
  it("is off by default and needs a dedicated key and origin when enabled", () => {
    expect(loadServerConfig(base).accounts).toBeUndefined();
    expect(() => loadServerConfig({ ...base, ACCOUNTS_ENABLED: "true" })).toThrow(
      /USER_SESSION_HMAC_KEY/,
    );
    const on = loadServerConfig({
      ...base,
      ACCOUNTS_ENABLED: "true",
      USER_SESSION_HMAC_KEY: "u".repeat(40),
      ACCOUNTS_ORIGIN: "https://beejunior.meducation.vn/",
    });
    expect(on.accounts).toEqual({
      hmacKey: "u".repeat(40),
      origin: "https://beejunior.meducation.vn",
    });
  });

  it("refuses to reuse the admin HMAC key for parents and ignores account keys while the flag is off", () => {
    const shared = "k".repeat(40);
    expect(() =>
      loadServerConfig({
        ...base,
        ACCOUNTS_ENABLED: "true",
        SESSION_HMAC_KEY: shared,
        USER_SESSION_HMAC_KEY: shared,
        ACCOUNTS_ORIGIN: "https://beejunior.meducation.vn",
      }),
    ).toThrow(/must differ/);
    expect(loadServerConfig({ ...base, USER_SESSION_HMAC_KEY: shared }).accounts).toBeUndefined();
  });
});
