import { expect, test, type Page, type TestInfo } from "@playwright/test";

const READING = "/grade-10-entrance/test-1";
const GRAMMAR = "/grade-6/grammar/mixed/test-1";
const shotDir = process.env.SHOT_DIR;
async function shot(page: Page, info: TestInfo, name: string) {
 await page.evaluate(() => document.getElementById("quiz-nav")?.scrollIntoView({ block: "start" }));
 if (shotDir) await page.screenshot({ path: `${shotDir}/${info.project.name}-${name}.png`, fullPage: false });
}
const isDesktop = (info: TestInfo) => info.project.name === "desktop-1440";
async function openQuiz(page: Page, url: string) {
 await page.goto(url);
 await page.getByRole("button", { name: "Nộp bài" }).waitFor();
 // Wait for hydration: the control bar is live once Tổng quan responds.
 await expect(page.getByRole("button", { name: /Tổng quan/ })).toBeEnabled();
}

test.describe("sectioned reading test", () => {
 test("navigates sections and keeps passage + questions together", async ({ page }, info) => {
  await openQuiz(page, READING);
  const nav = page.getByRole("navigation", { name: "Các phần của bài" });
  await expect(nav.locator("a[aria-current=step]")).toContainText("Bài đọc 1/3");
  const first = page.locator("[data-quiz-sections] > section").first();
  await expect(first).toBeVisible();
  await expect(page.locator("[data-quiz-sections] > section").nth(1)).toBeHidden();
  await shot(page, info, "1-reading-section");
  await page.getByRole("button", { name: /Phần sau/ }).click();
  await expect(nav.locator("a[aria-current=step]")).toContainText("Bài đọc 2/3");
  await expect(first).toBeHidden();
  await nav.getByRole("link", { name: /Bài đọc 3\/3/ }).click();
  await expect(nav.locator("a[aria-current=step]")).toContainText("Bài đọc 3/3");
 });

 test("scroll behaviour", async ({ page }, info) => {
  await openQuiz(page, READING);
  const section = page.locator("[data-quiz-sections] > section").first();
  const passagePane = section.locator("section[aria-labelledby^='passage-']");
  const questionPane = section.getByLabel(/Câu hỏi của Bài đọc 1/);
  if (isDesktop(info)) {
   for (const p of [passagePane, questionPane]) {
    await expect(p).toHaveCSS("overflow-y", "auto");
    await expect(p).toHaveAttribute("tabindex", "0");
   }
   await page.evaluate(() => document.getElementById("quiz-nav")?.scrollIntoView({ block: "start" }));
   const startY = await page.evaluate(() => window.scrollY);
   const sizes = await Promise.all([passagePane, questionPane].map(p => p.evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight }))));
   for (const s of sizes) expect(s.sh).toBeGreaterThan(s.ch);
   const top = (p: typeof passagePane) => p.evaluate(el => el.scrollTop);
   const box = (await questionPane.boundingBox())!;
   await page.mouse.move(box.x + box.width / 2, box.y + 200);
   await page.mouse.wheel(0, 400);
   await expect.poll(() => top(questionPane)).toBeGreaterThan(100);
   expect(await top(passagePane)).toBe(0);
   expect(await page.evaluate(() => window.scrollY)).toBe(startY);
   const pbox = (await passagePane.boundingBox())!;
   await page.mouse.move(pbox.x + pbox.width / 2, pbox.y + 200);
   await page.mouse.wheel(0, 300);
   await expect.poll(() => top(passagePane)).toBeGreaterThan(50);
   expect(await page.evaluate(() => window.scrollY)).toBe(startY);
   // Keyboard: focused pane scrolls with PageDown.
   const before = await top(questionPane);
   await questionPane.focus();
   await page.keyboard.press("PageDown");
   await expect.poll(() => top(questionPane)).toBeGreaterThan(before);
   // Sticky title stays visible while the passage scrolls.
   await expect(passagePane.getByRole("heading").first()).toBeInViewport();
   await shot(page, info, "2-reading-split-scrolled");
  } else {
   const nested = await page.evaluate(() => [...document.querySelectorAll("[data-quiz-sections] *")].filter(el => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.closest("nav")).length);
   expect(nested).toBe(0);
   await page.mouse.wheel(0, 900);
   await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  }
 });

 test("mobile passage collapse, expand and jump bar", async ({ page }, info) => {
  test.skip(isDesktop(info), "mobile pattern");
  await openQuiz(page, READING);
  const body = page.locator("[id^='passage-body-']").first();
  await expect(body).toBeVisible();
  await shot(page, info, "3-mobile-passage-expanded");
  await page.getByRole("button", { name: "Ẩn bài đọc" }).first().click();
  await expect(body).toBeHidden();
  await shot(page, info, "4-mobile-passage-collapsed");
  // Answer far down, then re-read the passage from the sticky bar.
  await page.getByRole("button", { name: "Câu chưa làm tiếp" }).click();
  await page.getByRole("button", { name: "Xem bài đọc" }).last().click();
  await expect(body).toBeVisible();
  await expect(page.locator("[id^='passage-pane-']").first()).toBeInViewport();
  // The sticky bar stays reachable while scrolling.
  await page.mouse.wheel(0, 1500);
  await expect(page.getByRole("button", { name: "Câu chưa làm tiếp" })).toBeInViewport();
 });

 test("answer, check, lock, reload restores, overview, confirm, results", async ({ page }, info) => {
  await openQuiz(page, READING);
  const q1 = page.locator("[data-quiz-sections] > section").first().locator("fieldset").first();
  await q1.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: /Kiểm tra câu 1/ }).click();
  await expect(page.locator("[id^='feedback-']").first()).toContainText(/Chính xác!|Chưa đúng — đáp án:|Đáp án đúng/);
  await expect(q1).toHaveAttribute("disabled", "");
  await page.reload();
  await expect(page.getByText("Đã khôi phục bài làm đang dở.")).toBeVisible();
  await expect(q1.getByRole("radio").nth(1)).toBeChecked();
  await page.getByRole("button", { name: /Tổng quan/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Tổng quan bài làm");
  await shot(page, info, "5-overview");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByRole("dialog")).toContainText("câu chưa làm");
  await shot(page, info, "6-confirm");
  await page.getByRole("dialog").getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả của em" })).toBeVisible();
  await shot(page, info, "7-results");
  await page.reload();
  await expect(page.getByText("Đã khôi phục bài làm đang dở.")).toBeHidden();
 });
});

test("grammar block is a single exercise section", async ({ page }, info) => {
 await openQuiz(page, GRAMMAR);
 await expect(page.getByRole("navigation", { name: "Các phần của bài" })).toContainText("Bài tập");
 await expect(page.locator("[data-quiz-sections] [id^='passage-pane']")).toHaveCount(0);
 await shot(page, info, "8-grammar");
});

test("no-JS: all passages and questions are in the HTML and visible stacked", async ({ browser }, info) => {
 const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport ?? undefined });
 const page = await context.newPage();
 await page.goto(READING);
 const sections = page.locator("[data-quiz-sections] > section");
 expect(await sections.count()).toBeGreaterThanOrEqual(4);
 for (let i = 0; i < (await sections.count()); i++) await expect(sections.nth(i)).toBeVisible();
 await context.close();
});
