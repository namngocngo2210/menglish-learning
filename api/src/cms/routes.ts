import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { HttpProblem } from "../server/problems";
import {
  ListQuerySchema,
  IdSchema,
  BulkSchema,
  ReportPatchSchema,
  TransitionSchema,
} from "./schemas";
import { SCHEMAS } from "./schemas";
import {
  bulkTransition,
  create,
  get,
  hmac,
  list,
  query,
  remove,
  transition,
  tx,
  update,
  audit,
} from "./service";
import type { Actor, Resource } from "./service";

/** Resolves the logged-in admin or throws HttpProblem("unauthenticated"). The real one comes from the auth task. */
export type AdminGuard = (request: FastifyRequest) => Promise<{ adminUserId: string }>;

export const denyAll: AdminGuard = () => {
  throw new HttpProblem("unauthenticated", "Admin authentication is not configured");
};

export interface CmsOptions {
  pool: pg.Pool;
  /** Secret for HMACs of IP/UA (audit ip_hash, report client_hash). */
  salt: string;
  adminGuard?: AdminGuard;
}

const actors = new WeakMap<FastifyRequest, Actor>();
const idParams = z.strictObject({ id: IdSchema });
const send = (reply: FastifyReply, body: unknown, status = 200): FastifyReply =>
  reply.code(status).header("cache-control", "no-store").send(body);

/** Registers /api/v1/admin/*: every route sits behind the guard (deny-by-default). */
export function adminPlugin(options: CmsOptions) {
  const { pool, salt } = options;
  const guard = options.adminGuard ?? denyAll;
  const actor = (request: FastifyRequest): Actor => {
    const who = actors.get(request);
    if (!who) throw new HttpProblem("unauthenticated");
    return who;
  };

  return (app: FastifyInstance, _opts: unknown, done: () => void): void => {
    app.addHook("onRequest", async (request) => {
      const principal = await guard(request);
      actors.set(request, { adminUserId: principal.adminUserId, ipHash: hmac(salt, request.ip) });
    });

    for (const name of Object.keys(SCHEMAS) as Resource[]) {
      app.get(`/${name}`, async (request, reply) =>
        send(reply, await list(pool, name, ListQuerySchema.parse(request.query))),
      );
      app.get(`/${name}/:id`, async (request, reply) =>
        send(reply, await get(pool, name, idParams.parse(request.params).id)),
      );
      app.post(`/${name}`, async (request, reply) =>
        send(reply, await create(pool, name, request.body, actor(request)), 201),
      );
      app.patch(`/${name}/:id`, async (request, reply) => {
        const ifMatch = request.headers["if-match"];
        const { id } = idParams.parse(request.params);
        return send(
          reply,
          await update(pool, name, id, request.body, ifMatch?.replaceAll('"', ""), actor(request)),
        );
      });
    }

    app.delete("/mixer-presets/:id", async (request, reply) => {
      await remove(pool, idParams.parse(request.params).id, actor(request));
      return send(reply, { status: "ok" });
    });

    for (const name of ["questions", "passages", "tests"] as const) {
      app.post(`/${name}/:id/transition`, async (request, reply) => {
        const { id } = idParams.parse(request.params);
        const body = TransitionSchema.parse(request.body);
        return send(reply, await transition(pool, name, id, body.to, body.note, actor(request)));
      });
    }
    for (const name of ["questions", "passages"] as const) {
      app.post(`/${name}/bulk-transition`, async (request, reply) =>
        send(
          reply,
          await bulkTransition(pool, name, BulkSchema.parse(request.body), actor(request)),
        ),
      );
    }

    app.get("/questions/:id/revisions", async (request, reply) => {
      const { id } = idParams.parse(request.params);
      return send(reply, {
        items: await query(
          pool,
          "SELECT id, version, snapshot, created_at FROM question_revisions WHERE question_id = $1 ORDER BY version DESC",
          [id],
        ),
      });
    });

    app.get("/audit", async (request, reply) => {
      const q = ListQuerySchema.parse(request.query);
      const rows = await query(
        pool,
        `SELECT * FROM audit_log ${q.cursor ? "WHERE id < $2" : ""} ORDER BY id DESC LIMIT $1`,
        q.cursor ? [q.limit + 1, q.cursor] : [q.limit + 1],
      );
      return send(reply, {
        items: rows.slice(0, q.limit),
        next_cursor: rows.length > q.limit ? String(rows[q.limit - 1]?.["id"]) : null,
      });
    });

    app.get("/reports", async (request, reply) => {
      const q = z
        .object({
          limit: ListQuerySchema.shape.limit,
          cursor: IdSchema.optional(),
          status: z.enum(["open", "resolved", "dismissed"]).optional(),
        })
        .parse(request.query);
      const where: string[] = [];
      const params: unknown[] = [q.limit + 1];
      if (q.status) where.push(`status = $${String(params.push(q.status))}`);
      if (q.cursor) where.push(`id > $${String(params.push(q.cursor))}`);
      const rows = await query(
        pool,
        `SELECT id, question_id, reason, note, status, handled_at, handled_note, created_at
         FROM question_reports ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id LIMIT $1`,
        params,
      );
      return send(reply, {
        items: rows.slice(0, q.limit),
        next_cursor: rows.length > q.limit ? String(rows[q.limit - 1]?.["id"]) : null,
      });
    });

    app.patch("/reports/:id", async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const body = ReportPatchSchema.parse(request.body);
      const who = actor(request);
      const row = await tx(pool, async (c) => {
        const [updated] = await query(
          c,
          `UPDATE question_reports SET status = $2, handled_note = $3, handled_at = now()
           WHERE id = $1 RETURNING id, question_id, reason, note, status, handled_at, handled_note`,
          [id, body.status, body.handled_note ?? null],
        );
        if (!updated) throw new HttpProblem("not_found");
        await audit(c, who, "report.update", "report", id, { status: body.status });
        return updated;
      });
      return send(reply, row);
    });

    done();
  };
}
