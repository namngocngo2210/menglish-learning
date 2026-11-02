import { expect, it } from "vitest";
import { PROGRESS_KEY, readAllProgress, readProgress, saveProgress } from "@/lib/progress";
function fakeStorage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }
it("stores last and best scores per slug in a versioned record", () => {
 const store = fakeStorage(); expect(readProgress("test", store)).toBeUndefined();
 saveProgress("test", 8, 20, store); saveProgress("test", 5, 20, store); saveProgress("other", 2, 3, store);
 expect(readProgress("test", store)).toMatchObject({ best: 8, last: 5, total: 20 });
 expect(readProgress("other", store)).toMatchObject({ best: 2, last: 2, total: 3 });
 expect(JSON.parse(store.getItem(PROGRESS_KEY)!).test.at).toEqual(expect.any(String));
});
it("tolerates inaccessible, malformed and invalid storage", () => {
 const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
 expect(readProgress("test", blocked)).toBeUndefined(); expect(() => saveProgress("test", 1, 2, blocked)).not.toThrow();
 const store = fakeStorage();
 for (const value of ["bad-json", "null", '[]', '{"test":{"best":20,"last":30,"total":2,"at":"bad"}}']) {
  store.setItem(PROGRESS_KEY, value); expect(readProgress("test", store)).toBeUndefined();
 }
 saveProgress("test", 3, 2, store); expect(readProgress("test", store)).toBeUndefined();
});
it("lists only valid stored results for the parent-confirmed import", () => {
 const store = fakeStorage(); saveProgress("a", 3, 5, store); saveProgress("b", 1, 2, store);
 store.setItem(PROGRESS_KEY, JSON.stringify({ ...JSON.parse(store.getItem(PROGRESS_KEY)!), bad: { best: 9, last: 1, total: 2, at: "x" } }));
 expect(readAllProgress(store).map(i => i.slug)).toEqual(["a", "b"]);
 expect(readAllProgress({ getItem() { throw new Error("blocked"); }, setItem() {} })).toEqual([]);
});
