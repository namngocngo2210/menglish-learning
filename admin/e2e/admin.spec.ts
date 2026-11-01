import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { mockApi } from "./fixtures";

const shot = async (page: Page, width: number, n: string, name: string): Promise<void> => {
  mkdirSync(`e2e/screenshots/${String(width)}`, { recursive: true });
  await page.screenshot({
    path: `e2e/screenshots/${String(width)}/${n}-${name}.png`,
    fullPage: true,
  });
};
const a11y = async (page: Page): Promise<void> => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.html ?? ""}`),
  ).toEqual([]);
};

async function login(page: Page, totp: boolean): Promise<void> {
  await page.goto("/admin/");
  await page.getByLabel("Email").fill("owner@beejunior.vn");
  await page.getByLabel("Mật khẩu").fill("correct horse battery");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (totp) {
    await page.getByLabel("Mã 2FA hoặc mã khôi phục").fill("123456");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
  }
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
}

test("login screen is accessible and enforces CSP", async ({ page }, info) => {
  const w = page.viewportSize()?.width ?? 0;
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/content security policy|refused to/i.test(m.text())) problems.push(m.text());
  });
  await mockApi(page);
  const res = await page.goto("/admin/");
  expect(res?.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(await page.locator("script:not([src])").count()).toBe(0);
  await expect(page.getByRole("heading", { name: "BeeJunior Admin" })).toBeVisible();
  await a11y(page);
  await shot(page, w, "01", "login");
  expect(problems, info.project.name).toEqual([]);
});

test("no open redirect via next/redirect parameters", async ({ page }) => {
  await mockApi(page);
  await page.goto("/admin/?next=https://evil.example/#/login?next=https://evil.example");
  await login(page, false);
  expect(new URL(page.url()).origin).toBe(new URL(page.url()).origin);
  expect(page.url()).not.toContain("evil.example/");
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});

test("login with 2FA, then quarantine → published through the UI, all screens", async ({
  page,
}) => {
  const w = page.viewportSize()?.width ?? 0;
  const { calls } = await mockApi(page, { totp: true });
  await login(page, true);
  await a11y(page);
  await shot(page, w, "02", "dashboard");
  const open = async (hash: string, heading: string | RegExp): Promise<void> => {
    await page.evaluate((h) => {
      window.location.hash = h;
    }, hash);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  };

  await open("/review", "Hàng đợi duyệt");
  await expect(page.getByText("She ___ to school.")).toBeVisible();
  expect(await page.locator("main img").count()).toBe(0); // hostile stem is text
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
  ).toBeUndefined();
  await a11y(page);
  await shot(page, w, "03", "review");

  await page.getByRole("link", { name: "Mở #1" }).click();
  await expect(page.getByRole("heading", { name: /Câu hỏi #1/ })).toBeVisible();
  await page.getByLabel("Giải thích", { exact: true }).fill("Ngôi thứ ba số ít (đã sửa).");
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu.")).toBeVisible();
  await a11y(page);
  await shot(page, w, "04", "editor");
  for (const to of ["Nháp", "Chờ duyệt", "Đã đăng"]) {
    await page.getByRole("button", { name: `→ ${to}` }).click();
    await expect(page.getByText(`Đã chuyển sang "${to}".`)).toBeVisible();
  }
  expect(calls.filter((c) => c.endsWith("/transition"))).toHaveLength(3);
  await shot(page, w, "05", "published");

  for (const [i, [hash, heading, name]] of (
    [
      ["/sources", "Nguồn nội dung", "sources"],
      ["/crawl", "Crawl", "crawl"],
      ["/tests", "Đề thi", "tests"],
      ["/presets", "Preset trộn đề", "presets"],
      ["/reports", "Báo cáo câu sai", "reports"],
      ["/audit", "Nhật ký thao tác", "audit"],
      ["/settings", /Bảo mật/, "settings"],
    ] as const
  ).entries()) {
    await open(hash, heading);
    await page.waitForLoadState("networkidle");
    await a11y(page);
    await shot(page, w, String(i + 6).padStart(2, "0"), name);
  }
  await open("/reports", "Báo cáo câu sai");
  await expect(page.locator("main script")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
  ).toBeUndefined();
  await open("/crawl", "Crawl");
  await page.getByRole("button", { name: "Lỗi", exact: true }).click();
  await expect(page.getByText("#1").first()).toBeVisible();
});
