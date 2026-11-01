// Closed-loop HTTP load generator for the S-B acceptance numbers (blueprint §4.5).
//
//   node scripts/ssr/load.mjs --host IP --port 3100 --conc 50 --secs 20 [--sample 80] [--paths /a,/b] [--ua Googlebot]
//
// URLs come from <host>:<port>/sitemap.xml (test pages sampled deterministically) unless --paths is given.
// Keep-alive connections, identity encoding, round-robin over the URL list. Prints one JSON line:
// requests/s, status counts, TTFB and total latency percentiles, X-Cache distribution.
import http from "node:http";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    host: { type: "string" },
    port: { type: "string" },
    conc: { type: "string" },
    secs: { type: "string" },
    sample: { type: "string" },
    paths: { type: "string" },
    ua: { type: "string" },
    label: { type: "string" },
  },
});
const host = values.host ?? "127.0.0.1";
const port = Number(values.port ?? 3100);
const conc = Number(values.conc ?? 10);
const secs = Number(values.secs ?? 10);
const agent = new http.Agent({ keepAlive: true, maxSockets: conc });
const headers = {
  "accept-encoding": "identity",
  ...(values.ua ? { "user-agent": values.ua } : {}),
};

function request(path) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    let first = null;
    const req = http.get({ host, port, path, agent, headers }, (res) => {
      const chunks = [];
      res.once("data", () => {
        first = process.hrtime.bigint();
      });
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const t1 = process.hrtime.bigint();
        resolve({
          status: res.statusCode ?? 0,
          cache: res.headers["x-cache"] ?? "-",
          ttfb: Number((first ?? t1) - t0) / 1e6,
          total: Number(t1 - t0) / 1e6,
          bytes: Buffer.concat(chunks).length,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function pathList() {
  if (values.paths) return values.paths.split(",");
  const sitemap = (await request("/sitemap.xml")).body.toString("utf8");
  const all = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const tests = all.filter(
    (p) => /\/de-\d+$|\/thi-vao-lop-10\/[a-z0-9-]+$/.test(p) && p !== "/thi-vao-lop-10",
  );
  // Deterministic spread: every k-th test page, plus the list pages.
  const n = Number(values.sample ?? 80);
  const step = Math.max(1, Math.floor(tests.length / n));
  return tests.filter((_, i) => i % step === 0).slice(0, n);
}

const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null;
};
const paths = await pathList();
const ttfb = [];
const total = [];
const codes = {};
const caches = {};
let bytes = 0;
let errors = 0;
const end = Date.now() + secs * 1000;
const t0 = Date.now();
let n = 0;
await Promise.all(
  Array.from({ length: conc }, async () => {
    while (Date.now() < end) {
      try {
        const r = await request(paths[n++ % paths.length]);
        codes[r.status] = (codes[r.status] ?? 0) + 1;
        caches[r.cache] = (caches[r.cache] ?? 0) + 1;
        if (r.status === 200) {
          ttfb.push(r.ttfb);
          total.push(r.total);
          bytes += r.bytes;
        }
      } catch {
        errors++;
      }
    }
  }),
);
const dur = (Date.now() - t0) / 1000;
process.stdout.write(
  `${JSON.stringify({
    label: values.label ?? "",
    conc,
    urls: paths.length,
    secs: +dur.toFixed(1),
    rps: +(ttfb.length / dur).toFixed(1),
    codes,
    errors,
    cache: caches,
    avgKB: ttfb.length ? +(bytes / ttfb.length / 1024).toFixed(1) : 0,
    ttfb_ms: { p50: pct(ttfb, 0.5), p95: pct(ttfb, 0.95), p99: pct(ttfb, 0.99) },
    total_ms: { p50: pct(total, 0.5), p95: pct(total, 0.95), p99: pct(total, 0.99) },
  })}\n`,
);
agent.destroy();
