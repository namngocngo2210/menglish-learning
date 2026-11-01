import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { z } from "zod";
import { LruStore } from "./cache";
import type { Entry } from "./cache";
import type { EdgeConfig } from "./config";
import type { Logger } from "./logger";
import { NOT_FOUND_POLICY, cacheKey, isCacheableType, policyFor } from "./policy";
import type { FetchUpstream, UpstreamResponse } from "./upstream";

const MAINTENANCE_HTML =
  '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
  "<title>BeeJunior - tạm thời không khả dụng</title></head><body><h1>Hệ thống đang bảo trì ngắn</h1>" +
  "<p>Vui lòng thử lại sau ít phút.</p></body></html>";

const PURGE_MAX_BODY = 64 * 1024;
const PASS_MAX_BODY = 1024 * 1024;
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
/** Hop-by-hop and cookie headers are never copied between upstream and client. */
const DROP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "set-cookie",
  "content-length",
]);

const PurgeBodySchema = z.strictObject({
  paths: z.array(z.string().max(512).startsWith("/")).max(500).optional(),
  prefixes: z.array(z.string().max(512).startsWith("/")).max(500).optional(),
  all: z.boolean().optional(),
  /** Mark matches stale instead of deleting them: crawlers get STALE (never a cold MISS) while the warmer re-renders. */
  soft: z.boolean().optional(),
});

export interface EdgeStats {
  hit: number;
  stale: number;
  miss: number;
  staleError: number;
  shed: number;
  unavailable: number;
  passthrough: number;
}

export interface PurgeResult {
  removed: number;
  refreshed: boolean;
  warming: number;
  /** Resolves when the background warm-up that follows the purge has finished (used by tests). */
  done: Promise<void>;
}

export interface WarmResult {
  requested: number;
  filled: number;
  failed: number;
}

export interface EdgeOptions {
  config: EdgeConfig;
  fetchUpstream: FetchUpstream;
  logger: Logger;
  now?: () => number;
  /** Pause between warmer requests. Default 25 ms. */
  sleep?: (ms: number) => Promise<void>;
}

export interface Edge {
  server: http.Server;
  store: LruStore;
  stats: EdgeStats;
  purge(input: z.infer<typeof PurgeBodySchema>): Promise<PurgeResult>;
  warm(paths?: readonly string[]): Promise<WarmResult>;
  close(): Promise<void>;
}

class ShedError extends Error {}
class UpstreamFailure extends Error {}

type FillResult = { entry: Entry } | { raw: UpstreamResponse };

/** Counting semaphore with a bounded wait queue: the load-shedding limit of blueprint §4.4. */
class RenderGate {
  private active = 0;
  private readonly waiters: (() => void)[] = [];
  constructor(
    private readonly limit: number,
    private readonly queueMax: number,
  ) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
    } else if (this.waiters.length < this.queueMax) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      throw new ShedError("render queue full");
    }
    return () => {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    };
  }
}

function safeEqual(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function readBody(req: http.IncomingMessage, limit: number): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        resolve(undefined);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

export function createEdge(options: EdgeOptions): Edge {
  const { config, fetchUpstream, logger } = options;
  const now = options.now ?? (() => Date.now());
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const store = new LruStore(config.maxBytes);
  const gate = new RenderGate(config.maxConcurrentRenders, config.maxRenderQueue);
  const inflight = new Map<string, Promise<FillResult>>();
  const stats: EdgeStats = {
    hit: 0,
    stale: 0,
    miss: 0,
    staleError: 0,
    shed: 0,
    unavailable: 0,
    passthrough: 0,
  };
  let warming: Promise<WarmResult> | undefined;

  const upstreamHeaders = (req: http.IncomingMessage): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const name of ["host", "x-forwarded-proto", "x-forwarded-host", "x-forwarded-for"]) {
      const value = req.headers[name];
      if (typeof value === "string") out[name] = value;
    }
    return out;
  };

  async function runFill(key: string, headers: Record<string, string>): Promise<FillResult> {
    const release = await gate.acquire();
    let res: UpstreamResponse;
    try {
      res = await fetchUpstream({ method: "GET", path: key, headers });
    } finally {
      release();
    }
    if (res.status >= 500) throw new UpstreamFailure(`upstream ${String(res.status)}`);
    const contentType = res.headers["content-type"];
    const { path } = cacheKey(key);
    const cacheable = isCacheableType(contentType);
    if (cacheable && (res.status === 200 || res.status === 404)) {
      const policy = res.status === 200 ? policyFor(path) : NOT_FOUND_POLICY;
      const at = now();
      const entry: Entry = {
        status: res.status,
        contentType: contentType ?? "text/html; charset=utf-8",
        body: res.body,
        etag: `W/"${createHash("sha1").update(res.body).digest("hex").slice(0, 20)}"`,
        lastModified: new Date(at).toUTCString(),
        at,
        ttl: policy.ttl,
        stale: policy.stale,
      };
      store.set(key, entry);
      return { entry };
    }
    return { raw: res };
  }

  /** Single flight per key: concurrent callers share one upstream request. */
  function fill(key: string, headers: Record<string, string>): Promise<FillResult> {
    const existing = inflight.get(key);
    if (existing) return existing;
    const promise = runFill(key, headers).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, promise);
    return promise;
  }

  function sendEntry(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    entry: Entry,
    tag: string,
  ): void {
    const cacheControl =
      entry.status === 200
        ? `public, max-age=0, s-maxage=${String(entry.ttl)}, stale-while-revalidate=${String(entry.stale)}`
        : `public, max-age=0, s-maxage=${String(entry.ttl)}`;
    const headers: Record<string, string> = {
      "content-type": entry.contentType,
      "cache-control": cacheControl,
      etag: entry.etag,
      "last-modified": entry.lastModified,
      "x-cache": tag,
    };
    const inm = req.headers["if-none-match"];
    const ims = req.headers["if-modified-since"];
    const notModified =
      entry.status === 200 &&
      ((typeof inm === "string" && inm.split(",").some((v) => v.trim() === entry.etag)) ||
        (typeof inm !== "string" &&
          typeof ims === "string" &&
          Date.parse(ims) >= Math.floor(entry.at / 1000) * 1000));
    if (notModified) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(entry.status, { ...headers, "content-length": String(entry.body.length) });
    res.end(req.method === "HEAD" ? undefined : entry.body);
  }

  function sendUnavailable(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    retryAfter: number,
  ): void {
    res.writeHead(503, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(retryAfter),
      "x-cache": "ERROR",
    });
    res.end(req.method === "HEAD" ? undefined : MAINTENANCE_HTML);
  }

  function sendRaw(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    raw: UpstreamResponse,
  ): void {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw.headers)) {
      if (!DROP_RESPONSE_HEADERS.has(name)) headers[name] = value;
    }
    headers["content-length"] = String(raw.body.length);
    res.writeHead(raw.status, headers);
    res.end(req.method === "HEAD" ? undefined : raw.body);
  }

  async function passThrough(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    path: string,
  ): Promise<void> {
    stats.passthrough++;
    const method = req.method ?? "GET";
    const body =
      method === "GET" || method === "HEAD" ? undefined : await readBody(req, PASS_MAX_BODY);
    if (body === undefined && method !== "GET" && method !== "HEAD") {
      res.writeHead(413, { "content-type": "text/plain" });
      res.end("payload too large");
      return;
    }
    const headers = upstreamHeaders(req);
    const type = req.headers["content-type"];
    if (typeof type === "string") headers["content-type"] = type;
    try {
      const raw = await fetchUpstream({ method, path, headers, ...(body ? { body } : {}) });
      sendRaw(req, res, raw);
    } catch {
      sendUnavailable(req, res, 30);
    }
  }

  async function handlePurge(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const json = (status: number, payload: unknown): void => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    if (req.method !== "POST") {
      json(405, { error: "method_not_allowed" });
      return;
    }
    const auth = req.headers.authorization;
    if (auth === undefined) {
      json(401, { error: "unauthenticated" });
      return;
    }
    if (
      config.token === undefined ||
      !auth.startsWith("Bearer ") ||
      !safeEqual(auth.slice(7), config.token)
    ) {
      json(403, { error: "forbidden" });
      return;
    }
    const raw = await readBody(req, PURGE_MAX_BODY);
    if (raw === undefined) {
      json(413, { error: "payload_too_large" });
      return;
    }
    let parsed: z.infer<typeof PurgeBodySchema>;
    try {
      parsed = PurgeBodySchema.parse(JSON.parse(raw.toString("utf8")));
    } catch {
      json(422, { error: "validation_failed" });
      return;
    }
    const result = await purge(parsed);
    json(200, { removed: result.removed, refreshed: result.refreshed, warming: result.warming });
    return;
  }

  async function purge(input: z.infer<typeof PurgeBodySchema>): Promise<PurgeResult> {
    const exact = new Set(input.paths ?? []);
    const prefixes = input.prefixes ?? [];
    const removedPaths = new Set<string>();
    let removed = 0;
    const drop = (key: string): void => {
      const entry = store.get(key);
      if (input.soft === true && entry) entry.at = now() - entry.ttl * 1000 - 1;
      else store.delete(key);
    };
    for (const key of store.keys()) {
      const { path } = cacheKey(key);
      if (input.all === true || exact.has(path) || prefixes.some((p) => path.startsWith(p))) {
        drop(key);
        removedPaths.add(path);
        removed++;
      }
    }
    let refreshed = false;
    if (config.token !== undefined) {
      try {
        const res = await fetchUpstream({
          method: "POST",
          path: "/internal/refresh",
          headers: { "x-internal-token": config.token },
        });
        refreshed = res.status === 200;
      } catch {
        refreshed = false;
      }
    }
    logger.info("purge", { removed, refreshed });
    const toWarm = config.warmEnabled ? (input.all === true ? undefined : [...removedPaths]) : [];
    const done =
      toWarm === undefined
        ? warm().then(() => undefined)
        : toWarm.length > 0
          ? warm(toWarm).then(() => undefined)
          : Promise.resolve();
    done.catch(() => undefined);
    return {
      removed,
      refreshed,
      warming: toWarm === undefined ? removedPaths.size : toWarm.length,
      done,
    };
  }

  async function sitemapPaths(): Promise<string[]> {
    const res = await fetchUpstream({ method: "GET", path: "/sitemap.xml", headers: {} });
    if (res.status !== 200) throw new UpstreamFailure(`sitemap ${String(res.status)}`);
    const paths: string[] = [];
    for (const match of res.body.toString("utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const loc = match[1];
      if (loc === undefined) continue;
      try {
        paths.push(new URL(loc).pathname);
      } catch {
        // ignore malformed <loc>
      }
    }
    return paths;
  }

  function warm(paths?: readonly string[]): Promise<WarmResult> {
    if (warming) return warming;
    const run = (async (): Promise<WarmResult> => {
      let list: readonly string[];
      try {
        list = paths ?? (await sitemapPaths());
      } catch (error) {
        logger.warn("warm_failed", { reason: error instanceof Error ? error.message : "unknown" });
        return { requested: 0, filled: 0, failed: 1 };
      }
      let filled = 0;
      let failed = 0;
      for (const path of list) {
        const { key } = cacheKey(path);
        const current = store.get(key);
        if (current && now() - current.at < current.ttl * 1000) continue;
        try {
          await fill(key, {});
          filled++;
        } catch {
          failed++;
        }
        await sleep(25);
      }
      logger.info("warm", { requested: list.length, filled, failed });
      return { requested: list.length, filled, failed };
    })().finally(() => {
      warming = undefined;
    });
    warming = run;
    return run;
  }

  async function handleCached(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    key: string,
  ): Promise<void> {
    const entry = store.get(key);
    const age = entry ? now() - entry.at : Infinity;
    const ttlMs = entry ? entry.ttl * 1000 : 0;
    const staleMs = entry ? entry.stale * 1000 : 0;
    if (entry && age < ttlMs) {
      stats.hit++;
      sendEntry(req, res, entry, "HIT");
      return;
    }
    const headers = upstreamHeaders(req);
    if (entry && age < ttlMs + staleMs) {
      stats.stale++;
      fill(key, headers).catch(() => undefined);
      sendEntry(req, res, entry, "STALE");
      return;
    }
    try {
      const result = await fill(key, headers);
      stats.miss++;
      if ("entry" in result) {
        sendEntry(req, res, result.entry, "MISS");
        return;
      }
      sendRaw(req, res, result.raw);
      return;
    } catch (error) {
      if (error instanceof ShedError) {
        stats.shed++;
        logger.warn("shed", { path: key });
      } else {
        logger.warn("upstream_error", {
          path: key,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
      if (entry) {
        stats.staleError++;
        sendEntry(req, res, entry, "STALE-ERROR");
        return;
      }
      stats.unavailable++;
      sendUnavailable(req, res, error instanceof ShedError ? 5 : 30);
      return;
    }
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const given = req.headers["x-request-id"];
    res.setHeader(
      "x-request-id",
      typeof given === "string" && REQUEST_ID.test(given) ? given : randomUUID(),
    );
    const method = req.method ?? "GET";
    const { path, key } = cacheKey(req.url ?? "/");
    if (path === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("ok");
      return;
    }
    if (path === "/_purge") return handlePurge(req, res);
    if (path.startsWith("/internal/") || path === "/internal") {
      res.writeHead(404, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("not found");
      return;
    }
    const bypass = path.startsWith("/_next/") || path.startsWith("/api/") || path === "/readyz";
    if (bypass || (method !== "GET" && method !== "HEAD"))
      return passThrough(req, res, req.url ?? "/");
    return handleCached(req, res, key);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      logger.warn("handler_error", { reason: error instanceof Error ? error.message : "unknown" });
      if (!res.headersSent) sendUnavailable(req, res, 30);
      else res.end();
    });
  });

  return {
    server,
    store,
    stats,
    purge,
    warm,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}
