import { afterEach, expect, it, vi } from "vitest";
import { PROGRESS_KEY, saveProgress } from "@/lib/progress";

const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useEffect: (effect: () => void | (() => void)) => { effects.push(effect); } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/topic" }));
import { ProgressHydrator } from "@/components/quiz/ProgressHydrator";
afterEach(() => { effects.length = 0; vi.unstubAllGlobals(); });

it("hydrates all server targets, updates both progress events, clears missing results, and unsubscribes", () => {
 const values = new Map<string, string>();
 const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
 const events = new EventTarget();
 vi.stubGlobal("window", Object.assign(events, { localStorage }));
 const targets = ["one", "two", "missing"].map(slug => ({ dataset: { progressSlug: slug }, textContent: "" }));
 vi.stubGlobal("document", { querySelectorAll: (selector: string) => { expect(selector).toBe("[data-progress-slug]"); return targets; } });
 saveProgress("one", 1, 3); saveProgress("two", 8, 10);
 expect(ProgressHydrator()).toBeNull();
 expect(targets[0].textContent).toBe("");
 const cleanup = effects[0]();
 expect(targets.map(t => t.textContent)).toEqual(["Lần trước: 1/3 (3,3 điểm)", "Lần trước: 8/10 (8 điểm)", ""]);
 saveProgress("one", 2, 3);
 expect(targets[0].textContent).toBe("Lần trước: 2/3 (6,7 điểm)");
 localStorage.setItem(PROGRESS_KEY, "{}"); events.dispatchEvent(new Event("storage"));
 expect(targets.every(t => t.textContent === "")).toBe(true);
 if (typeof cleanup === "function") cleanup();
 saveProgress("one", 3, 3);
 expect(targets[0].textContent).toBe("");
});
