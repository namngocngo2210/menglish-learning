import type http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dispatchOutbox, edgePoster } from "../src/outbox";
import { createLogger } from "../src/log";
import { ADMIN_URL, createWorkerDb, listen, silentLog } from "./helpers";
import type { TestDb } from "./helpers";

const TOKEN = "t".repeat(24);

describe.skipIf(ADMIN_URL === undefined)("outbox dispatcher", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createWorkerDb();
    await db.admin.query(
      `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, stem, options, correct_key, explanation,
                              source_id, source_url, review_status, published_at)
       SELECT 'ob-1', 9, 'ngu-phap', t.id, 1, 'Stem', '[{"key":"A","text":"a"},{"key":"B","text":"b"},{"key":"C","text":"c"},{"key":"D","text":"d"}]'::jsonb,
              'A', 'Why', s.id, 'https://example.test/q', 'published', now() FROM topics t, sources s WHERE t.grade = 9 AND t.skill = 'ngu-phap' LIMIT 1`,
    );
  });
  afterAll(async () => {
    await db.remove();
  });
  beforeEach(async () => {
    await db.admin.query("DELETE FROM outbox_events");
  });

  async function withEdge(
    status: number,
    run: (url: string, seen: { auth: string | undefined; body: unknown }[]) => Promise<void>,
  ): Promise<void> {
    const seen: { auth: string | undefined; body: unknown }[] = [];
    const server = await listen((req: http.IncomingMessage, res: http.ServerResponse) => {
      let raw = "";
      req.on("data", (c: Buffer) => (raw += c.toString()));
      req.on("end", () => {
        seen.push({ auth: req.headers.authorization, body: JSON.parse(raw) as unknown });
        res.writeHead(status).end("{}");
      });
    });
    try {
      await run(`http://127.0.0.1:${String(server.port)}/_purge`, seen);
    } finally {
      await server.close();
    }
  }
  const add = (kind: string, payload: object) =>
    db.admin.query("INSERT INTO outbox_events (kind, payload) VALUES ($1, $2::jsonb)", [
      kind,
      JSON.stringify(payload),
    ]);

  it("delivers purge_paths and rebuild events with the bearer token and marks them delivered", async () => {
    await add("purge_paths", { paths: ["/grade-9/grammar/x/test-1"] });
    const q = await db.admin.query<{ id: string }>(
      "SELECT id::text FROM questions WHERE external_id = 'ob-1'",
    );
    await add("rebuild", { entity: "question", ids: [q.rows[0]?.id] });
    await withEdge(200, async (url, seen) => {
      const r = await dispatchOutbox(db.worker, edgePoster(url, TOKEN), silentLog);
      expect(r).toEqual({ delivered: 2, failed: 0 });
      expect(seen.map((s) => s.auth)).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`]);
      expect(seen[0]?.body).toEqual({ paths: ["/grade-9/grammar/x/test-1", "/", "/sitemap.xml"] });
      expect(seen[1]?.body).toEqual({
        paths: ["/", "/sitemap.xml"],
        prefixes: ["/pool", "/grade-9", "/grade-10-entrance"],
      });
    });
    const pending = await db.admin.query(
      "SELECT count(*)::int AS n FROM outbox_events WHERE delivered_at IS NULL",
    );
    expect(pending.rows[0]).toEqual({ n: 0 });
  });

  it("keeps the event pending and counts the attempt when the edge answers 500, without logging the token", async () => {
    await add("purge_paths", { paths: ["/a"] });
    const lines: string[] = [];
    await withEdge(500, async (url) => {
      const r = await dispatchOutbox(
        db.worker,
        edgePoster(url, TOKEN),
        createLogger((l) => lines.push(l)),
      );
      expect(r).toEqual({ delivered: 0, failed: 1 });
    });
    const row = await db.admin.query("SELECT attempts, delivered_at FROM outbox_events");
    expect(row.rows[0]).toEqual({ attempts: 1, delivered_at: null });
    expect(lines.join("\n")).not.toContain(TOKEN);
  });

  it("keeps the event pending when the edge is unreachable and skips events past 10 attempts", async () => {
    await add("purge_paths", { paths: ["/a"] });
    const down = edgePoster("http://127.0.0.1:1/_purge", TOKEN, 300);
    expect((await dispatchOutbox(db.worker, down, silentLog)).failed).toBe(1);
    await db.admin.query("UPDATE outbox_events SET attempts = 10");
    expect(await dispatchOutbox(db.worker, down, silentLog)).toEqual({ delivered: 0, failed: 0 });
  });

  it("lets the worker mark delivery but not create or delete events", async () => {
    await expect(
      db.worker.query("INSERT INTO outbox_events (kind, payload) VALUES ('x', '{}')"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.worker.query("DELETE FROM outbox_events")).rejects.toThrow(/permission denied/);
  });
});
