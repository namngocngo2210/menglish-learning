import { isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

// Retain hook state between renders so effects can be run by hand in the node environment.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0, effects: [] as (() => void)[] }));
vi.mock("react", async importOriginal => ({
 ...await importOriginal<typeof import("react")>(),
 useState: (initial: unknown) => {
  const index = hooks.index++;
  if (!(index in hooks.values)) hooks.values[index] = initial;
  return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
 },
 useRef: (initial: unknown) => { const index = hooks.index++; if (!(index in hooks.values)) hooks.values[index] = { current: initial }; return hooks.values[index]; },
 useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
import { QuickPractice, readGrade } from "@/components/quiz/QuickPractice";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { GET } from "@/app/pool/[grade]/route";

function flat(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
 if (Array.isArray(node)) return node.flatMap(flat);
 if (!isValidElement<{ children?: ReactNode }>(node)) return [];
 return [{ type: node.type, props: node.props }, ...flat(node.props.children)];
}
function render(stored: string | null) {
 vi.stubGlobal("localStorage", { getItem: () => stored, setItem: vi.fn() });
 hooks.values = []; hooks.index = 0; hooks.effects = [];
 QuickPractice({});
 hooks.effects.forEach(run => run());
 hooks.index = 0; hooks.effects = [];
 return QuickPractice({});
}
afterEach(() => vi.unstubAllGlobals());

it("parses only valid remembered grades", () => {
 expect([readGrade("7"), readGrade("5"), readGrade("x"), readGrade(null)]).toEqual([7, null, null, null]);
});
it("uses the remembered grade pool as default", () => {
 const quiz = flat(render("7")).find(e => e.type === RandomQuiz);
 expect(quiz?.props.poolUrl).toBe("/pool/grade-7");
});
it("shows a visible grade choice and no quiz when no grade is stored", () => {
 const nodes = flat(render(null));
 expect(nodes.some(e => e.type === RandomQuiz)).toBe(false);
 expect(nodes.filter(e => e.type === "button")).toHaveLength(4);
});
it("serves a pool limited to the requested grade", async () => {
 const res = await GET(new Request("http://x/pool/grade-7"), { params: Promise.resolve({ grade: "grade-7" }) });
 const body = await res.json() as { questions: unknown[] };
 expect(res.status).toBe(200);
 expect(body.questions.length).toBeGreaterThan(0);
 expect((await GET(new Request("http://x"), { params: Promise.resolve({ grade: "grade-1" }) })).status).toBe(404);
});
