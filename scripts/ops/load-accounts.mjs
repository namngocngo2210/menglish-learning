// Closed-loop load against the parent-account login path (argon2id is the memory hot spot), S-U4.
//   node load-accounts.mjs <host> <port> <secs> <conc> [mix]
// Sends POST /api/v1/account/login with wrong passwords (unknown emails -> dummy hash; both cost one hash) and
// plain GET /healthz probes in parallel so the effect of hashing on ordinary traffic is visible. Never sends
// real credentials. Prints one JSON line: status histogram and latency percentiles for each kind.
import http from "node:http";
import { performance } from "node:perf_hooks";

const [host, port, secs = "30", conc = "32"] = process.argv.slice(2);
const origin = process.env.LOAD_ORIGIN ?? "https://beejunior.meducation.vn";
const deadline = performance.now() + Number(secs) * 1000;
const stats = { login: { codes: {}, ms: [] }, health: { codes: {}, ms: [] } };
let seq = 0;

const send = (kind, method, path, body, headers = {}) =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const req = http.request(
      {
        host,
        port,
        method,
        path,
        headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          const s = stats[kind];
          s.codes[res.statusCode] = (s.codes[res.statusCode] ?? 0) + 1;
          s.ms.push(performance.now() - t0);
          resolve();
        });
      },
    );
    req.on("error", () => {
      stats[kind].codes.error = (stats[kind].codes.error ?? 0) + 1;
      resolve();
    });
    req.end(body);
  });

const loginWorker = async () => {
  while (performance.now() < deadline) {
    const i = ++seq;
    // Distinct address and forwarded IP per request so the 429s measured are the argon2 gate, not the per-IP limiter.
    await send(
      "login",
      "POST",
      "/api/v1/account/login",
      JSON.stringify({ email: `load${i}@example.test`, password: "wrong-password-123" }),
      {
        origin,
        "x-forwarded-for": `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`,
      },
    );
  }
};
const healthWorker = async () => {
  while (performance.now() < deadline) {
    await send("health", "GET", "/healthz");
    await new Promise((r) => setTimeout(r, 100));
  }
};

await Promise.all([...Array.from({ length: Number(conc) }, loginWorker), healthWorker()]);
const pct = (a, p) =>
  a.length
    ? Math.round(
        [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))],
      )
    : null;
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(stats).map(([k, v]) => [
        k,
        {
          codes: v.codes,
          n: v.ms.length,
          p50: pct(v.ms, 50),
          p95: pct(v.ms, 95),
          max: pct(v.ms, 100),
        },
      ]),
    ),
  ),
);
