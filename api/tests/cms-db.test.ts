import type { PublicReader } from "@bj/data";
import type { FastifyInstance, InjectOptions } from "fastify";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hmac } from "../src/cms/service";
import { HttpProblem } from "../src/server/problems";
import { buildApp } from "../src/server/app";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const silent = { level: "silent" };
let db: TestDb;
let pool: pg.Pool;
let app: FastifyInstance;
let routes: readonly string[];
let authed = true;
let adminUserId = "";
let ipCounter = 0;
const ADMIN = "/api/v1/admin";

const call = async (opts: InjectOptions) => {
  const res = await app.inject(opts);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reads arbitrary JSON
  return { status: res.statusCode, body: res.json<Record<string, any>>() };
};
const post = (url: string, payload: object, extra: InjectOptions = {}) =>
  call({ method: "POST", url, payload, headers: { cookie: "ok" }, ...extra });
const count = async (table: string, where = "true"): Promise<number> =>
  Number((await pool.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);

const option = (key: string, text: string) => ({ key, text });
let seq = 0;
const questionBody = (over: object = {}) => {
  seq += 1;
  return {
    external_id: `q-${String(seq)}`,
    grade: 6,
    skill: "ngu-phap",
    topic_id: "1",
    difficulty: 1,
    stem: `Stem ${String(seq)}`,
    options: [option("A", "a"), option("B", "b"), option("C", "c"), option("D", "d")],
    correct_key: "B",
    explanation: "because",
    source_id: "1",
    source_url: "https://example.com/q",
    ...over,
  };
};
const newQuestion = async (over: object = {}): Promise<string> => {
  const r = await post(`${ADMIN}/questions`, questionBody(over));
  expect(r.status).toBe(201);
  return r.body["id"] as string;
};
const move = (kind: string, id: string, to: string) =>
  post(`${ADMIN}/${kind}/${id}/transition`, { to, note: "n" });
const publish = async (id: string) => {
  for (const to of ["in_review", "published"])
    expect((await move("questions", id, to)).status).toBe(200);
};

describe.skipIf(ADMIN_URL === undefined)("CMS API (database)", () => {
  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 4 });
    await pool.query(
      `INSERT INTO sources (code, name, base_url, license, attribution) VALUES ('s1','S','https://example.com','CC','a')`,
    );
    adminUserId = String(
      (
        await pool.query(
          "INSERT INTO admin_users (email, password_hash) VALUES ('a@x.test','h') RETURNING id",
        )
      ).rows[0].id,
    );
    await pool.query(
      `INSERT INTO topics (grade, skill, slug, name) VALUES (6,'ngu-phap','thi','Thi')`,
    );
    const built = await buildApp({
      reader: {} as PublicReader,
      internalToken: undefined,
      rateLimitPerMinute: 1000,
      logger: silent,
      cms: {
        pool,
        salt: "0123456789abcdef-salt",
        adminGuard: (request) => {
          if (!authed || request.headers.cookie !== "ok") throw new HttpProblem("unauthenticated");
          return Promise.resolve({ adminUserId });
        },
      },
    });
    app = built.app;
    routes = built.routes;
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await db.remove();
  });

  const as = { headers: { cookie: "ok" } };
  const guarded = (opts: InjectOptions) => call({ ...as, ...opts });
  // Route helpers that always carry the fake session.
  const send = (
    method: "POST" | "PATCH" | "DELETE" | "GET",
    url: string,
    payload?: object,
    h = {},
  ) => guarded({ method, url, ...(payload ? { payload } : {}), headers: { cookie: "ok", ...h } });

  it("answers 401 on every admin route without a session (routes enumerated, not hardcoded)", async () => {
    const adminRoutes = routes.filter((r) => r.includes(`${ADMIN}/`) && !r.startsWith("HEAD"));
    expect(adminRoutes.length).toBeGreaterThan(25);
    for (const route of adminRoutes) {
      const [method, url] = route.split(" ") as [string, string];
      const res = await app.inject({ method: method as "GET", url: url.replace(":id", "1") });
      expect(res.statusCode, route).toBe(401);
    }
  });

  it("CRUDs sources, passages, tests and mixer presets with validation", async () => {
    const src = await send("POST", `${ADMIN}/sources`, {
      code: "s2",
      name: "S2",
      base_url: "https://a.example",
      license: "CC",
      attribution: "x",
      allowed_hosts: ["a.example"],
      enabled: false,
    });
    expect(src.status).toBe(201);
    expect((await send("POST", `${ADMIN}/sources`, { ...src.body, code: "s2" })).status).toBe(422);
    expect(
      (await send("PATCH", `${ADMIN}/sources/${src.body["id"]}`, { enabled: true })).body[
        "enabled"
      ],
    ).toBe(true);
    expect((await send("PATCH", `${ADMIN}/sources/${src.body["id"]}`, { bogus: 1 })).status).toBe(
      422,
    );

    const passage = await send("POST", `${ADMIN}/passages`, {
      external_id: "p1",
      source_id: "1",
      title: "T",
      body: "B",
      word_count: 10,
      level: 2,
    });
    expect(passage.status).toBe(201);
    expect(passage.body["review_status"]).toBe("draft");
    const pid = passage.body["id"];
    expect((await send("PATCH", `${ADMIN}/passages/${pid}`, { title: "T2" })).status).toBe(422); // no If-Match
    expect(
      (await send("PATCH", `${ADMIN}/passages/${pid}`, { title: "T2" }, { "if-match": "9" }))
        .status,
    ).toBe(409);
    const patched = await send(
      "PATCH",
      `${ADMIN}/passages/${pid}`,
      { title: "T2" },
      { "if-match": "1" },
    );
    expect(patched.body).toMatchObject({ title: "T2", version: 2 });

    const preset = await send("POST", `${ADMIN}/mixer-presets`, {
      name: "p",
      grade: 6,
      config: { size: 10, difficultyMix: { 1: 1 } },
    });
    expect(preset.status).toBe(201);
    expect(
      (await send("POST", `${ADMIN}/mixer-presets`, { name: "q", grade: 6, config: { size: 0 } }))
        .status,
    ).toBe(422);
    expect((await send("DELETE", `${ADMIN}/mixer-presets/${preset.body["id"]}`)).status).toBe(200);
    expect((await send("GET", `${ADMIN}/mixer-presets/${preset.body["id"]}`)).status).toBe(404);

    const qid = await newQuestion();
    const test = await send("POST", `${ADMIN}/tests`, {
      slug: "lop-6/ngu-phap/thi/de-1",
      grade: 6,
      skill: "ngu-phap",
      topic_id: "1",
      kind: "topic",
      title: "De 1",
      items: [{ question_id: qid, option_order: "BADC" }],
    });
    expect(test.status).toBe(201);
    expect(await count("test_items")).toBe(1);
    // publishing needs published questions
    await move("tests", test.body["id"], "in_review");
    const blocked = await move("tests", test.body["id"], "published");
    expect(blocked.status).toBe(409);
    expect(await count("outbox_events")).toBe(0);
    await publish(qid);
    expect((await move("tests", test.body["id"], "published")).status).toBe(200);
    const outbox = await pool.query(
      "SELECT kind, payload FROM outbox_events WHERE kind = 'purge_paths'",
    );
    expect(outbox.rows[0].payload.paths).toEqual(["/grade-6/grammar/thi/test-1"]);
  });

  it("lists questions with filters and keyset pagination", async () => {
    for (let i = 0; i < 3; i += 1) await newQuestion();
    for (let i = 0; i < 3; i += 1) await newQuestion();
    const page = await send("GET", `${ADMIN}/questions?limit=2&status=draft&q=stem`);
    expect(page.status).toBe(200);
    expect(page.body["items"]).toHaveLength(2);
    expect(page.body["items"][0]).not.toHaveProperty("stem_norm");
    const next = await send(
      "GET",
      `${ADMIN}/questions?limit=2&status=draft&cursor=${page.body["next_cursor"]}`,
    );
    expect(BigInt(next.body["items"][0].id)).toBeGreaterThan(BigInt(page.body["next_cursor"]));
    expect((await send("GET", `${ADMIN}/questions?limit=500`)).status).toBe(422);
  });

  it("writes revision, audit and outbox with every question change", async () => {
    const id = await newQuestion();
    const before = {
      rev: await count("question_revisions", `question_id = ${id}`),
      audit: await count("audit_log"),
    };
    const edit = await send(
      "PATCH",
      `${ADMIN}/questions/${id}`,
      { stem: "New stem" },
      { "if-match": "1" },
    );
    expect(edit.body["version"]).toBe(2);
    expect(await count("question_revisions", `question_id = ${id}`)).toBe(before.rev + 1);
    const rev = await send("GET", `${ADMIN}/questions/${id}/revisions`);
    expect(rev.body["items"][0]).toMatchObject({ version: 1 });
    expect(rev.body["items"][0].snapshot).not.toHaveProperty("stem_norm");
    expect(
      (await send("PATCH", `${ADMIN}/questions/${id}`, { correct_key: "B" }, { "if-match": "1" }))
        .status,
    ).toBe(409);

    expect((await move("questions", id, "published")).status).toBe(409); // draft -> published invalid
    expect((await move("questions", id, "in_review")).status).toBe(200);
    const outboxBefore = await count("outbox_events");
    expect((await move("questions", id, "published")).status).toBe(200);
    expect(await count("outbox_events")).toBe(outboxBefore + 1);
    expect((await move("questions", id, "archived")).status).toBe(200); // unpublish also purges
    expect(await count("outbox_events")).toBe(outboxBefore + 2);
    expect(await count("audit_log")).toBeGreaterThan(before.audit + 3);
    const log = await pool.query(
      "SELECT ip_hash, details FROM audit_log WHERE action = 'question.transition' ORDER BY id DESC LIMIT 1",
    );
    expect(log.rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(log.rows[0])).not.toContain("127.0.0.1");
  });

  it("refuses direct creation or edit into published", async () => {
    expect(
      (await send("POST", `${ADMIN}/questions`, questionBody({ review_status: "published" })))
        .status,
    ).toBe(422);
    const id = await newQuestion();
    expect(
      (
        await send(
          "PATCH",
          `${ADMIN}/questions/${id}`,
          { review_status: "published" },
          { "if-match": "1" },
        )
      ).status,
    ).toBe(422);
  });

  it("bulk: expected_count mismatch or one invalid row changes nothing; success writes one outbox row", async () => {
    const ids = [await newQuestion(), await newQuestion(), await newQuestion()];
    for (const id of ids.slice(0, 2)) await move("questions", id, "in_review");
    const snapshot = async () =>
      JSON.stringify(
        (
          await pool.query(
            "SELECT id, review_status, version FROM questions WHERE id = ANY($1::bigint[]) ORDER BY id",
            [ids],
          )
        ).rows,
      );
    const start = {
      state: await snapshot(),
      outbox: await count("outbox_events"),
      audit: await count("audit_log"),
      rev: await count("question_revisions"),
    };
    const unchanged = async () => {
      expect({
        state: await snapshot(),
        outbox: await count("outbox_events"),
        audit: await count("audit_log"),
        rev: await count("question_revisions"),
      }).toEqual(start);
    };

    const mismatch = await send("POST", `${ADMIN}/questions/bulk-transition`, {
      to: "published",
      expected_count: 5,
      ids: ids.slice(0, 2),
    });
    expect(mismatch.status).toBe(409);
    await unchanged();
    // third is still draft: draft -> published is invalid, whole bulk rolls back
    const invalid = await send("POST", `${ADMIN}/questions/bulk-transition`, {
      to: "published",
      expected_count: 3,
      ids,
    });
    expect(invalid.status).toBe(409);
    await unchanged();

    const ok = await send("POST", `${ADMIN}/questions/bulk-transition`, {
      to: "published",
      expected_count: 2,
      ids: ids.slice(0, 2),
    });
    expect(ok).toMatchObject({ status: 200, body: { count: 2 } });
    expect(await count("outbox_events")).toBe(start.outbox + 1);
    expect(await count("audit_log")).toBe(start.audit + 1);
    const published = await count("questions", "review_status = 'published' AND grade = 6");

    const byFilter = await send("POST", `${ADMIN}/questions/bulk-transition`, {
      to: "archived",
      expected_count: published,
      filter: { status: "published", grade: 6 },
    });
    expect(byFilter.status).toBe(200);
  });

  it("rolls back audit, revision and outbox when a transaction fails midway", async () => {
    const id = await newQuestion();
    const before = {
      rev: await count("question_revisions"),
      audit: await count("audit_log"),
      outbox: await count("outbox_events"),
    };
    // topic_id 999 violates the FK after the revision insert
    const res = await send(
      "PATCH",
      `${ADMIN}/questions/${id}`,
      { topic_id: "999" },
      { "if-match": "1" },
    );
    expect(res.status).toBe(422);
    expect({
      rev: await count("question_revisions"),
      audit: await count("audit_log"),
      outbox: await count("outbox_events"),
    }).toEqual(before);
    expect((await send("GET", `${ADMIN}/questions/${id}`)).body["version"]).toBe(1);
  });

  describe("public reports", () => {
    const nextIp = (): string => `203.0.113.${String(++ipCounter)}`;
    const report = (over: object = {}, headers: Record<string, string> = {}, ip = nextIp()) =>
      call({
        method: "POST",
        url: "/api/v1/public/reports",
        payload: { question_id: pub, reason: "wrong_answer", ...over },
        headers: { "user-agent": "vitest", ...headers },
        remoteAddress: ip,
      });
    let pub = "";
    beforeAll(async () => {
      const id = await newQuestion();
      await publish(id);
      pub = (await send("GET", `${ADMIN}/questions/${id}`)).body["external_id"];
    });

    it("stores one hashed report, dedupes, drops honeypot hits and rejects bad input", async () => {
      const ip = "198.51.100.5";
      expect((await report({ note: "sai" }, {}, ip)).status).toBe(202);
      expect((await report({ note: "sai nữa" }, {}, ip)).status).toBe(202); // dedupe
      expect(await count("question_reports")).toBe(1);
      const row = (await pool.query("SELECT * FROM question_reports")).rows[0];
      expect(JSON.stringify(row)).not.toContain(ip);
      expect(row.client_hash).toMatch(/^[0-9a-f]{64}$/);
      expect((await report({ website: "http://spam" }, { "user-agent": "bot" })).status).toBe(202);
      expect(await count("question_reports")).toBe(1);
      expect((await report({ reason: "nope" })).status).toBe(422);
      expect((await report({ note: "x".repeat(501) })).status).toBe(422);
      expect((await report({ question_id: "missing" })).status).toBe(404);
      expect((await report({ note: "x".repeat(3000) })).status).toBe(413);
    });

    it("works without a session, and admins can triage reports", async () => {
      authed = false;
      expect((await report({ reason: "typo" }, { "user-agent": "other" })).status).toBe(202);
      authed = true;
      const list = await send("GET", `${ADMIN}/reports?status=open`);
      expect(list.body["items"].length).toBeGreaterThanOrEqual(2);
      const id = list.body["items"][0].id;
      expect(
        (await send("PATCH", `${ADMIN}/reports/${id}`, { status: "resolved", handled_note: "ok" }))
          .body["status"],
      ).toBe("resolved");
    });

    it("rate limits per IP and caps reports per client per day", async () => {
      const burst = "198.51.100.77";
      const limited: Awaited<ReturnType<typeof report>>[] = [];
      for (let i = 0; i < 8; i += 1) limited.push(await report({ note: String(i) }, {}, burst));
      expect(limited.filter((r) => r.status === 429)).toHaveLength(3);
      expect(limited.find((r) => r.status === 429)?.body["code"]).toBe("rate_limited");

      const ip = "198.51.100.88";
      const month = new Date().toISOString().slice(0, 7);
      const hash = hmac(`0123456789abcdef-salt|${month}`, `${ip}|vitest`);
      const qid = (await pool.query("SELECT id FROM questions WHERE external_id = $1", [pub]))
        .rows[0].id;
      await pool.query(
        "INSERT INTO question_reports (question_id, reason, client_hash) SELECT $1, 'offensive', $2 FROM generate_series(1, 20)",
        [qid, hash],
      );
      const capped = await report({ reason: "unclear" }, {}, ip);
      expect(capped.status).toBe(429);
      expect(await count("question_reports", `client_hash = '${hash}'`)).toBe(20);
    });
  });
});
