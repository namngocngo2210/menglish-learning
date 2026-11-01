import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createEdge } from "../src/edge";
import type { Edge } from "../src/edge";
import { createLogger } from "../src/logger";
import type { EdgeConfig } from "../src/config";
import type { FetchUpstream, UpstreamRequest, UpstreamResponse } from "../src/upstream";

const TOKEN = "test-token-0123456789abcdef";

function config(overrides: Partial<EdgeConfig> = {}): EdgeConfig {
  return {
    port: 0,
    upstream: new URL("http://127.0.0.1:3000"),
    token: TOKEN,
    maxBytes: 1024 * 1024,
    upstreamTimeoutMs: 1000,
    maxConcurrentRenders: 16,
    maxRenderQueue: 64,
    warmEnabled: true,
    spawnNext: false,
    ...overrides,
  };
}

const html = (body: string, extra: Record<string, string> = {}): UpstreamResponse => ({
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8", ...extra },
  body: Buffer.from(body),
});

interface Harness {
  edge: Edge;
  logs: string[];
  calls: UpstreamRequest[];
  clock: { now: number };
  get(path: string, headers?: Record<string, string>, method?: string): Promise<Reply>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Reply>;
}
interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const open: Edge[] = [];
async function start(
  upstream: (request: UpstreamRequest) => Promise<UpstreamResponse> | UpstreamResponse,
  overrides: Partial<EdgeConfig> = {},
): Promise<Harness> {
  const logs: string[] = [];
  const calls: UpstreamRequest[] = [];
  const clock = { now: 1_000_000 };
  const fetchUpstream: FetchUpstream = async (request) => {
    calls.push(request);
    return upstream(request);
  };
  const edge = createEdge({
    config: config(overrides),
    fetchUpstream,
    logger: createLogger((line) => logs.push(line)),
    now: () => clock.now,
    sleep: () => Promise.resolve(),
  });
  open.push(edge);
  await new Promise<void>((resolve) => edge.server.listen(0, "127.0.0.1", resolve));
  const port = (edge.server.address() as AddressInfo).port;
  const send = (
    method: string,
    path: string,
    headers: Record<string, string>,
    payload?: string,
  ): Promise<Reply> =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      });
      req.on("error", reject);
      req.end(payload);
    });
  return {
    edge,
    logs,
    calls,
    clock,
    get: (path, headers = {}, method = "GET") => send(method, path, headers),
    post: (path, body, headers = {}) =>
      send("POST", path, { "content-type": "application/json", ...headers }, JSON.stringify(body)),
  };
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((edge) => edge.close()));
});

const TOPIC = "/lop-6/ngu-phap/thi-hien-tai-don";
const TEST_PAGE = `${TOPIC}/de-1`;

describe("cache state machine", () => {
  it("serves MISS then HIT with cache headers and a validator", async () => {
    const h = await start(() => html("<h1>page</h1>"));
    const first = await h.get(TOPIC);
    expect(first.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.headers["cache-control"]).toBe(
      "public, max-age=0, s-maxage=60, stale-while-revalidate=86400",
    );
    expect(first.headers.etag).toMatch(/^W\//);
    const second = await h.get(TOPIC);
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body).toBe("<h1>page</h1>");
    expect(h.calls).toHaveLength(1);
  });

  it("applies the TTL table per route", async () => {
    const h = await start((request) =>
      request.path === "/sitemap.xml"
        ? {
            status: 200,
            headers: { "content-type": "application/xml" },
            body: Buffer.from("<urlset/>"),
          }
        : html("x"),
    );
    expect((await h.get(TEST_PAGE)).headers["cache-control"]).toContain("s-maxage=300");
    expect((await h.get("/sitemap.xml")).headers["cache-control"]).toContain("s-maxage=300");
    expect((await h.get("/thi-vao-lop-10/de-1")).headers["cache-control"]).toContain(
      "s-maxage=300",
    );
    expect((await h.get("/pool/lop-6/ngu-phap/tong-hop")).headers["cache-control"]).toContain(
      "s-maxage=300",
    );
    expect((await h.get("/")).headers["cache-control"]).toContain("s-maxage=60");
  });

  it("serves STALE immediately after the TTL and refreshes in the background", async () => {
    let version = 1;
    const h = await start(() => html(`v${String(version)}`));
    await h.get(TOPIC);
    version = 2;
    h.clock.now += 61_000;
    const stale = await h.get(TOPIC);
    expect(stale.headers["x-cache"]).toBe("STALE");
    expect(stale.body).toBe("v1");
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const fresh = await h.get(TOPIC);
    expect(fresh.headers["x-cache"]).toBe("HIT");
    expect(fresh.body).toBe("v2");
  });

  it("shares one upstream request between concurrent misses (single flight)", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = await start(async () => {
      await gate;
      return html("once");
    });
    const replies = Promise.all(Array.from({ length: 8 }, () => h.get(TOPIC)));
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    release?.();
    const done = await replies;
    expect(done.every((r) => r.body === "once")).toBe(true);
    expect(h.calls).toHaveLength(1);
  });

  it("answers 304 from the cache for If-None-Match and If-Modified-Since", async () => {
    const h = await start(() => html("body"));
    const first = await h.get(TOPIC);
    const byTag = await h.get(TOPIC, { "if-none-match": String(first.headers.etag) });
    expect(byTag.status).toBe(304);
    const bySince = await h.get(TOPIC, {
      "if-modified-since": String(first.headers["last-modified"]),
    });
    expect(bySince.status).toBe(304);
    expect((await h.get(TOPIC, { "if-none-match": 'W/"other"' })).status).toBe(200);
  });

  it("supports HEAD without a body", async () => {
    const h = await start(() => html("body"));
    const head = await h.get(TOPIC, {}, "HEAD");
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect(head.headers["content-length"]).toBe("4");
  });
});

describe("keys and cookies", () => {
  it("drops tracking parameters and sorts the rest", async () => {
    const h = await start(() => html("x"));
    await h.get(`${TOPIC}?utm_source=a&b=2&a=1&fbclid=z`);
    const second = await h.get(`${TOPIC}?a=1&b=2&gclid=q`);
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]?.path).toBe(`${TOPIC}?a=1&b=2`);
  });

  it("strips cookies before the upstream and never forwards Set-Cookie", async () => {
    const h = await start(() => html("x", { "set-cookie": "sid=secret" }));
    const reply = await h.get(TOPIC, { cookie: "sid=abc" });
    expect(h.calls[0]?.headers["cookie"]).toBeUndefined();
    expect(reply.headers["set-cookie"]).toBeUndefined();
    expect((await h.get(TOPIC, { cookie: "other=1" })).headers["set-cookie"]).toBeUndefined();
  });

  it("answers /healthz itself and hides /internal/*", async () => {
    const h = await start(() => html("x"));
    expect((await h.get("/healthz")).body).toBe("ok");
    expect((await h.get("/internal/refresh")).status).toBe(404);
    expect(h.calls).toHaveLength(0);
  });

  it("echoes a valid request id and generates one otherwise", async () => {
    const h = await start(() => html("x"));
    expect((await h.get(TOPIC, { "x-request-id": "abcdef12-3456" })).headers["x-request-id"]).toBe(
      "abcdef12-3456",
    );
    expect(
      String((await h.get(TOPIC, { "x-request-id": "bad id!" })).headers["x-request-id"]),
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("passes /_next and /api through without caching", async () => {
    const h = await start((request) => ({
      status: 200,
      headers: { "content-type": "application/javascript" },
      body: Buffer.from(request.path),
    }));
    await h.get("/_next/static/a.js");
    await h.get("/_next/static/a.js");
    expect(h.calls).toHaveLength(2);
    const posted = await h.post("/api/x", { a: 1 });
    expect(posted.status).toBe(200);
    expect(h.calls[2]?.method).toBe("POST");
  });
});

describe("failure handling", () => {
  it("serves stale-on-error for a 5xx and for a hung upstream", async () => {
    let mode: "ok" | "500" | "down" = "ok";
    const h = await start(() => {
      if (mode === "500")
        return { status: 500, headers: { "content-type": "text/html" }, body: Buffer.from("boom") };
      if (mode === "down") return Promise.reject(new Error("upstream timeout"));
      return html("good");
    });
    await h.get(TOPIC);
    h.clock.now += 100_000_000; // beyond even the max stale window
    mode = "500";
    const a = await h.get(TOPIC);
    expect([a.status, a.headers["x-cache"], a.body]).toEqual([200, "STALE-ERROR", "good"]);
    mode = "down";
    const b = await h.get(TOPIC);
    expect([b.status, b.headers["x-cache"]]).toEqual([200, "STALE-ERROR"]);
  });

  it("answers 503 + Retry-After with a clean page when nothing is cached and the upstream is down", async () => {
    const h = await start(() => Promise.reject(new Error("db down")));
    const reply = await h.get(TOPIC);
    expect(reply.status).toBe(503);
    expect(reply.headers["retry-after"]).toBe("30");
    expect(reply.headers["cache-control"]).toBe("no-store");
    expect(reply.body).toContain("Hệ thống đang bảo trì ngắn");
  });

  it("never caches 5xx and recovers when the upstream returns", async () => {
    let healthy = false;
    const h = await start(() =>
      healthy
        ? html("back")
        : { status: 500, headers: { "content-type": "text/html" }, body: Buffer.from("e") },
    );
    expect((await h.get(TOPIC)).status).toBe(503);
    healthy = true;
    const ok = await h.get(TOPIC);
    expect([ok.status, ok.headers["x-cache"]]).toEqual([200, "MISS"]);
  });

  it("negative-caches a legitimate 404 for 30 s", async () => {
    const h = await start(() => ({
      status: 404,
      headers: { "content-type": "text/html" },
      body: Buffer.from("nope"),
    }));
    expect((await h.get("/lop-6/khong-co")).status).toBe(404);
    const again = await h.get("/lop-6/khong-co");
    expect([again.status, again.headers["x-cache"]]).toEqual([404, "HIT"]);
    h.clock.now += 31_000;
    await h.get("/lop-6/khong-co");
    expect(h.calls).toHaveLength(2);
  });

  it("relays redirects without caching them", async () => {
    const h = await start(() => ({
      status: 308,
      headers: { location: "/new" },
      body: Buffer.alloc(0),
    }));
    const reply = await h.get("/old");
    expect([reply.status, reply.headers.location]).toEqual([308, "/new"]);
    await h.get("/old");
    expect(h.calls).toHaveLength(2);
  });

  it("sheds load with 503 Retry-After 5 only when no entry exists", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = await start(
      async (request) => {
        if (request.path === "/cached") return html("cached");
        await gate;
        return html("slow");
      },
      { maxConcurrentRenders: 1, maxRenderQueue: 0 },
    );
    await h.get("/cached");
    h.clock.now += 100_000_000;
    const busy = h.get("/slow-1");
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    const shed = await h.get("/slow-2");
    expect([shed.status, shed.headers["retry-after"]]).toEqual([503, "5"]);
    const stale = await h.get("/cached");
    expect([stale.status, stale.headers["x-cache"]]).toEqual([200, "STALE-ERROR"]);
    expect(h.edge.stats.shed).toBeGreaterThanOrEqual(2);
    release?.();
    expect((await busy).status).toBe(200);
  });

  it("queues renders up to the queue limit instead of shedding", async () => {
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const h = await start(
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => release.push(resolve));
        active--;
        return html("x");
      },
      { maxConcurrentRenders: 1, maxRenderQueue: 5 },
    );
    const all = Promise.all(["/a", "/b", "/c"].map((p) => h.get(p)));
    for (let i = 0; i < 3; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      release.shift()?.();
    }
    expect((await all).map((r) => r.status)).toEqual([200, 200, 200]);
    expect(peak).toBe(1);
  });
});

describe("purge and warmer", () => {
  const sitemap = `<?xml version="1.0"?><urlset><url><loc>https://beejunior.meducation.vn/a</loc></url><url><loc>https://beejunior.meducation.vn/b</loc></url></urlset>`;

  it("requires the internal token", async () => {
    const h = await start(() => html("x"));
    expect((await h.post("/_purge", { all: true })).status).toBe(401);
    expect((await h.post("/_purge", { all: true }, { authorization: "Bearer wrong" })).status).toBe(
      403,
    );
    const noToken = await start(() => html("x"), { token: undefined });
    expect(
      (await noToken.post("/_purge", { all: true }, { authorization: `Bearer ${TOKEN}` })).status,
    ).toBe(403);
    expect((await h.get("/_purge")).status).toBe(405);
  });

  it("validates the purge body", async () => {
    const h = await start(() => html("x"));
    const auth = { authorization: `Bearer ${TOKEN}` };
    expect((await h.post("/_purge", { paths: ["no-slash"] }, auth)).status).toBe(422);
    expect((await h.post("/_purge", { surprise: 1 }, auth)).status).toBe(422);
  });

  it("purges by path and prefix, tells Next to reload and warms the removed paths", async () => {
    const h = await start((request) =>
      request.path === "/internal/refresh"
        ? { status: 200, headers: {}, body: Buffer.from("{}") }
        : html(request.path),
    );
    for (const p of ["/a", "/b?x=1", "/lop-6/x", "/lop-6/y"]) await h.get(p);
    const auth = { authorization: `Bearer ${TOKEN}` };
    const reply = await h.post("/_purge", { paths: ["/a", "/b"], prefixes: ["/lop-6/"] }, auth);
    expect(JSON.parse(reply.body)).toEqual({ removed: 4, refreshed: true, warming: 4 });
    const refresh = h.calls.find((c) => c.path === "/internal/refresh");
    expect(refresh?.headers["x-internal-token"]).toBe(TOKEN);
    await waitUntil(() => h.edge.store.size === 4);
    expect(h.edge.store.size).toBe(4);
  });

  it("soft purge keeps the body and serves STALE until the warmer refreshes it", async () => {
    const h = await start((request) =>
      request.path === "/internal/refresh"
        ? { status: 200, headers: {}, body: Buffer.from("{}") }
        : html(request.path),
    );
    await h.get("/a");
    const result = await h.edge.purge({ paths: ["/a"], soft: true });
    expect(result.removed).toBe(1);
    expect(h.edge.store.size).toBe(1);
    await result.done;
    expect((await h.get("/a")).headers["x-cache"]).toBe("HIT");
  });

  it("purges everything and warms from the sitemap one request at a time", async () => {
    let active = 0;
    let peak = 0;
    const h = await start(async (request) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (request.path === "/sitemap.xml")
        return {
          status: 200,
          headers: { "content-type": "application/xml" },
          body: Buffer.from(sitemap),
        };
      if (request.path === "/internal/refresh")
        return { status: 200, headers: {}, body: Buffer.from("{}") };
      return html(request.path);
    });
    await h.get("/stale-one");
    const result = await h.edge.purge({ all: true });
    await result.done;
    expect(result.removed).toBe(1);
    expect(h.edge.store.keys().sort()).toEqual(["/a", "/b"]);
    expect(peak).toBe(1);
  });

  it("reports refreshed=false when Next cannot be reached, without failing the purge", async () => {
    const h = await start(
      (request) =>
        request.path === "/internal/refresh" ? Promise.reject(new Error("down")) : html("x"),
      { warmEnabled: false },
    );
    const result = await h.edge.purge({ paths: ["/a"] });
    expect(result).toMatchObject({ removed: 0, refreshed: false, warming: 0 });
  });

  it("survives a failing sitemap during warm-up", async () => {
    const h = await start(() => ({ status: 500, headers: {}, body: Buffer.alloc(0) }));
    expect(await h.edge.warm()).toEqual({ requested: 0, filled: 0, failed: 1 });
  });

  it("skips entries that are still fresh when warming a list", async () => {
    const h = await start(() => html("x"));
    await h.get("/a");
    const result = await h.edge.warm(["/a", "/b"]);
    expect(result).toEqual({ requested: 2, filled: 1, failed: 0 });
  });

  it("logs neither the token nor cookies", async () => {
    const h = await start(() => html("x"));
    await h.get(TOPIC, { cookie: "sid=top-secret" });
    await h.post("/_purge", { all: true }, { authorization: `Bearer ${TOKEN}` });
    const text = h.logs.join("");
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("top-secret");
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
