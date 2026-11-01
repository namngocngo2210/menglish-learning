import { parseSourceRef } from "@bj/core";
import type pg from "pg";
import type { Bundle } from "../../crawler/src/model";

export interface PersistResult {
  inserted: number;
  skipped: Record<string, number>;
}

const bump = (map: Record<string, number>, key: string): void => {
  map[key] = (map[key] ?? 0) + 1;
};

/**
 * Writes crawled passages/questions as QUARANTINE rows, one transaction. Idempotent: rows are keyed by
 * external_id and ON CONFLICT DO NOTHING, so a re-crawl inserts nothing. The worker role cannot write
 * any other status (trigger bj_guard_publish) and has no UPDATE/DELETE on content tables.
 * Sources and topics are never created here: only existing, enabled sources are accepted.
 */
export async function persistBundles(
  pool: pg.Pool,
  bundles: readonly Bundle[],
): Promise<PersistResult> {
  const result: PersistResult = { inserted: 0, skipped: {} };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sources = new Map<string, string>();
    for (const r of (
      await client.query<{ id: string; code: string }>(
        "SELECT id::text, code FROM sources WHERE enabled",
      )
    ).rows)
      sources.set(r.code, r.id);
    const topics = new Map<string, string>();
    for (const r of (
      await client.query<{ id: string; k: string }>(
        "SELECT id::text, grade || '|' || skill || '|' || slug AS k FROM topics",
      )
    ).rows)
      topics.set(r.k, r.id);

    const passageIds = new Map<string, string>();
    for (const bundle of bundles)
      for (const p of bundle.passages) {
        const sourceId = sources.get(p.sourceId);
        if (sourceId === undefined) continue;
        await client.query(
          `INSERT INTO passages (external_id, source_id, title, body, word_count, level, source_url, crawled_at, review_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'quarantine') ON CONFLICT (external_id) DO NOTHING`,
          [p.id, sourceId, p.title, p.body, p.wordCount, p.level, p.sourceUrl, p.crawledAt],
        );
      }
    const wanted = bundles.flatMap((b) => b.passages.map((p) => p.id));
    if (wanted.length > 0)
      for (const r of (
        await client.query<{ id: string; external_id: string }>(
          "SELECT id::text, external_id FROM passages WHERE external_id = ANY($1::text[])",
          [wanted],
        )
      ).rows)
        passageIds.set(r.external_id, r.id);

    for (const bundle of bundles)
      for (const q of bundle.questions) {
        const sourceId = sources.get(q.sourceId);
        if (sourceId === undefined) {
          bump(result.skipped, "unknown_or_disabled_source");
          continue;
        }
        const topicId =
          topics.get(`${String(q.grade)}|${q.skill}|${q.topicSlug}`) ??
          topics.get(`${String(q.grade)}|${q.skill}|chung`);
        if (topicId === undefined) {
          bump(result.skipped, "no_topic");
          continue;
        }
        const passageId = q.passageId === undefined ? null : (passageIds.get(q.passageId) ?? null);
        if (q.passageId !== undefined && passageId === null) {
          bump(result.skipped, "no_passage");
          continue;
        }
        const r = await client.query(
          `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, passage_id, stem, options,
                                  correct_key, explanation, source_id, source_url, source_ref, provenance, crawled_at, review_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb,$15,'quarantine')
           ON CONFLICT (external_id) DO NOTHING`,
          [
            q.id,
            q.grade,
            q.skill,
            topicId,
            q.difficulty,
            passageId,
            q.stem,
            JSON.stringify(q.options),
            q.correctKey,
            q.explanation,
            sourceId,
            q.sourceUrl,
            q.sourceRef,
            JSON.stringify(parseSourceRef(q.sourceRef)),
            q.crawledAt,
          ],
        );
        if (r.rowCount === 1) result.inserted++;
        else bump(result.skipped, "already_present");
      }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return result;
}
