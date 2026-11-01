import { describe, expect, it, vi } from "vitest";
import { ContentUnavailableError, createContentStore } from "@/lib/content/store";
import { contentMode } from "@/lib/content/source";
import type { ContentBundle } from "@/lib/content/types";

const bundle = (marker: string): ContentBundle => ({ sources: [], passages: [], topics: [], questions: [], tests: [{ slug: marker } as never] });
const marker = (store: { current(): ContentBundle }) => (store.current().tests[0] as { slug: string }).slug;

describe("content store", () => {
 it("fails before the first load and serves the snapshot afterwards", async () => {
  const store = createContentStore({ ttlMs: 1000, load: () => Promise.resolve(bundle("a")) });
  expect(() => store.current()).toThrow(ContentUnavailableError);
  await store.ensure();
  expect(marker(store)).toBe("a");
 });

 it("shares one load between concurrent callers (single flight)", async () => {
  const load = vi.fn(() => Promise.resolve(bundle("a")));
  const store = createContentStore({ ttlMs: 1000, load });
  await Promise.all([store.ensure(), store.ensure(), store.ensure()]);
  expect(load).toHaveBeenCalledTimes(1);
 });

 it("does not reload while fresh and refreshes in the background once stale", async () => {
  let clock = 0; let n = 0;
  const load = vi.fn(() => Promise.resolve(bundle(`v${++n}`)));
  const store = createContentStore({ ttlMs: 1000, load, now: () => clock });
  await store.ensure(); clock = 999; await store.ensure();
  expect(load).toHaveBeenCalledTimes(1);
  clock = 1001; await store.ensure(); // answers from the stale snapshot and starts ONE background reload
  await store.ensure();
  expect(load).toHaveBeenCalledTimes(2);
  await vi.waitFor(() => expect(marker(store)).toBe("v2"));
 });

 it("keeps serving the last good snapshot when a refresh fails (stale-on-error)", async () => {
  let clock = 0; let fail = false;
  const onError = vi.fn();
  const store = createContentStore({ ttlMs: 10, now: () => clock, onError, load: () => (fail ? Promise.reject(new Error("db down")) : Promise.resolve(bundle("good"))) });
  await store.ensure();
  fail = true; clock = 50;
  await store.ensure();
  await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  expect(marker(store)).toBe("good");
  await expect(store.invalidate()).rejects.toThrow("db down");
  expect(marker(store)).toBe("good");
 });

 it("rejects the first load when the source is down so the edge can answer 503", async () => {
  const store = createContentStore({ ttlMs: 10, load: () => Promise.reject(new Error("db down")) });
  await expect(store.ensure()).rejects.toThrow("db down");
  expect(store.loadedAt()).toBeUndefined();
 });
});

describe("content mode", () => {
 it("uses the database only when a connection is configured, unless forced", () => {
  expect(contentMode({})).toBe("files");
  expect(contentMode({ DATABASE_URL: "postgres://x" })).toBe("db");
  expect(contentMode({ DATABASE_URL_FILE: "/run/secrets/x" })).toBe("db");
  expect(contentMode({ DATABASE_URL: "postgres://x", CONTENT_SOURCE: "files" })).toBe("files");
  expect(contentMode({ CONTENT_SOURCE: "db" })).toBe("db");
 });
});
