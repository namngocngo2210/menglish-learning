import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

// Exercise event handlers in the node test environment while retaining hook state between renders.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0, effects: [] as (() => void)[] }));
vi.mock("react", async importOriginal => ({
 ...await importOriginal<typeof import("react")>(),
 useState: (initial: unknown) => {
  const index = hooks.index++;
  if (!(index in hooks.values)) hooks.values[index] = initial;
  return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
 },
 useRef: (initial: unknown) => {
  const index = hooks.index++;
  if (!(index in hooks.values)) hooks.values[index] = { current: initial };
  return hooks.values[index];
 },
 useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
import { RandomQuiz } from "@/components/quiz/RandomQuiz";

function elements(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
 if (Array.isArray(node)) return node.flatMap(elements);
 if (!isValidElement<{ children?: ReactNode }>(node)) return [];
 return [{ type: node.type, props: node.props }, ...elements(node.props.children)];
}
function render() {
 hooks.index = 0; hooks.effects = [];
 const tree = RandomQuiz({ poolUrl: "/pool/test", size: 1, children: createElement("p", null, "Fixed quiz HTML") });
 const nodes = elements(tree);
 return { tree, button: nodes.find(n => n.type === "button")!.props, status: nodes.find(n => n.props.role === "status")!.props, nodes };
}
afterEach(() => { hooks.values = []; vi.unstubAllGlobals(); });

it("keeps fixed children in server HTML and fetches only after a click, with loading, focus, and cached retries", async () => {
 let resolvePool!: (value: unknown) => void;
 const fetchPool = vi.fn(() => new Promise(resolve => { resolvePool = resolve; }));
 vi.stubGlobal("fetch", fetchPool);
 const initial = render();
 expect(renderToStaticMarkup(initial.tree)).toContain("Fixed quiz HTML");
 expect(fetchPool).not.toHaveBeenCalled();
 const pending = (initial.button.onClick as () => Promise<void>)();
 const loading = render();
 expect(loading.button.disabled).toBe(true);
 expect(loading.button["aria-busy"]).toBe(true);
 expect(loading.status["aria-live"]).toBe("polite");
 expect(JSON.stringify(loading.status.children)).toContain("Đang tải");
 resolvePool({ ok: true, json: async () => ({ questions: [{ id: "q1", stem: "Choose.", options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }, { key: "C", text: "Three" }, { key: "D", text: "Four" }], correctKey: "A", explanation: "One.", difficulty: 1, skill: "ngu-phap" }], passages: [] }) });
 await pending;
 const active = render();
 expect(active.button.disabled).toBe(false);
 expect(active.button.children).toBe("Làm đề ngẫu nhiên khác");
 expect(active.nodes.some(n => n.props.children === "Fixed quiz HTML")).toBe(false);
 const focus = vi.fn();
 const region = hooks.values[4] as { current: unknown };
 region.current = { querySelector: (selector: string) => { expect(selector).toBe("#quiz-heading"); return { focus }; } };
 hooks.effects.forEach(effect => effect());
 expect(focus).toHaveBeenCalledOnce();
 await (active.button.onClick as () => Promise<void>)();
 expect(fetchPool).toHaveBeenCalledOnce();
 const triggerFocus = vi.fn();
 (hooks.values[5] as { current: unknown }).current = { focus: triggerFocus };
 const back = render().nodes.filter(n => n.type === "button")[1];
 (back.props.onClick as () => void)();
 expect(triggerFocus).toHaveBeenCalledOnce();
 expect(render().nodes.some(n => n.props.children === "Fixed quiz HTML")).toBe(true);
});

it("announces fetch errors and lets the learner retry while keeping fixed children", async () => {
 const fetchPool = vi.fn().mockResolvedValue({ ok: false });
 vi.stubGlobal("fetch", fetchPool);
 await (render().button.onClick as () => Promise<void>)();
 const failed = render();
 expect(JSON.stringify(failed.status.children)).toContain("Chưa tải được đề");
 expect(failed.button.disabled).toBe(false);
 expect(failed.nodes.some(n => n.props.children === "Fixed quiz HTML")).toBe(true);
 await (failed.button.onClick as () => Promise<void>)();
 expect(fetchPool).toHaveBeenCalledTimes(2);
});
