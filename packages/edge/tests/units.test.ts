import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { LruStore } from "../src/cache";
import type { Entry } from "../src/cache";
import { loadConfig } from "../src/config";
import { createLogger } from "../src/logger";
import { cacheKey, isCacheableType, policyFor } from "../src/policy";
import { createHttpUpstream } from "../src/upstream";

const entry = (size: number): Entry => ({
  status: 200,
  contentType: "text/html",
  body: Buffer.alloc(size),
  etag: "e",
  lastModified: "l",
  at: 0,
  ttl: 1,
  stale: 1,
});

describe("LruStore", () => {
  it("evicts the least recently used entries beyond the byte budget", () => {
    const store = new LruStore(100);
    for (const k of ["a", "b", "c", "d"]) store.set(k, entry(24));
    store.get("a");
    store.set("e", entry(24));
    expect(store.keys()).toEqual(["c", "d", "a", "e"]);
    expect(store.bytes).toBe(96);
  });

  it("refuses entries larger than a quarter of the budget and tracks bytes on replace/delete", () => {
    const store = new LruStore(100);
    expect(store.set("big", entry(26))).toBe(false);
    store.set("a", entry(10));
    store.set("a", entry(20));
    expect(store.bytes).toBe(20);
    expect(store.delete("a")).toBe(true);
    expect(store.delete("a")).toBe(false);
    expect(store.bytes).toBe(0);
    store.set("x", entry(5));
    expect(store.clear()).toBe(1);
    expect(store.size).toBe(0);
  });
});

describe("policy", () => {
  it("classifies content types and keys", () => {
    expect(isCacheableType("text/html; charset=utf-8")).toBe(true);
    expect(isCacheableType("image/png")).toBe(false);
    expect(isCacheableType(undefined)).toBe(false);
    expect(policyFor("/robots.txt")).toEqual({ ttl: 3600, stale: 86400 });
    expect(cacheKey("/x?b=2&utm_campaign=1&a=1")).toEqual({ path: "/x", key: "/x?a=1&b=2" });
    expect(cacheKey("/x?a=2&a=1").key).toBe("/x?a=1&a=2");
  });
});

describe("loadConfig", () => {
  it("applies defaults and rejects bad values without echoing them", () => {
    const config = loadConfig({ INTERNAL_TOKEN: "x".repeat(20) });
    expect(config).toMatchObject({ port: 3100, maxRenderQueue: 64, maxConcurrentRenders: 16, warmEnabled: true });
    expect(() => loadConfig({ EDGE_PORT: "banana", INTERNAL_TOKEN: "short" })).toThrow(/EDGE_PORT/);
    try {
      loadConfig({ INTERNAL_TOKEN: "short" });
    } catch (error) {
      expect(String(error)).not.toContain("short");
    }
  });

  it("works without a token (purge disabled)", () => {
    expect(loadConfig({}).token).toBeUndefined();
  });
});

describe("logger", () => {
  it("writes JSON lines", () => {
    const lines: string[] = [];
    const log = createLogger((l) => lines.push(l));
    log.info("a", { n: 1 });
    log.warn("b");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ level: "info", event: "a", n: 1 });
    expect(JSON.parse(lines[1] ?? "{}")).toMatchObject({ level: "warn", event: "b" });
  });
});

describe("createHttpUpstream", () => {
  it("fetches over HTTP, forces identity encoding, and times out on a hung server", async () => {
    let seen = "";
    const server = http.createServer((req, res) => {
      if (req.url === "/hang") return;
      seen = String(req.headers["accept-encoding"]);
      res.writeHead(200, { "content-type": "text/plain", "x-multi": "a" });
      res.end("hello");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = new URL(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
    const fetchUp = createHttpUpstream(base, 150);
    const ok = await fetchUp({ method: "GET", path: "/", headers: { "accept-encoding": "gzip" } });
    expect([ok.status, ok.body.toString(), seen]).toEqual([200, "hello", "identity"]);
    await expect(fetchUp({ method: "GET", path: "/hang", headers: {} })).rejects.toThrow();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
