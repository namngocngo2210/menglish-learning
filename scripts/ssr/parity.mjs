// HTML equivalence between two running sites (sprint S-B acceptance: SSR from the database must render
// the same pages as the static build of main).
//
//   node scripts/ssr/parity.mjs --base http://HOST:PORT --head http://HOST:PORT [--out report.json] [--limit N]
//
// For every URL of <base>/sitemap.xml (and the pages the sitemap does not list) it compares:
//   1. the normalised HTML: build-specific asset hashes and build ids removed, everything else byte-equal;
//   2. a structured digest: title, meta description, canonical, robots, Open Graph, JSON-LD blocks,
//      headings, visible text, ordered internal links, number of questions.
// It also compares both sitemaps (URLs and lastmod) and the /pool/* JSON bodies. Exit code 1 on any difference.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string" },
    out: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string" },
  },
});
if (!values.base || !values.head)
  throw new Error("usage: parity.mjs --base URL --head URL [--out file] [--limit N]");
const base = values.base.replace(/\/$/, "");
const head = values.head.replace(/\/$/, "");
const concurrency = Number(values.concurrency ?? 4);

async function get(origin, path) {
  const res = await fetch(origin + path, {
    redirect: "manual",
    headers: { "accept-encoding": "identity" },
  });
  return {
    status: res.status,
    type: res.headers.get("content-type") ?? "",
    location: res.headers.get("location") ?? "",
    body: await res.text(),
  };
}

/** Removes only what legitimately differs between two builds of the same pages. */
export function normalize(html) {
  return html
    .replace(/\/_next\/static\/[A-Za-z0-9_\-./%~]+/g, "/_next/static/*")
    .replace(/static\/[A-Za-z0-9_\-./%~]+\.(js|css|woff2|map)/g, "static/*")
    .replace(/(?:\\)*"h(?:\\)*":\d+,/g, "")
    .replace(/(?:\\)*"S(?:\\)*":(?:true|false),/g, "")
    .replace(/"h":\d+,/g, "")
    .replace(/"b":"[^"]*"/g, '"b":"*"')
    .replace(/\\"b\\":\\"[^"\\]*\\"/g, '\\"b\\":\\"*\\"')
    .replace(/"buildId":"[^"]*"/g, '"buildId":"*"')
    .replace(/<link[^>]+rel="(preload|modulepreload|stylesheet)"[^>]*>/g, "")
    .replace(/<script[^>]+src="[^"]*"[^>]*><\/script>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const attr = (html, re) => (html.match(re) ?? [])[1] ?? "";
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

/** Structure that matters for users and search engines. */
export function digest(html) {
  const jsonLd = [
    ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.stringify(JSON.parse(m[1])));
  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
  return {
    title: decode(attr(html, /<title>([\s\S]*?)<\/title>/)),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    canonical: attr(html, /<link rel="canonical" href="([^"]*)"/),
    robots: attr(html, /<meta name="robots" content="([^"]*)"/),
    og: [...html.matchAll(/<meta property="og:([^"]+)" content="([^"]*)"/g)].map(
      (m) => `${m[1]}=${m[2]}`,
    ),
    jsonLd,
    headings: [...body.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)].map(
      (m) => `${m[1]}:${m[2].replace(/<[^>]+>/g, "")}`,
    ),
    links: [...body.matchAll(/<a [^>]*href="(\/[^"]*)"/g)].map((m) => m[1]),
    questions: (body.match(/<fieldset/g) ?? []).length,
    text: decode(body.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim(),
  };
}

function sitemapEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: new URL(attr(m[1], /<loc>([^<]*)<\/loc>/)).pathname,
    lastmod: attr(m[1], /<lastmod>([^<]*)<\/lastmod>/),
    changefreq: attr(m[1], /<changefreq>([^<]*)<\/changefreq>/),
    priority: attr(m[1], /<priority>([^<]*)<\/priority>/),
  }));
}

const report = {
  base,
  head,
  sitemap: {},
  pages: { compared: 0, identical: 0, structuralDiffs: [], htmlDiffs: [] },
  pools: { compared: 0, diffs: [] },
  extra: [],
};

const [baseMap, headMap] = await Promise.all([
  get(base, "/sitemap.xml"),
  get(head, "/sitemap.xml"),
]);
const baseEntries = sitemapEntries(baseMap.body);
const headEntries = sitemapEntries(headMap.body);
report.sitemap = {
  baseUrls: baseEntries.length,
  headUrls: headEntries.length,
  identical: JSON.stringify(baseEntries) === JSON.stringify(headEntries),
  onlyInBase: baseEntries
    .filter((e) => !headEntries.some((h) => h.loc === e.loc))
    .map((e) => e.loc),
  onlyInHead: headEntries
    .filter((e) => !baseEntries.some((b) => b.loc === e.loc))
    .map((e) => e.loc),
  attributeDiffs: baseEntries
    .filter((e) => {
      const h = headEntries.find((x) => x.loc === e.loc);
      return h && JSON.stringify(h) !== JSON.stringify(e);
    })
    .map((e) => e.loc),
};

const paths = baseEntries.map((e) => e.loc);
const extras = [
  "/",
  "/robots.txt",
  "/lop-5",
  "/lop-6/khong-co",
  "/lop-6/ngu-phap/khong-co/de-1",
  "/thi-vao-lop-10/khong-co",
];
const pools = [
  ...new Set(
    paths.filter((p) => /^\/lop-\d\/[a-z-]+\/[a-z0-9-]+$/.test(p)).map((p) => `/pool${p}`),
  ),
  "/pool/thi-vao-lop-10",
];
const limit = values.limit ? Number(values.limit) : Infinity;
const queue = [...new Set([...paths, ...extras])].slice(0, limit);

async function comparePage(path) {
  const [a, b] = await Promise.all([get(base, path), get(head, path)]);
  report.pages.compared++;
  if (a.status !== b.status || a.location !== b.location) {
    report.pages.structuralDiffs.push({
      path,
      status: [a.status, b.status],
      location: [a.location, b.location],
    });
    return;
  }
  if (!a.type.includes("html")) {
    if (a.body !== b.body) report.pages.htmlDiffs.push({ path, kind: "non-html body" });
    else report.pages.identical++;
    return;
  }
  const da = digest(a.body);
  const db = digest(b.body);
  const diffKeys = Object.keys(da).filter((k) => JSON.stringify(da[k]) !== JSON.stringify(db[k]));
  if (diffKeys.length) {
    report.pages.structuralDiffs.push({ path, keys: diffKeys });
    return;
  }
  const na = normalize(a.body);
  const nb = normalize(b.body);
  if (na !== nb) {
    let i = 0;
    while (i < na.length && na[i] === nb[i]) i++;
    report.pages.htmlDiffs.push({
      path,
      at: i,
      base: na.slice(Math.max(0, i - 60), i + 80),
      head: nb.slice(Math.max(0, i - 60), i + 80),
    });
  } else report.pages.identical++;
}

async function comparePool(path) {
  const [a, b] = await Promise.all([get(base, path), get(head, path)]);
  report.pools.compared++;
  if (a.status !== b.status || a.body !== b.body)
    report.pools.diffs.push({
      path,
      status: [a.status, b.status],
      bytes: [a.body.length, b.body.length],
    });
}

async function pool(items, fn) {
  const it = items[Symbol.iterator]();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let n = it.next(); !n.done; n = it.next()) await fn(n.value);
    }),
  );
}
await pool(queue, comparePage);
await pool(pools.slice(0, limit), comparePool);

const failures =
  report.pages.structuralDiffs.length +
  report.pages.htmlDiffs.length +
  report.pools.diffs.length +
  (report.sitemap.identical ? 0 : 1);
report.summary = {
  pages: report.pages.compared,
  identical: report.pages.identical,
  structuralDiffs: report.pages.structuralDiffs.length,
  htmlDiffs: report.pages.htmlDiffs.length,
  poolDiffs: report.pools.diffs.length,
  sitemapIdentical: report.sitemap.identical,
  failures,
};
if (values.out) writeFileSync(values.out, JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
if (failures) {
  process.stdout.write(
    `${JSON.stringify({ sitemap: report.sitemap, firstStructural: report.pages.structuralDiffs.slice(0, 3), firstHtml: report.pages.htmlDiffs.slice(0, 3), firstPool: report.pools.diffs.slice(0, 3) }, null, 1)}\n`,
  );
  process.exit(1);
}
