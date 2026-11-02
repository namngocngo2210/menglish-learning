import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountApiError, createAccountClient } from "@/lib/account/client";
import { accountErrorMessage } from "@/lib/account/messages";
import { LoginForm, RegisterForm, ResetPassword } from "@/components/account/AuthForms";
import { RecoveryCodes } from "@/components/account/RecoveryCodes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
beforeEach(() => vi.stubEnv("ACCOUNTS_ENABLED", "true"));
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

describe("username accounts", () => {
 it("register omits an empty email and keeps the CSRF token; recovery reset sends none", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return url.endsWith("/register") ? reply(201, { csrfToken: "c1", recoveryCodes: ["AAAA-BBBB"], emailPending: false }) : reply(200, {}); }) as unknown as typeof fetch;
  const client = createAccountClient({ fetchImpl });
  const r = await client.register({ username: "be.an", password: "x".repeat(10), adult: true, consent: { policyVersion: "v", textHash: "h" } });
  expect(r.recoveryCodes).toEqual(["AAAA-BBBB"]);
  expect(JSON.parse(calls[0]!.init.body as string)).not.toHaveProperty("email");
  await client.resetWithRecovery("be.an", "AAAA-BBBB", "y".repeat(10));
  expect(calls[1]!.url).toBe("/api/v1/account/password-reset/recovery");
  expect((calls[1]!.init.headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  await client.setEmail("a@b.vn");
  expect((calls[2]!.init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("c1");
 });
 it("maps the new error codes; login 401 does not reveal which field was wrong", () => {
  const err = (status: number, detail?: string) => new AccountApiError(status, "x", detail);
  expect(accountErrorMessage(err(409, "username_taken"))).toContain("đã có người dùng");
  expect(accountErrorMessage(err(422, "invalid_recovery"))).toContain("mã khôi phục");
  expect(accountErrorMessage(err(401))).toBe("Tên đăng nhập hoặc mật khẩu không đúng.");
  expect(accountErrorMessage(new AccountApiError(429, "rate_limited", undefined, 60))).toContain("60 giây");
 });
 it("register form: username first, email optional with a recovery nudge", () => {
  const out = html(createElement(RegisterForm));
  expect(out).toContain("Tên đăng nhập");
  expect(out).toContain("không bắt buộc");
  expect(out).toContain("Nên thêm email để khôi phục mật khẩu");
  expect(out).toContain("Đừng dùng tên thật của bé");
  expect((out.match(/type="checkbox"/g) ?? []).length).toBe(2);
 });
 it("login asks for a username, not an email, and links to password recovery", () => {
  const out = html(createElement(LoginForm));
  expect(out).toContain("Tên đăng nhập");
  expect(out).not.toContain('type="email"');
  expect(out).toContain("Quên mật khẩu?");
 });
 it("forgot-password shell renders (modes appear after the token is read on mount)", () => {
  expect(html(createElement(ResetPassword))).toContain("Đang tải");
 });
 it("recovery codes screen: warning, download/print/copy, continue locked until acknowledged", () => {
  const out = html(createElement(RecoveryCodes, { codes: ["AAAA-BBBB", "CCCC-DDDD"], doneLabel: "Tiếp tục", onDone: () => {} }));
  expect(out).toContain("AAAA-BBBB");
  expect(out).toContain("KHÔNG thể khôi phục");
  expect(out).toContain("câu hỏi bảo mật");
  expect(out).toContain("Tải .txt");
  expect(out).toMatch(/<button[^>]*disabled[^>]*>Tiếp tục/);
 });
});
