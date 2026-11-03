import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { assertNoLeak, auditScreen, drainSse, newPlayer, noHorizontalScroll, ROOMS, ROOMS_ON, type Capture } from "./rooms-helpers";

// Needs the production build with ROOMS_ENABLED=true and the rooms server behind ROOMS_DEV_PROXY (see scripts/rooms-e2e.sh).
test.skip(!ROOMS_ON, "set ROOMS_E2E=on (scripts/rooms-e2e.sh)");

const bank = JSON.parse(readFileSync(join(process.cwd(), "../rooms/data/bank-rooms.json"), "utf8")) as { questions: { explanation?: string }[] };
const EXPLANATIONS = [...new Set(bank.questions.map(q => (q.explanation ?? "").trim()).filter(e => e.length >= 20))];

async function createRoom(page: Page, name: string, max: "2 (đấu đôi)" | "5") {
  await page.goto(ROOMS);
  await page.getByRole("heading", { name: "Luyện tập nhóm", level: 1 }).waitFor();
  await page.getByLabel("Tên hiển thị của bạn").fill(name);
  await page.getByText("10 câu", { exact: true }).click();
  await page.getByText(max, { exact: true }).click();
  await expect(page.getByRole("button", { name: "Tạo phòng" })).toBeEnabled();
  await page.getByRole("button", { name: "Tạo phòng" }).click();
  await page.waitForURL(/\/group-practice\/room\/[A-Z0-9]{6}$/);
  await expect(page.locator("[data-slot=lobby]")).toBeVisible();
  return page.url().split("/").pop()!;
}

const pressReady = (page: Page) => page.getByRole("button", { name: "Sẵn sàng", exact: true }).click();

async function joinByCode(page: Page, code: string, name: string, viaLanding: boolean) {
  if (viaLanding) {
    await page.goto(ROOMS);
    await page.getByLabel("Mã phòng hoặc đường dẫn").first().fill(code.toLowerCase());
    await page.getByRole("button", { name: "Vào phòng" }).first().click();
  } else await page.goto(`${ROOMS}/room/${code}`);
  await page.locator("[data-slot=join]").waitFor();
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByRole("button", { name: "Vào phòng" }).click();
  await expect(page.locator("[data-slot=lobby]")).toBeVisible();
}

/** Answers every question: `pick(i)` returns the option index, or null to leave it blank. First one is a real click. */
async function answerAll(page: Page, pick: (i: number) => number | null) {
  await expect(page.locator("[data-slot=play]")).toBeVisible();
  await page.locator("[data-quiz-sections] input[type=radio]").first().waitFor({ state: "attached" });
  const count = await page.evaluate(() => new Set([...document.querySelectorAll<HTMLInputElement>("[data-quiz-sections] input[type=radio]")].map(r => r.name)).size);
  const firstPick = pick(0);
  // The first answer is a real click; the rest are set in bulk (questions in inactive sections are hidden).
  if (firstPick !== null) await page.locator("[data-quiz-sections] label:has(input[type=radio]):visible").nth(firstPick).click();
  for (let i = 1; i < count; i++) {
    const idx = pick(i);
    if (idx === null) continue;
    await page.evaluate(([g, k]) => {
      const groups = new Map<string, HTMLInputElement[]>();
      for (const r of document.querySelectorAll<HTMLInputElement>("[data-quiz-sections] input[type=radio]")) groups.set(r.name, [...(groups.get(r.name) ?? []), r]);
      const group = [...groups.values()][g];
      group[k % group.length].click();
    }, [i, idx]);
  }
  return count;
}

async function submitAll(page: Page) {
  await page.getByRole("button", { name: "Nộp bài" }).click();
  const dlg = page.getByRole("dialog", { name: "Nộp bài?" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: /^Nộp bài/ }).click();
  await expect(page.locator("[data-slot=submitted], [data-slot=results]")).toBeVisible();
}

test.describe("rooms", () => {
  test("1v1: lobby leave cancels, playing leave forfeits (D7)", async ({ browser }, info) => {
    const host = await newPlayer(browser, info);
    const guest = await newPlayer(browser, info);
    try {
      // A) Guest leaves in the lobby -> match cancelled for both.
      let code = await createRoom(host.page, "Minh", "2 (đấu đôi)");
      await auditScreen(host.page, "lobby host (waiting)");
      await expect(host.page.getByText(/Cần ít nhất 2 người/)).toBeVisible();
      await joinByCode(guest.page, code, "Lan", true);
      // Ready step: nobody is ready, so the host cannot start; the host must press Sẵn sàng too.
      await expect(host.page.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
      await expect(host.page.getByText("Chờ 2 người sẵn sàng")).toBeVisible();
      await pressReady(guest.page);
      await expect(guest.page.getByRole("button", { name: "Bỏ sẵn sàng" })).toHaveAttribute("aria-pressed", "true");
      await expect(host.page.getByText("Đã sẵn sàng 1/2")).toBeVisible();
      await expect(host.page.getByText("Chờ 1 người sẵn sàng")).toBeVisible();
      await expect(host.page.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
      await pressReady(host.page);
      await expect(host.page.getByText("Tất cả đã sẵn sàng, chủ phòng có thể bắt đầu")).toBeVisible();
      await expect(host.page.getByRole("button", { name: "Bắt đầu" })).toBeEnabled();
      await auditScreen(guest.page, "lobby guest");
      await guest.page.getByRole("button", { name: "Rời phòng" }).click();
      const warnLobby = guest.page.getByRole("dialog", { name: "Rời phòng?" });
      await expect(warnLobby).toContainText("ván đấu sẽ bị hủy");
      await auditScreen(guest.page, "leave dialog (lobby)");
      await warnLobby.getByRole("button", { name: "Ở lại" }).click();
      await expect(guest.page.locator("[data-slot=lobby]")).toBeVisible();
      await guest.page.getByRole("button", { name: "Rời phòng" }).click();
      await guest.page.getByRole("dialog", { name: "Rời phòng?" }).getByRole("button", { name: /^Rời phòng/ }).click();
      await guest.page.waitForURL(new RegExp(`${ROOMS}$`));
      await expect(host.page.getByRole("heading", { name: "Phòng đã đóng" })).toBeVisible();

      // B) New room: guest leaves while playing -> host wins.
      code = await createRoom(host.page, "Minh", "2 (đấu đôi)");
      await joinByCode(guest.page, code, "Lan", false);
      await pressReady(host.page);
      await pressReady(guest.page);
      await host.page.getByRole("button", { name: "Bắt đầu" }).click();
      await answerAll(host.page, () => 0);
      await expect(guest.page.locator("[data-slot=play]")).toBeVisible();
      await auditScreen(guest.page, "play (duel)");
      await guest.page.getByRole("button", { name: "Rời phòng" }).click();
      const warnPlay = guest.page.getByRole("dialog", { name: "Rời phòng?" });
      await expect(warnPlay).toContainText("đối thủ sẽ thắng");
      await warnPlay.getByRole("button", { name: /^Rời phòng/ }).click();
      await guest.page.waitForURL(new RegExp(`${ROOMS}$`));
      // Host submits after the forfeit and sees the duel result.
      if (await host.page.getByRole("button", { name: "Nộp bài" }).isVisible()) await submitAll(host.page);
      await expect(host.page.locator("[data-slot=results]")).toBeVisible();
      await expect(host.page.getByRole("heading", { level: 1 })).toContainText("Bạn thắng — đối thủ đã rời phòng");
      await auditScreen(host.page, "results (duel)");
    } finally { await host.ctx.close(); await guest.ctx.close(); }
  });

  test("3 players: create, join, lobby, play, tied ranks, rematch, no leaks", async ({ browser }, info) => {
    test.setTimeout(120_000);
    const players = [await newPlayer(browser, info), await newPlayer(browser, info), await newPlayer(browser, info)];
    const [a, b, c] = players;
    try {
      const code = await createRoom(a.page, "Minh", "5");
      await auditScreen(a.page, "create -> lobby host");
      await joinByCode(b.page, code, "Lan", true);
      await joinByCode(c.page, code, "Hùng", false);
      for (const p of players) await expect(p.page.getByRole("list", { name: "Người chơi trong phòng" }).getByRole("listitem")).toHaveCount(3);
      await noHorizontalScroll(a.page, "lobby");
      await auditScreen(a.page, "lobby host (3)");
      await auditScreen(b.page, "lobby guest (3)");

      // One player is not ready -> the host cannot start; all ready -> start works.
      await expect(a.page.getByText("Đã sẵn sàng 0/3")).toBeVisible();
      await pressReady(a.page);
      await pressReady(b.page);
      await expect(a.page.getByText("Đã sẵn sàng 2/3")).toBeVisible();
      await expect(a.page.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
      await expect(a.page.getByText("Chờ 1 người sẵn sàng")).toBeVisible();
      await expect(a.page.getByText("Chưa sẵn sàng")).toHaveCount(1);
      await auditScreen(a.page, "lobby host (2/3 ready)");
      await auditScreen(c.page, "lobby guest (not ready)");
      await pressReady(c.page);
      await expect(a.page.getByRole("button", { name: "Bắt đầu" })).toBeEnabled();
      await a.page.getByRole("button", { name: "Bắt đầu" }).click();

      // Play: A answers all (first option), B and C leave everything blank -> B and C tie.
      const total = await answerAll(a.page, () => 0);
      expect(total).toBe(10);
      await expect(b.page.locator("[data-slot=play]")).toBeVisible();
      await expect(c.page.locator("[data-slot=play]")).toBeVisible();
      await auditScreen(b.page, "play");
      await noHorizontalScroll(b.page, "play");
      // Nothing sensitive reached any client before the results.
      for (const p of players) await drainSse(p.page, p.cap);
      players.forEach((p, i) => assertNoLeak(p.cap, EXPLANATIONS, `pre-results player ${i}`));
      expect(players.every(p => p.cap.sse.length > 0 && p.cap.responses.length > 0)).toBe(true);

      await submitAll(a.page);
      await expect(a.page.locator("[data-slot=submitted]")).toBeVisible();
      await auditScreen(a.page, "waiting");
      await submitAll(b.page);
      await submitAll(c.page);
      for (const p of players) { await expect(p.page.locator("[data-slot=results]")).toBeVisible(); await expect(p.page.getByRole("list", { name: "Bảng xếp hạng" })).toBeVisible(); }

      const rows = await a.page.getByRole("list", { name: "Bảng xếp hạng" }).getByRole("listitem").allInnerTexts();
      expect(rows).toHaveLength(3);
      const ranks = rows.map(r => Number(/Hạng (\d+)/.exec(r)![1]));
      expect(ranks[0]).toBeLessThanOrEqual(ranks[1]);
      expect(ranks[1]).toBeLessThanOrEqual(ranks[2]);
      await expect(a.page.getByText("Bằng điểm: xếp chung hạng.")).toBeVisible();
      expect(new Set(ranks).size).toBeLessThan(3);
      await expect(a.page.getByText("chung hạng", { exact: true }).first()).toBeVisible();
      await auditScreen(a.page, "results host");
      await auditScreen(b.page, "results guest");
      await noHorizontalScroll(a.page, "results");

      // Review reveals keys only now.
      await b.page.getByRole("button", { name: /Xem đáp án và lời giải/ }).click();
      await expect(b.page.getByText(/Đúng \d+ · Sai \d+ · Bỏ trống \d+/)).toBeVisible();
      await auditScreen(b.page, "results + review");

      // Rematch: host restarts, everybody returns to a fresh lobby.
      await a.page.getByRole("button", { name: "Chơi lại" }).click();
      for (const p of players) await expect(p.page.locator("[data-slot=lobby]")).toBeVisible();
      // Everybody is back in the lobby and must press Sẵn sàng again.
      await expect(a.page.getByText("Đã sẵn sàng 0/3")).toBeVisible();
      await expect(a.page.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
    } finally { for (const p of players) await p.ctx.close(); }
  });
});

export type { Capture };
