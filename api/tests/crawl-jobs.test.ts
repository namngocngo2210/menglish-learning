import { randomBytes } from "node:crypto";
import type { PublicReader } from "@bj/data";
import type { FastifyInstance, InjectOptions } from "fastify";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/server/app";
import { HttpProblem } from "../src/server/problems";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const ADMIN = "/api/v1/admin";
const OPTIONS = JSON.stringify([
  { key: "A", text: "a" },
  { key: "B", text: "b" },
  { key: "C", text: "c" },
  { key: "D", text: "d" },
]);

describe.skipIf(ADMIN_URL === undefined)("crawl jobs and the review flow", () => {
  let db: TestDb;
  let pool: pg.Pool;
  let worker: pg.Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 4 });
    await pool.query(
      `INSERT INTO sources (code, name, base_url, license, attribution, enabled) VALUES
       ('on','On','https://example.com','CC','a', true), ('off','Off','https://example.com','CC','a', false)`,
    );
    await pool.query(
      "INSERT INTO topics (grade, skill, slug, name) VALUES (6,'ngu-phap','thi','Thi')",
    );
    const adminUserId = String(
      (
        await pool.query(
          "INSERT INTO admin_users (email, password_hash) VALUES ('a@x.test','h') RETURNING id",
        )
      ).rows[0].id,
    );
    const login = `wl_${randomBytes(4).toString("hex")}`;
    await pool.query(`CREATE ROLE ${login} LOGIN PASSWORD 'pw' IN ROLE bj_worker`);
    const url = new URL(db.url);
    url.username = login;
    url.password = "pw";
    worker = new pg.Pool({ connectionString: url.toString(), max: 2 });
    app = (
      await buildApp({
        reader: {} as PublicReader,
        internalToken: undefined,
        rateLimitPerMinute: 1000,
        logger: { level: "silent" },
        cms: {
          pool,
          salt: "0123456789abcdef-salt",
          adminGuard: (request) => {
            if (request.headers.cookie !== "ok") throw new HttpProblem("unauthenticated");
            return Promise.resolve({ adminUserId });
          },
        },
      })
    ).app;
  });
  afterAll(async () => {
    await app.close();
    await worker.end();
    await pool.end();
    await db.remove();
  });

  const call = async (method: "GET" | "POST", url: string, payload?: object) => {
    const opts: InjectOptions = {
      method,
      url,
      headers: { cookie: "ok" },
      ...(payload ? { payload } : {}),
    };
    const res = await app.inject(opts);
    return { status: res.statusCode, body: res.json<Record<string, unknown>>() };
  };

  it("enqueues a crawl job for an enabled source and audits it", async () => {
    const r = await call("POST", `${ADMIN}/crawl-jobs`, { sourceCode: "on", params: { limit: 5 } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: "queued", params: { limit: 5 } });
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'crawl_job.create'");
    expect(audit.rowCount).toBe(1);
  });

  it("rejects unknown sources, disabled sources and unexpected fields", async () => {
    expect((await call("POST", `${ADMIN}/crawl-jobs`, { sourceCode: "nope" })).status).toBe(404);
    expect((await call("POST", `${ADMIN}/crawl-jobs`, { sourceCode: "off" })).status).toBe(409);
    expect((await call("POST", `${ADMIN}/crawl-jobs`, { sourceCode: "on", sql: "x" })).status).toBe(
      422,
    );
  });

  it("lists jobs newest first and cancels only queued jobs", async () => {
    const created = await call("POST", `${ADMIN}/crawl-jobs`, { sourceCode: "on" });
    const id = String(created.body["id"]);
    const list = await call("GET", `${ADMIN}/crawl-jobs?limit=1`);
    expect((list.body["items"] as { id: string }[])[0]?.id).toBe(id);
    expect(list.body["next_cursor"]).not.toBeNull();
    expect((await call("POST", `${ADMIN}/crawl-jobs/${id}/cancel`)).body["status"]).toBe(
      "cancelled",
    );
    expect((await call("POST", `${ADMIN}/crawl-jobs/${id}/cancel`)).status).toBe(409);
  });

  it("moves a worker-inserted quarantine question to published only through the owner flow, emitting an outbox event", async () => {
    await worker.query(
      `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, stem, options, correct_key, explanation,
                              source_id, source_url, review_status)
       SELECT 'crawl-1', 6, 'ngu-phap', t.id, 1, 'Stem', $1::jsonb, 'A', 'Why', s.id, 'https://example.com/q', 'quarantine'
       FROM topics t, sources s WHERE s.code = 'on' LIMIT 1`,
      [OPTIONS],
    );
    const id = String(
      (await pool.query("SELECT id FROM questions WHERE external_id = 'crawl-1'")).rows[0].id,
    );
    const to = (status: string) =>
      call("POST", `${ADMIN}/questions/${id}/transition`, { to: status });
    expect((await to("published")).status).toBe(409); // no skipping the review
    expect((await to("in_review")).status).toBe(409); // quarantine -> draft first
    expect((await to("draft")).status).toBe(200);
    expect((await to("in_review")).status).toBe(200);
    expect((await pool.query("SELECT count(*)::int AS n FROM outbox_events")).rows[0].n).toBe(0);
    expect((await to("published")).status).toBe(200);
    const row = (
      await pool.query("SELECT review_status, published_at FROM questions WHERE id = $1", [id])
    ).rows[0];
    expect(row.review_status).toBe("published");
    expect(row.published_at).not.toBeNull();
    const events = await pool.query("SELECT kind, payload FROM outbox_events");
    expect(events.rows).toEqual([{ kind: "rebuild", payload: { entity: "question", ids: [id] } }]);
  });

  it("denies the worker role any way to publish, directly or by update", async () => {
    await worker.query(
      `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, stem, options, correct_key, explanation,
                              source_id, source_url, review_status)
       SELECT 'crawl-2', 6, 'ngu-phap', t.id, 1, 'Stem2', $1::jsonb, 'A', 'Why', s.id, 'https://example.com/q', 'quarantine'
       FROM topics t, sources s WHERE s.code = 'on' LIMIT 1`,
      [OPTIONS],
    );
    await expect(
      worker.query(
        "UPDATE questions SET review_status = 'published', published_at = now() WHERE external_id = 'crawl-2'",
      ),
    ).rejects.toThrow();
    expect(
      (await pool.query("SELECT review_status FROM questions WHERE external_id = 'crawl-2'"))
        .rows[0].review_status,
    ).toBe("quarantine");
  });
});
