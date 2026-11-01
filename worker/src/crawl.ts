import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  HttpClient,
  allowedGovUrl,
  articleUrl,
  assemble,
  corpusStats,
  crawlGov,
  crawlVoa,
  extractPdf,
  govItems,
  grammarItems,
  hasTextLayer,
  parseVoa,
  readCache,
  readingItems,
  vocabularyItems,
  wordOrderItems,
  type GovSeed,
  type Meta,
} from "@crawler";
import type pg from "pg";
import { z } from "zod";
import type { Article, Candidate } from "../../crawler/src/model";
import type { WorkerConfig } from "./config";
import type { Logger } from "./log";
import { persistBundles } from "./persist";
import { heartbeat as beat, type Counters, type Job } from "./queue";
import { guardedFetch, matchesAllowlist, type SafeFetchOptions } from "./ssrf";

/** Raised for failures that retrying cannot fix (disabled source, bad params). */
export class JobRefused extends Error {
  constructor(
    readonly kind: string,
    message: string,
  ) {
    super(message);
  }
}

export interface RunDeps {
  pool: pg.Pool;
  cfg: Pick<WorkerConfig, "crawlDataDir" | "heartbeatMs">;
  log: Logger;
  workerId: string;
  /** Test hooks only (resolver, unsafeTestMode, limits). */
  fetchOptions?: Partial<SafeFetchOptions>;
  /** Test hook: minimum gap between requests to one host; production keeps the crawler default (1 s). */
  gapMs?: number;
}

const VOA_CODE = "voa-learning-english";
const ParamsSchema = z.looseObject({
  limit: z.number().int().min(1).max(100).default(20),
  seeds: z
    .array(z.looseObject({ url: z.string() }))
    .max(20)
    .default([]),
});

interface SourceRow {
  id: string;
  code: string;
  allowed_hosts: string[];
  enabled: boolean;
}

async function cachedMetas(dir: string): Promise<Meta[]> {
  const out: Meta[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith(".meta.json"))
      out.push(JSON.parse(await readFile(join(entry.parentPath, entry.name), "utf8")) as Meta);
  }
  return out.sort((a, b) => a.url.localeCompare(b.url));
}

/** Fetches through the SSRF guard into a throwaway directory, builds candidates and stores quarantine rows. */
export async function runCrawlJob(deps: RunDeps, job: Job): Promise<Counters> {
  const { pool, cfg, log } = deps;
  const src = (
    await pool.query<SourceRow>(
      "SELECT id::text, code, allowed_hosts, enabled FROM sources WHERE id = $1",
      [job.sourceId],
    )
  ).rows[0];
  if (!src?.enabled) throw new JobRefused("source_disabled", "source is missing or disabled");
  const params = ParamsSchema.safeParse(job.params);
  if (!params.success) throw new JobRefused("bad_params", "invalid job params");
  const isVoa = src.code === VOA_CODE;
  if (!isVoa && !src.code.startsWith("gov-"))
    throw new JobRefused("unsupported_source", "no crawler for this source");

  await mkdir(cfg.crawlDataDir, { recursive: true });
  const dir = await mkdtemp(join(cfg.crawlDataDir, `job-${job.id}-`));
  const state = { lost: false };
  const timer = setInterval(() => {
    void beat(pool, job.id, deps.workerId).then((ok) => {
      if (!ok) state.lost = true;
    });
  }, cfg.heartbeatMs);
  const errors: { url: string; message: string }[] = [];
  const onError = (url: string, error: unknown): void => {
    errors.push({ url, message: error instanceof Error ? error.message : String(error) });
  };
  try {
    const hostOk = (host: string): boolean => matchesAllowlist(host, src.allowed_hosts);
    const client = new HttpClient(
      dir,
      true,
      hostOk,
      guardedFetch({
        allowedHosts: src.allowed_hosts,
        maxBytes: 25 * 1024 * 1024,
        headers: { "user-agent": "MEnglishLearningBot/0.1" },
        ...deps.fetchOptions,
      }),
      deps.gapMs,
    );
    const candidates: Candidate[] = [];
    let corpus = corpusStats([]);
    const parsedUrls = new Set<string>();
    if (isVoa) {
      await crawlVoa(client, params.data.limit, onError);
      if (state.lost) throw new Error("job lost (cancelled or reaped)");
      const articles: Article[] = [];
      for (const meta of await cachedMetas(dir)) {
        if (meta.status !== 200 || !articleUrl(meta.url)) continue;
        const cached = await readCache(dir, meta.url);
        const article = cached ? parseVoa(cached.body.toString(), meta.url, meta.fetchedAt) : null;
        if (article) {
          articles.push(article);
          parsedUrls.add(meta.url);
        }
      }
      corpus = corpusStats(articles.map((a) => a.paragraphs.join("\n")));
      for (const a of articles)
        for (const build of [grammarItems, readingItems, vocabularyItems, wordOrderItems])
          candidates.push(...build(a, corpus));
    } else {
      const seeds = (params.data.seeds as unknown as GovSeed[]).filter(
        (s) => allowedGovUrl(s.url) && hostOk(new URL(s.url).hostname),
      );
      await crawlGov(client, seeds, onError);
      for (const seed of seeds) {
        const doc = await readCache(dir, seed.url);
        const key = seed.answerKeyUrl ? await readCache(dir, seed.answerKeyUrl) : doc;
        if (doc?.meta.status !== 200 || key?.meta.status !== 200) continue;
        let text: string;
        let keyText: string;
        try {
          text = await extractPdf(doc.body);
          keyText = key === doc ? text : await extractPdf(key.body);
        } catch (error) {
          onError(seed.url, error);
          continue;
        }
        if (!hasTextLayer(text) || !hasTextLayer(keyText)) {
          onError(seed.url, new Error("scanned PDF without text layer: use import-ocr"));
          continue;
        }
        parsedUrls.add(seed.url);
        candidates.push(...govItems(text, keyText, seed, doc.meta.fetchedAt));
      }
    }
    if (state.lost) throw new Error("job lost (cancelled or reaped)");
    const bank = assemble(candidates, corpus);
    const stored = await persistBundles(
      pool,
      bank.bundles.map((b) => b.bundle),
    );

    const metas = await cachedMetas(dir);
    for (const m of metas.filter((x) => !x.url.endsWith("/robots.txt")))
      await pool.query(
        `INSERT INTO raw_documents (source_id, url, content_hash, storage_path, status, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO UPDATE SET content_hash = EXCLUDED.content_hash, status = EXCLUDED.status,
                                         fetched_at = EXCLUDED.fetched_at, storage_path = EXCLUDED.storage_path`,
        [
          src.id,
          m.url,
          m.contentHash,
          `ephemeral:job-${job.id}`,
          m.status !== 200 ? "failed" : parsedUrls.has(m.url) ? "parsed" : "fetched",
          m.fetchedAt,
        ],
      );
    for (const e of errors.slice(0, 200))
      await pool.query(
        "INSERT INTO crawl_errors (crawl_job_id, url, kind, message) VALUES ($1, $2, 'fetch', $3)",
        [job.id, e.url, e.message.slice(0, 500)],
      );
    log.info("crawl_done", {
      job: job.id,
      fetched: metas.length,
      quarantined: stored.inserted,
      errors: errors.length,
    });
    return { fetched: metas.length, quarantined: stored.inserted, errors: errors.length };
  } finally {
    clearInterval(timer);
    await rm(dir, { recursive: true, force: true });
  }
}
