// THROWAWAY measurement prototype (not part of the repo): SSR test page reading from Postgres.
import { Pool } from "pg";
import { cache } from "react";
import { applyOptionOrder } from "@/lib/mixer";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 1_500,
  statement_timeout: 2_000,
  query_timeout: 2_500,
});
const TTL = Number(process.env.CACHE_TTL_MS ?? 0);
const STALE = Number(process.env.CACHE_STALE_MS ?? 600_000);

async function load(slug: string) {
  const t = await pool.query(
    `SELECT t.id, t.slug, t.grade, t.skill, t.kind, t.title, t.seed, t.published_at, tp.slug AS topic_slug
       FROM tests t LEFT JOIN topics tp ON tp.id = t.topic_id WHERE t.slug = $1 AND t.review_status = 'published'`, [slug]);
  if (!t.rowCount) return null;
  const test = t.rows[0];
  const items = await pool.query(
    `SELECT ti.option_order, q.external_id, q.stem, q.options, q.correct_key, q.explanation, ps.external_id AS passage_ext
       FROM test_items ti JOIN questions q ON q.id = ti.question_id AND q.review_status = 'published'
       LEFT JOIN passages ps ON ps.id = q.passage_id
      WHERE ti.test_id = $1 ORDER BY ti.position`, [test.id]);
  const passIds = [...new Set(items.rows.flatMap(r => (r.passage_ext ? [r.passage_ext] : [])))];
  const passages = passIds.length
    ? (await pool.query(`SELECT external_id AS id, title, body, word_count, level FROM passages WHERE external_id = ANY($1) AND review_status = 'published'`, [passIds])).rows
        .map(p => ({ id: p.id, title: p.title, body: p.body, wordCount: p.word_count, level: p.level }))
    : [];
  const sib = await pool.query(`SELECT slug, title FROM tests WHERE topic_id = (SELECT topic_id FROM tests WHERE id = $1) AND review_status = 'published' ORDER BY id`, [test.id]);
  const questions = items.rows.map(r => applyOptionOrder(
    { id: r.external_id, stem: r.stem, options: r.options, correctKey: r.correct_key, explanation: r.explanation, passageId: r.passage_ext ?? undefined } as never,
    r.option_order) as { id: string; stem: string; options: { key: string; text: string }[]; correctKey: string; explanation: string; passageId?: string });
  return { slug: test.slug as string, title: test.title as string, publishedAt: new Date(test.published_at).toISOString(), questions, passages, siblings: sib.rows as { slug: string; title: string }[] };
}

type Entry = { v: Awaited<ReturnType<typeof load>>; at: number; inflight?: Promise<void> };
const store = new Map<string, Entry>();
export const stats = { hit: 0, miss: 0, stale: 0, error: 0 };

async function refresh(slug: string, prev?: Entry) {
  const e: Entry = prev ?? { v: null, at: 0 };
  store.set(slug, e);
  e.inflight = load(slug).then(v => { e.v = v; e.at = Date.now(); }).finally(() => { e.inflight = undefined; });
  return e.inflight;
}

export const getTestSsr = cache(async (slug: string) => {
  if (TTL <= 0) return load(slug);
  const e = store.get(slug);
  const age = e ? Date.now() - e.at : Infinity;
  if (e && e.v && age < TTL) { stats.hit++; return e.v; }
  if (e && e.v && age < STALE) { // stale-while-revalidate, single flight, keep serving stale on error
    stats.stale++;
    if (!e.inflight) refresh(slug, e).catch(() => { stats.error++; });
    return e.v;
  }
  stats.miss++;
  if (e?.inflight) { await e.inflight; return store.get(slug)!.v; }
  await refresh(slug, e);
  return store.get(slug)!.v;
});
