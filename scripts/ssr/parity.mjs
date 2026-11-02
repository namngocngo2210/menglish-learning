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
//
// URL migration check (2/11): run with `npx tsx scripts/ssr/parity.mjs --migrate --base <OLD build> --head <NEW build>`.
// Every base path is mapped old -> new with legacyToPublicPath (packages/core/src/url-map.ts) and every old URL inside
// the base HTML/JSON is rewritten the same way, so only the URLs may differ; anything else is reported.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string" },
    out: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string" },
    migrate: { type: "boolean" },
  },
});
if (!values.base || !values.head)
  throw new Error("usage: parity.mjs --base URL --head URL [--out file] [--limit N]");
const base = values.base.replace(/\/$/, "");
const head = values.head.replace(/\/$/, "");
const concurrency = Number(values.concurrency ?? 4);

let mapPath = (p) => p;
let rewrite = (text) => text;
if (values.migrate) {
  const { legacyToPublicPath } = await import("../../packages/core/src/url-map.ts");
  mapPath = (p) => legacyToPublicPath(p) ?? p;
  const names =
    "lop-[6-9]|thi-vao-lop-10|luyen-nhanh|luyen-tap-nhom|gioi-thieu|lien-he|chinh-sach-bao-mat|dieu-khoan|nguon-du-lieu|xoa-du-lieu|dang-ky|dang-nhap|dat-lai-mat-khau|xac-minh-email|tai-khoan";
  const inPath = new RegExp(`/(?:${names})(?:/[A-Za-z0-9-]+)*`, "g");
  const inQuery = new RegExp(`de=((?:${names})(?:/[A-Za-z0-9-]+)*)`, "g");
  rewrite = (text) =>
    text
      .replace(inPath, (m) => legacyToPublicPath(m) ?? m)
      .replace(inQuery, (m, p) => `de=${(legacyToPublicPath(`/${p}`) ?? `/${p}`).slice(1)}`);
}

async function get(origin, path) {
  const res = await fetch(origin + path, {
    redirect: "manual",
    headers: { "accept-encoding": "identity" },
  });
  return {
    status: res.status,
    type: res.headers.get("content-type") ?? "",
    location:
      origin === base
        ? rewrite(res.headers.get("location") ?? "")
        : (res.headers.get("location") ?? ""),
    body: origin === base && path !== "/sitemap.xml" ? rewrite(await res.text()) : await res.text(),
  };
}

/** Removes only what legitimately differs between two builds of the same pages. */
export function normalize(rawHtml) {
  // --migrate: the inline RSC flight scripts embed build-internal ids and route-tree keys that change with the URL rename;
  // the rendered HTML, JSON-LD (checked by digest()) and visible text are what must stay equal.
  const html = values.migrate
    ? rawHtml.replace(/<script>self\.__next_f[\s\S]*?<\/script>/g, "")
    : rawHtml;
  return (
    html
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
      // RSC flight rows are numbered per build (an extra client module shifts every id): drop ids and $L references.
      .replace(/(?:\\)*n[0-9a-f]{1,3}:(?=[A-Z[{"$])/g, "n*:")
      .replace(/\$L[0-9a-f]{1,3}\b/g, "$L*")
      // Route-tree segment keys are the URL segment itself (renamed by design).
      .replace(/s(\\+)":\1"[^"\\]*\1"/g, 's$1":$1"*$1"')
      .replace(/c(\\+)":\[[^\]]*\]/g, 'c$1":[*]')
      .replace(/\s+/g, " ")
      .trim()
  );
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
const byLoc = (a, b) => (a.loc < b.loc ? -1 : 1);
// Base is queried with the old path (the reverse of mapPath), head with the new one.
const oldOf = new Map();
const rawBase = sitemapEntries(baseMap.body);
for (const e of rawBase) oldOf.set(mapPath(e.loc), e.loc);
const baseEntries = rawBase.map((e) => ({ ...e, loc: mapPath(e.loc) }));
const headEntries = sitemapEntries(headMap.body);
if (values.migrate) {
  baseEntries.sort(byLoc);
  headEntries.sort(byLoc);
}
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

const paths = baseEntries.map((e) => e.loc); // already new paths in --migrate mode
const oldExtras = [
  "/",
  "/robots.txt",
  "/lop-5",
  "/lop-6/khong-co",
  "/lop-6/ngu-phap/khong-co/de-1",
  "/thi-vao-lop-10/khong-co",
];
const extras = oldExtras.map((p) => {
  oldOf.set(mapPath(p), p);
  return mapPath(p);
});
const oldPools = [
  ...new Set(
    rawBase
      .map((e) => e.loc)
      .filter((p) => /^\/lop-\d\/[a-z-]+\/[a-z0-9-]+$/.test(p))
      .map((p) => `/pool${p}`),
  ),
  "/pool/thi-vao-lop-10",
];
const pools = oldPools.map((p) => {
  oldOf.set(mapPath(p), p);
  return mapPath(p);
});
const limit = values.limit ? Number(values.limit) : Infinity;
const queue = [...new Set([...paths, ...extras])].slice(0, limit);

async function comparePage(path) {
  const [a, b] = await Promise.all([get(base, oldOf.get(path) ?? path), get(head, path)]);
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
  const [a, b] = await Promise.all([get(base, oldOf.get(path) ?? path), get(head, path)]);
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
