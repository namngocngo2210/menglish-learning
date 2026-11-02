// One-shot HTTP probe for the chaos script (runs inside the bench network).
//   node probe.mjs HOST PORT PATH [UA]                     -> "<status> <x-cache> <retry-after> <ms>"
//   node probe.mjs HOST PORT --purge '<json>' TOKEN_FILE    -> "<status> <body>"
import http from "node:http";
import { readFileSync } from "node:fs";

const [host, port, a, b, c] = process.argv.slice(2);
const t0 = performance.now();

if (a === "--tests") {
  // two test-page paths from the sitemap, used by chaos.sh
  http
    .get({ host, port, path: "/sitemap.xml" }, (res) => {
      let xml = "";
      res.on("data", (d) => (xml += d));
      res.on("end", () =>
        console.log(
          [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
            .map((m) => new URL(m[1]).pathname)
            .filter((p) => /\/test-\d+$/.test(p))
            .slice(0, 2)
            .join(" "),
        ),
      );
    })
    .on("error", (e) => {
      console.log("ERR", e.message);
      process.exit(1);
    });
} else if (a === "--purge") {
  const req = http.request(
    {
      host,
      port,
      path: "/_purge",
      method: "POST",
      headers: {
        authorization: `Bearer ${readFileSync(c, "utf8").trim()}`,
        "content-type": "application/json",
      },
    },
    (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => console.log(res.statusCode, body));
    },
  );
  req.on("error", (e) => {
    console.log("ERR", e.message);
    process.exit(1);
  });
  req.end(b);
} else {
  const headers = { "accept-encoding": "identity", ...(b ? { "user-agent": b } : {}) };
  http
    .get({ host, port, path: a, headers, timeout: 15000 }, (res) => {
      res.resume();
      res.on("end", () =>
        console.log(
          res.statusCode,
          res.headers["x-cache"] ?? "-",
          res.headers["retry-after"] ?? "-",
          Math.round(performance.now() - t0),
        ),
      );
    })
    .on("error", (e) => {
      console.log("ERR", e.message);
      process.exit(1);
    });
}
