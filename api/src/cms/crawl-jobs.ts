import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { HttpProblem } from "../server/problems";
import { IdSchema, ListQuerySchema } from "./schemas";
import { audit, query, tx } from "./service";
import type { Actor } from "./service";

const CreateSchema = z.strictObject({
  sourceCode: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).default({}),
});
const idParams = z.strictObject({ id: IdSchema });
const COLUMNS =
  "id, source_id, params, status, run_after, attempts, started_at, finished_at, fetched_count, quarantined_count, error_count, created_at";

/**
 * Crawl queue endpoints for the admin: enqueue, list, cancel. The worker (separate process, role
 * bj_worker) claims queued rows; it can only ever write quarantine content.
 */
export function registerCrawlJobs(
  app: FastifyInstance,
  pool: pg.Pool,
  actor: (request: FastifyRequest) => Actor,
  send: (reply: FastifyReply, body: unknown, status?: number) => FastifyReply,
): void {
  app.post("/crawl-jobs", async (request, reply) => {
    const body = CreateSchema.parse(request.body);
    const who = actor(request);
    const row = await tx(pool, async (c) => {
      const [source] = await query(c, "SELECT id, enabled FROM sources WHERE code = $1", [
        body.sourceCode,
      ]);
      if (!source) throw new HttpProblem("not_found", "Unknown source");
      if (source["enabled"] !== true) throw new HttpProblem("conflict", "Source is not enabled");
      const [created] = await query(
        c,
        `INSERT INTO crawl_jobs (source_id, params, requested_by) VALUES ($1, $2::jsonb, $3) RETURNING ${COLUMNS}`,
        [source["id"], JSON.stringify(body.params), who.adminUserId],
      );
      await audit(c, who, "crawl_job.create", "crawl_job", String(created?.["id"]), {
        sourceCode: body.sourceCode,
      });
      return created;
    });
    return send(reply, row, 201);
  });

  app.get("/crawl-jobs", async (request, reply) => {
    const q = ListQuerySchema.parse(request.query);
    const rows = await query(
      pool,
      `SELECT ${COLUMNS} FROM crawl_jobs ${q.cursor ? "WHERE id < $2" : ""} ORDER BY id DESC LIMIT $1`,
      q.cursor ? [q.limit + 1, q.cursor] : [q.limit + 1],
    );
    return send(reply, {
      items: rows.slice(0, q.limit),
      next_cursor: rows.length > q.limit ? String(rows[q.limit - 1]?.["id"]) : null,
    });
  });

  app.post("/crawl-jobs/:id/cancel", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const who = actor(request);
    const row = await tx(pool, async (c) => {
      const [cancelled] = await query(
        c,
        `UPDATE crawl_jobs SET status = 'cancelled', finished_at = now()
         WHERE id = $1 AND status = 'queued' RETURNING ${COLUMNS}`,
        [id],
      );
      if (!cancelled) throw new HttpProblem("conflict", "Only queued jobs can be cancelled");
      await audit(c, who, "crawl_job.cancel", "crawl_job", id, {});
      return cancelled;
    });
    return send(reply, row);
  });
}
