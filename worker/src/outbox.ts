import type pg from "pg";
import { z } from "zod";
import type { Logger } from "./log";

const MAX_ATTEMPTS = 10;
const purgePayload = z.object({ paths: z.array(z.string().startsWith("/")).max(400) });
const rebuildPayload = z.object({
  entity: z.enum(["question", "passage"]),
  ids: z.array(z.union([z.string(), z.number()])).max(5000),
});

export interface PurgeBody {
  paths: string[];
  prefixes?: string[];
}
export type PostPurge = (body: PurgeBody) => Promise<boolean>;

/** POST /_purge on the internal edge cache; the edge re-warms what it removed. True on 2xx. */
export function edgePoster(url: string, token: string, timeoutMs = 5000): PostPurge {
  return async (body) => {
    // eslint-disable-next-line no-restricted-globals -- internal edge service from config, not a user-supplied URL
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.arrayBuffer();
    return res.status >= 200 && res.status < 300;
  };
}

const ALWAYS = ["/", "/sitemap.xml"];

async function purgeFor(
  pool: pg.PoolClient,
  kind: string,
  payload: unknown,
): Promise<PurgeBody | undefined> {
  if (kind === "purge_paths") {
    const { paths } = purgePayload.parse(payload);
    return { paths: [...new Set([...paths, ...ALWAYS])] };
  }
  if (kind === "rebuild") {
    const { entity, ids } = rebuildPayload.parse(payload);
    const column = entity === "question" ? "id" : "passage_id";
    const { rows } = await pool.query<{ grade: number }>(
      `SELECT DISTINCT grade FROM questions WHERE ${column} = ANY($1::bigint[])`,
      [ids.map(String)],
    );
    const prefixes = ["/pool", ...rows.map((r) => `/lop-${String(r.grade)}`)];
    if (rows.some((r) => r.grade === 9)) prefixes.push("/thi-vao-lop-10");
    return { paths: ALWAYS, prefixes };
  }
  return undefined;
}

/** Delivers pending outbox events in order; failed events stay pending with attempts + 1. */
export async function dispatchOutbox(
  pool: pg.Pool,
  post: PostPurge,
  log: Logger,
): Promise<{ delivered: number; failed: number }> {
  const client = await pool.connect();
  let delivered = 0;
  let failed = 0;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string; kind: string; payload: unknown }>(
      `SELECT id::text, kind, payload FROM outbox_events
       WHERE delivered_at IS NULL AND attempts < $1 ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED`,
      [MAX_ATTEMPTS],
    );
    for (const row of rows) {
      let ok = false;
      try {
        const body = await purgeFor(client, row.kind, row.payload);
        ok = body === undefined ? true : await post(body);
      } catch {
        ok = false;
      }
      if (ok) {
        await client.query("UPDATE outbox_events SET delivered_at = now() WHERE id = $1", [row.id]);
        delivered++;
      } else {
        await client.query("UPDATE outbox_events SET attempts = attempts + 1 WHERE id = $1", [
          row.id,
        ]);
        log.warn("outbox_delivery_failed", { id: row.id, kind: row.kind });
        failed++;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { delivered, failed };
}
