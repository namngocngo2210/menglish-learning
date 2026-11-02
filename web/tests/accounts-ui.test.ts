import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import config from "@/next.config";
import sitemap from "@/app/sitemap";
import { POLICY_VERSION, CONSENT_TEXTS } from "../../api/src/accounts/consent-texts";
import { AccountApiError, createAccountClient } from "@/lib/account/client";
import { ACCOUNT_CONSENT_TEXT, CHILD_CONSENT_TEXT } from "@/lib/account/consent-copy";
import { accountsEnabled } from "@/lib/account/flag";
import { DRAFT_NOTICE, LEGAL } from "@/lib/account/legal";
import { accountErrorMessage } from "@/lib/account/messages";
import { ACCOUNT_PRIVATE_PATHS } from "@/lib/account/paths";
import { AccountPage, privateMetadata } from "@/components/account/AccountPage";
import { RegisterForm } from "@/components/account/AuthForms";
import { DeleteDataGuide } from "@/components/account/DeleteDataGuide";
import { PrivacyPolicyDraft, TermsDraft } from "@/components/account/Legal";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/chrome/SiteHeader";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
afterEach(() => { vi.unstubAllEnvs(); notFound.mockClear(); });
beforeEach(() => vi.stubEnv("ACCOUNTS_ENABLED", undefined));
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("flag and consent copy", () => {
 it("flag is OFF by default and accepts only true/1", () => {
  expect(accountsEnabled({})).toBe(false);
  for (const v of ["", "false", "0", "yes", "off"]) expect(accountsEnabled({ ACCOUNTS_ENABLED: v })).toBe(false);
  for (const v of ["true", "1", "TRUE", " true "]) expect(accountsEnabled({ ACCOUNTS_ENABLED: v })).toBe(true);
 });
 it("UI consent wording equals the text and version the API hashes", () => {
  expect(ACCOUNT_CONSENT_TEXT).toBe(CONSENT_TEXTS.account.text);
  expect(CHILD_CONSENT_TEXT).toBe(CONSENT_TEXTS.child_progress.text);
  expect(LEGAL.version).toBe(POLICY_VERSION);
 });
});

describe("account client", () => {
 const reply = (status: number, body?: unknown, headers: Record<string, string> = {}) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
 it("sends the CSRF token from /me on unsafe calls and refuses cross-origin base URLs", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return url.endsWith("/me") ? reply(200, { csrfToken: "tok" }) : reply(204); }) as unknown as typeof fetch;
  const client = createAccountClient({ fetchImpl });
  await client.deleteProfile("11111111-1111-4111-8111-111111111111");
  expect(calls.map(c => c.url)).toEqual(["/api/v1/account/me", "/api/v1/account/profiles/11111111-1111-4111-8111-111111111111"]);
  expect((calls[1]!.init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("tok");
  expect(calls[1]!.init.credentials).toBe("same-origin");
  expect(() => createAccountClient({ baseUrl: "//evil.example" })).toThrow();
  expect(() => createAccountClient({ baseUrl: "https://evil.example" })).toThrow();
 });
 it("login keeps the returned CSRF token and never sends it on public calls", async () => {
  const calls: RequestInit[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => { calls.push(init); return url.endsWith("/login") ? reply(200, { csrfToken: "abc" }) : reply(204); }) as unknown as typeof fetch;
  const client = createAccountClient({ fetchImpl });
  await client.login("a@b.vn", "pw");
  expect((calls[0]!.headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  await client.logout();
  expect((calls[1]!.headers as Record<string, string>)["X-CSRF-Token"]).toBe("abc");
 });
 it("maps problem bodies, Retry-After and network failures", async () => {
  const fail = (res: Response | Error) => createAccountClient({ fetchImpl: (async () => { if (res instanceof Error) throw res; return res; }) as unknown as typeof fetch });
  const e1 = await fail(reply(422, { code: "validation_failed", detail: "password_too_common" })).login("a", "b").catch((e: unknown) => e);
  expect(e1).toBeInstanceOf(AccountApiError);
  expect(accountErrorMessage(e1)).toContain("phổ biến");
  const e2 = await fail(reply(429, { code: "rate_limited" }, { "Retry-After": "900" })).login("a", "b").catch((e: unknown) => e);
  expect(accountErrorMessage(e2)).toContain("15 phút");
  const e3 = await fail(new TypeError("x")).login("a", "b").catch((e: unknown) => e);
  expect((e3 as AccountApiError).status).toBe(0);
  expect(accountErrorMessage(await fail(reply(401, { code: "unauthenticated" })).login("a", "b").catch((e: unknown) => e))).not.toMatch(/không tồn tại|sai mật khẩu/i);
 });
});

describe("pages and flag off", () => {
 it("account pages 404 when the flag is off and render when on", () => {
  expect(() => AccountPage({ title: "Đăng nhập", children: null })).toThrow("NEXT_NOT_FOUND");
  vi.stubEnv("ACCOUNTS_ENABLED", "true");
  expect(() => AccountPage({ title: "Đăng nhập", children: null })).not.toThrow();
 });
 it("every account page is noindex", () => {
  const m = privateMetadata("Đăng nhập", "/dang-nhap", "x");
  expect(m.robots).toEqual({ index: false, follow: false });
 });
 it("private paths get noindex, no-referrer, no-store headers only when enabled and are not in the sitemap", async () => {
  const sources = async () => (await config.headers!()).map(r => r.source);
  expect(await sources()).not.toContain("/dang-nhap");
  vi.stubEnv("ACCOUNTS_ENABLED", "true");
  const rules = await config.headers!();
  for (const path of ACCOUNT_PRIVATE_PATHS) {
   const rule = rules.find(r => r.source === path);
   expect(rule, path).toBeTruthy();
   const h = Object.fromEntries(rule!.headers.map(x => [x.key, x.value]));
   expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
   expect(h["Referrer-Policy"]).toBe("no-referrer");
   expect(h["Cache-Control"]).toBe("no-store");
  }
  const urls = (await sitemap()).map(e => e.url);
  for (const p of [...ACCOUNT_PRIVATE_PATHS, "/xoa-du-lieu"]) expect(urls.some(u => u.endsWith(p))).toBe(false);
 });
 it("header and footer show nothing account-related when off", () => {
  const off = html(createElement(SiteHeader)) + html(createElement(SiteFooter));
  expect(off).not.toMatch(/dang-nhap|Điều khoản|cookie chức năng/);
  vi.stubEnv("ACCOUNTS_ENABLED", "true");
  const on = html(createElement(SiteHeader)) + html(createElement(SiteFooter));
  expect(on).toContain('href="/dang-nhap"');
  expect(on).toContain('href="/dieu-khoan"');
  expect(on).toContain("cookie chức năng");
 });
});

describe("consent boxes and legal drafts", () => {
 it("register form: two separate unchecked boxes with the exact 7.4 wording", () => {
  const out = html(createElement(RegisterForm));
  expect((out.match(/type="checkbox"/g) ?? []).length).toBe(2);
  expect(out).not.toContain("checked");
  expect(out).toContain("Tôi là cha/mẹ hoặc người giám hộ, từ đủ 18 tuổi.");
  expect(out).toContain("Tôi đã đọc và đồng ý ");
  expect(out).toContain("Chính sách quyền riêng tư</a> và <a");
  expect(out).toContain("Điều khoản sử dụng</a> của BeeJunior.");
 });
 it("legal drafts are marked DRAFT and use owner placeholders, not invented contacts", () => {
  for (const el of [createElement(PrivacyPolicyDraft), createElement(TermsDraft), createElement(DeleteDataGuide)]) {
   const out = html(el);
   expect(out).toContain(DRAFT_NOTICE);
   expect(out).toContain("[EMAIL LIÊN HỆ]");
   expect(out).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  }
  expect(html(createElement(PrivacyPolicyDraft))).toContain("[TÊN PHÁP NHÂN]");
 });
});
