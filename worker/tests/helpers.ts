import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import pg from "pg";
import type { Logger } from "../src/log";

export const ADMIN_URL: string | undefined = process.env["TEST_DATABASE_URL"];
export const silentLog: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const MIGRATIONS = fileURLToPath(new URL("../../db/migrations", import.meta.url));

export interface TestDb {
  url: string;
  /** Superuser pool (bypasses role checks). */
  admin: pg.Pool;
  /** Pool connected as a login role that is a member of bj_worker only. */
  worker: pg.Pool;
  remove(): Promise<void>;
}

const withDatabase = (url: string, database: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
};

/** Fresh migrated database with reference rows (one enabled VOA source, 'chung' topics per grade/skill). */
export async function createWorkerDb(): Promise<TestDb> {
  if (ADMIN_URL === undefined) throw new Error("TEST_DATABASE_URL is not set");
  const name = `bj_wtest_${randomBytes(6).toString("hex")}`;
  const control = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await control.query(`CREATE DATABASE ${name}`);
  await control.end();
  const url = withDatabase(ADMIN_URL, name);
  await runner({
    databaseUrl: url,
    dir: MIGRATIONS,
    direction: "up",
    count: Infinity,
    migrationsTable: "pgmigrations",
    checkOrder: true,
    singleTransaction: true,
    log: () => undefined,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });
  const admin = new pg.Pool({ connectionString: url, max: 3 });
  const login = `wlogin_${randomBytes(4).toString("hex")}`;
  await admin.query(`CREATE ROLE ${login} LOGIN PASSWORD 'pw' IN ROLE bj_worker`);
  await admin.query(
    `INSERT INTO sources (code, name, base_url, license, attribution, allowed_hosts, enabled)
     VALUES ('voa-learning-english', 'VOA Learning English', 'https://learningenglish.voanews.com',
             'Public domain', 'VOA', ARRAY['learningenglish.voanews.com'], true)`,
  );
  await admin.query(
    `INSERT INTO topics (grade, skill, slug, name)
     SELECT g, s, 'chung', 'Tong hop' FROM generate_series(6, 9) g,
            unnest(ARRAY['doc-hieu','ngu-phap','tu-vung','viet-cau']) s`,
  );
  const parsed = new URL(url);
  parsed.username = login;
  parsed.password = "pw";
  const worker = new pg.Pool({ connectionString: parsed.toString(), max: 5 });
  return {
    url,
    admin,
    worker,
    remove: async () => {
      await worker.end();
      await admin.end();
      const closer = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
      await closer.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await closer.query(`DROP ROLE IF EXISTS ${login}`);
      await closer.end();
    },
  };
}

export type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

/** Plain-http fake origin on 127.0.0.1; reached through SafeFetchOptions.testServer. */
export async function listen(handler: Handler): Promise<{ port: number; close(): Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}

const SENTENCES = [
  "She has finished the report before the long meeting started today.",
  "They have visited several museums during their holiday in the north.",
  "He is reading a very interesting book about ancient rivers now.",
  "We can improve our writing by practicing every single evening.",
  "The teacher explained that clean water helps communities stay healthy.",
  "Many students are learning new vocabulary from short stories each week.",
  "The farmers will plant more rice when the rainy season begins again.",
  "A careful reader often notices small details in simple paragraphs.",
];

/** Original synthetic VOA-shaped article (author JSON-LD, div.wsw body, glossary). */
export function voaArticleHtml(id: number, paragraphs = 8): string {
  const body = Array.from({ length: paragraphs }, (_, p) =>
    SENTENCES.map((_s, i) => SENTENCES[(i + p + id) % SENTENCES.length]).join(" "),
  )
    .map((t) => `<p>${t}</p>`)
    .join("\n");
  const words = ["improve", "community", "season", "detail", "explain"]
    .map((w) => `<p>${w} - to make or understand something better in a clear way</p>`)
    .join("\n");
  return `<!doctype html><html><head><title>Story ${String(id)}</title>
<script type="application/ld+json">${JSON.stringify({
    author: { name: "VOA Learning English" },
    datePublished: "2024-05-01T10:00:00Z",
  })}</script></head><body><h1>Synthetic story ${String(id)}</h1>
<div class="wsw">${body}<p>Words in This Story</p>${words}</div></body></html>`;
}

/** Fake learningenglish.voanews.com: robots, sitemap index with `count` articles, article pages. */
export function voaHandler(count: number, articleBytes = 8): Handler {
  const urls = Array.from(
    { length: count },
    (_, i) =>
      `https://learningenglish.voanews.com/a/story-${String(i + 1)}/${String(1000 + i)}.html`,
  );
  return (req, res) => {
    const path = req.url ?? "/";
    if (path === "/robots.txt") {
      res
        .writeHead(200, { "content-type": "text/plain" })
        .end("User-agent: *\nDisallow: /private\n");
    } else if (path === "/sitemap.xml") {
      res
        .writeHead(200, { "content-type": "application/xml" })
        .end(
          `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc><lastmod>2024-05-01</lastmod></url>`).join("")}</urlset>`,
        );
    } else {
      const match = /\/a\/[^/]+\/(\d+)\.html$/.exec(path);
      if (match?.[1] === undefined) res.writeHead(404).end("missing");
      else
        res
          .writeHead(200, { "content-type": "text/html; charset=utf-8" })
          .end(voaArticleHtml(Number(match[1]), articleBytes));
    }
  };
}

export const publicResolver = (): Promise<string[]> => Promise.resolve(["127.0.0.1"]);
