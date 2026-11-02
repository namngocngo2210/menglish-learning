import { expect, test } from "@playwright/test";
import { auditScreen, noHorizontalScroll, ROOMS, ROOMS_OFF, ROOMS_ON } from "./rooms-helpers";

const roomPages = [`${ROOMS}/room/K7M2QX`, `${ROOMS}/join`];
const adSelectors = ["text=Vị trí quảng cáo", "ins.adsbygoogle", "aside[aria-label='Quảng cáo']"];

test.describe("rooms flag ON: noindex, sitemap, no ads", () => {
  test.skip(!ROOMS_ON, "set ROOMS_E2E=on");

  for (const path of roomPages) {
    test(`${path}: noindex meta + headers, no AdSlot`, async ({ page, request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      expect(res.headers()["cache-control"]).toBe("no-store");
      expect(res.headers()["referrer-policy"]).toBe("no-referrer");
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      for (const sel of adSelectors) await expect(page.locator(sel)).toHaveCount(0);
    });
  }

  test("sitemap lists the landing page but no room pages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/group-practice</loc>");
    expect(xml).not.toMatch(/\/group-practice\/(room|join)/);
  });

  test("landing: indexable, a11y at this viewport", async ({ page }) => {
    await page.goto(ROOMS);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("button", { name: "Tạo phòng" })).toBeVisible();
    await noHorizontalScroll(page, "landing");
    await auditScreen(page, "landing (create + join)");
  });

  test("join screen and not-found panel: a11y", async ({ page }) => {
    await page.goto(`${ROOMS}/join`);
    await noHorizontalScroll(page, "vao");
    await auditScreen(page, "vao");
    await page.goto(`${ROOMS}/room/K7M2QX`);
    await expect(page.getByRole("heading", { name: "Không tìm thấy phòng" })).toBeVisible();
    await auditScreen(page, "room not found");
  });
});

test.describe("rooms flag OFF: coming soon", () => {
  test.skip(!ROOMS_OFF, "set ROOMS_E2E=off");

  test("landing shows coming-soon, noindex, not in sitemap", async ({ page, request }) => {
    await page.goto(ROOMS);
    await expect(page.locator("[data-state=coming-soon]")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("button", { name: "Tạo phòng" })).toHaveCount(0);
    await noHorizontalScroll(page, "coming soon");
    await auditScreen(page, "coming soon");
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toContain("/group-practice");
  });

  for (const path of roomPages) {
    test(`${path} is 404 and /rt is not proxied`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
      expect((await request.get("/rt/healthz")).status()).toBe(404);
    });
  }
});
