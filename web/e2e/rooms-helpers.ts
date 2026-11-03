import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

export const ROOMS = "/group-practice";
export const ROOMS_ON = process.env.ROOMS_E2E === "on";
export const ROOMS_OFF = process.env.ROOMS_E2E === "off";

/** Everything the server sent to this page about the room, collected for the leak scan. */
export type Capture = { responses: string[]; sse: string[] };

export async function newPlayer(browser: Browser, info: TestInfo): Promise<{ ctx: BrowserContext; page: Page; cap: Capture }> {
  const { viewport, hasTouch, isMobile } = info.project.use;
  const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, hasTouch, isMobile });
  const cap: Capture = { responses: [], sse: [] };
  // EventSource frames are not exposed by the response API: wrap the constructor before any page script runs.
  await ctx.addInitScript(() => {
    const w = window as unknown as { __sse: string[] };
    w.__sse = [];
    const Native = window.EventSource;
    class Spy extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        for (const name of ["snapshot", "player_joined", "player_left", "player_kicked", "player_connection", "host_changed", "settings_changed", "player_ready_changed", "game_started", "progress", "results_ready", "rematch", "room_closed", "superseded", "server_restarting"]) {
          this.addEventListener(name, e => w.__sse.push(`${name} ${(e as MessageEvent).data}`));
        }
      }
    }
    window.EventSource = Spy as typeof EventSource;
  });
  const page = await ctx.newPage();
  page.on("response", async res => {
    if (!new URL(res.url()).pathname.startsWith("/rt/") || res.url().endsWith("/events")) return;
    try { cap.responses.push(`${res.request().method()} ${new URL(res.url()).pathname} ${res.status()} ${await res.text()}`); } catch { /* body gone after navigation */ }
  });
  return { ctx, page, cap };
}

export async function drainSse(page: Page, cap: Capture) {
  cap.sse.push(...(await page.evaluate(() => (window as unknown as { __sse: string[] }).__sse.splice(0))));
}

/** Fails if the captured traffic holds answer keys, explanations, scores or anyone's answers. */
export function assertNoLeak(cap: Capture, explanations: string[], label: string) {
  const all = [...cap.responses, ...cap.sse];
  const forbidden = /"(correctKey|explanation|correct|score|percent|rank|selectedKey)"/;
  for (const line of all) {
    const own = /^(GET|PUT) \/rt\/rooms\/[A-Z0-9]+\/(quiz|answers)/.test(line);
    // The player's own quiz/answers echo may carry its own choices, never keys or explanations.
    if (own) expect(line, `${label}: own quiz traffic`).not.toMatch(/"(correctKey|explanation|correct|score)"/);
    else expect(line, `${label}: ${line.slice(0, 80)}`).not.toMatch(forbidden);
    for (const e of explanations) expect(line.includes(e), `${label}: explanation text leaked in ${line.slice(0, 60)}`).toBe(false);
  }
}

/** axe (WCAG 2 A/AA incl. contrast) + 44px touch targets for the controls currently on screen. */
export async function auditScreen(page: Page, label: string) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(" ") + " " + (n.any[0]?.message ?? "")).join(" | ")}`), `${label}: axe`).toEqual([]);
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const sel = "main button, main select, main input:not([type=checkbox]):not([type=radio]), header button, dialog[open] button, dialog[open] select, main a.btn, main [role=button]";
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || r.width === 0 || el.closest("[data-inactive]")) continue;
      if (r.height < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" h=${Math.round(r.height)}`);
    }
    // Custom radio/checkbox chips: the visible label box is the touch target.
    for (const input of document.querySelectorAll<HTMLInputElement>("main input[type=radio], main input[type=checkbox], dialog[open] input[type=radio]")) {
      const box = input.closest("label");
      const r = (box ?? input).getBoundingClientRect();
      if (r.width === 0 || (box && box.closest("[data-inactive]"))) continue;
      if (r.height < 43.5) out.push(`${input.type} label "${(box?.textContent ?? "").trim().slice(0, 30)}" h=${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, `${label}: targets under 44px`).toEqual([]);
}

export async function noHorizontalScroll(page: Page, label: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const culprits = over > 0 ? await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest("[data-inactive]")).slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)}`)) : [];
  expect(over, `${label}: horizontal overflow ${culprits.join(" | ")}`).toBeLessThanOrEqual(0);
}
