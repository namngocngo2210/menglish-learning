import { createHmac } from "node:crypto";
import type pg from "pg";
import { HttpProblem } from "../server/problems";
import { SCHEMAS } from "./schemas";
import { canTransition } from "./transitions";
import type { Entity } from "./transitions";

export type Row = Record<string, unknown>;
export type Db = pg.Pool | pg.PoolClient;
export type Resource = keyof typeof SCHEMAS;

/** Who is acting, for audit_log. The raw IP is never stored. */
export interface Actor {
  adminUserId: string;
  ipHash: string;
}

export const hmac = (secret: string, value: string): string =>
  createHmac("sha256", secret).update(value).digest("hex");

interface ResourceInfo {
  table: string;
  entity: Entity | null;
  /** Optimistic locking column present (If-Match). */
  versioned: boolean;
  /** Query-string filters -> column. */
  filters: Record<string, string>;
}

export const RESOURCES: Record<Resource, ResourceInfo> = {
  sources: { table: "sources", entity: null, versioned: false, filters: {} },
  passages: {
    table: "passages",
    entity: "passage",
    versioned: true,
    filters: { status: "review_status", source_id: "source_id" },
  },
  questions: {
    table: "questions",
    entity: "question",
    versioned: true,
    filters: {
      status: "review_status",
      grade: "grade",
      skill: "skill",
      topic_id: "topic_id",
      source_id: "source_id",
    },
  },
  tests: {
    table: "tests",
    entity: "test",
    versioned: true,
    filters: { status: "review_status", grade: "grade", skill: "skill", topic_id: "topic_id" },
  },
  "mixer-presets": { table: "mixer_presets", entity: null, versioned: false, filters: {} },
};

const JSON_COLUMNS = new Set(["options", "config"]);
// Column names below come from the strict zod schemas, never from raw request keys.
const encode = (key: string, value: unknown): unknown =>
  JSON_COLUMNS.has(key) ? JSON.stringify(value) : value;

export async function query(db: Db, text: string, params: unknown[] = []): Promise<Row[]> {
  return (await db.query<Row>(text, params)).rows;
}

export async function tx<T>(pool: pg.Pool, work: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

/** Constraint violations become clean problems; nothing from the SQL text leaks. */
export function mapDbError(error: unknown): unknown {
  const code = (error as { code?: string }).code;
  if (code === "23505")
    return new HttpProblem("conflict", "A row with these unique values already exists");
  if (code === "23503")
    return new HttpProblem("validation_failed", "Referenced row does not exist or is still in use");
  if (code === "23514") return new HttpProblem("validation_failed", "A database check failed");
  return error;
}

const first = (row: Row | undefined): Row => {
  if (!row) throw new HttpProblem("not_found");
  return row;
};

const scrub = (row: Row): Row => {
  const rest = { ...row };
  delete rest["stem_norm"];
  return rest;
};

export async function audit(
  c: Db,
  who: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  details: unknown,
): Promise<void> {
  await query(
    c,
    `INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, details, ip_hash)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [who.adminUserId, action, entityType, entityId, JSON.stringify(details), who.ipHash],
  );
}

async function snapshotRevisions(c: Db, ids: string[]): Promise<void> {
  await query(
    c,
    `INSERT INTO question_revisions (question_id, version, snapshot)
     SELECT id, version, to_jsonb(q) - 'stem_norm' FROM questions q WHERE id = ANY($1::bigint[])`,
    [ids],
  );
}

export async function list(
  pool: pg.Pool,
  name: Resource,
  q: { limit: number; cursor?: string | undefined; q?: string | undefined } & Record<
    string,
    unknown
  >,
): Promise<{ items: Row[]; next_cursor: string | null }> {
  const info = RESOURCES[name];
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (cond: string, value: unknown): void => {
    params.push(value);
    where.push(cond.replace("?", `$${String(params.length)}`));
  };
  for (const [param, column] of Object.entries(info.filters))
    if (q[param] !== undefined) add(`${column} = ?`, q[param]);
  if (name === "questions" && q.q !== undefined)
    add("strpos(stem_norm, lower(bj_unaccent(?))) > 0", q.q);
  if (q.cursor !== undefined) add("id > ?", q.cursor);
  params.push(q.limit + 1);
  const rows = await query(
    pool,
    `SELECT * FROM ${info.table} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY id LIMIT $${String(params.length)}`,
    params,
  );
  const more = rows.length > q.limit;
  const items = rows.slice(0, q.limit).map(scrub);
  return { items, next_cursor: more ? String(items[items.length - 1]?.["id"]) : null };
}

export async function get(db: Db, name: Resource, id: string, lock = false): Promise<Row> {
  const [row] = await query(
    db,
    `SELECT * FROM ${RESOURCES[name].table} WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  if (!row) throw new HttpProblem("not_found");
  return scrub(row);
}

async function replaceItems(
  c: Db,
  testId: string,
  items: { question_id: string; option_order: string }[],
): Promise<void> {
  await query(c, "DELETE FROM test_items WHERE test_id = $1", [testId]);
  for (const [position, item] of items.entries())
    await query(
      c,
      "INSERT INTO test_items (test_id, position, question_id, option_order) VALUES ($1,$2,$3,$4)",
      [testId, position, item.question_id, item.option_order],
    );
}

export async function create(
  pool: pg.Pool,
  name: Resource,
  body: unknown,
  who: Actor,
): Promise<Row> {
  const { items, ...data } = SCHEMAS[name].create.parse(body) as Row & {
    items?: { question_id: string; option_order: string }[];
  };
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  return tx(pool, async (c) => {
    const [row] = await query(
      c,
      `INSERT INTO ${RESOURCES[name].table} (${keys.join(", ")})
       VALUES (${keys.map((_, i) => `$${String(i + 1)}`).join(", ")}) RETURNING *`,
      keys.map((k) => encode(k, data[k])),
    );
    const id = String(row?.["id"]);
    if (name === "tests" && items) await replaceItems(c, id, items);
    await audit(c, who, `${name}.create`, name, id, { fields: keys });
    return scrub(first(row));
  });
}

export async function update(
  pool: pg.Pool,
  name: Resource,
  id: string,
  body: unknown,
  ifMatch: string | undefined,
  who: Actor,
): Promise<Row> {
  const info = RESOURCES[name];
  const { items, ...patch } = SCHEMAS[name].update.parse(body) as Row & {
    items?: { question_id: string; option_order: string }[];
  };
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (keys.length === 0 && !items) throw new HttpProblem("validation_failed", "Nothing to update");
  if (info.versioned && ifMatch === undefined)
    throw new HttpProblem(
      "validation_failed",
      "If-Match header with the current version is required",
    );
  return tx(pool, async (c) => {
    const row = await get(c, name, id, true);
    if (info.versioned && String(row["version"]) !== ifMatch)
      throw new HttpProblem("conflict", "Version mismatch: reload and retry");
    // Cross-field rules (4 options, correct key, entrance tests) apply to the merged result.
    const merged: Row = {};
    for (const k of Object.keys(SCHEMAS[name].update.shape)) if (k in row) merged[k] = row[k];
    SCHEMAS[name].create.parse({ ...merged, ...patch, ...(items ? { items } : {}) });
    if (name === "questions") await snapshotRevisions(c, [id]);
    const sets = keys.map((k, i) => `${k} = $${String(i + 2)}`);
    if (info.versioned) sets.push("version = version + 1");
    if (sets.length === 0) sets.push("updated_at = now()");
    const [updated] = await query(
      c,
      `UPDATE ${info.table} SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      [id, ...keys.map((k) => encode(k, patch[k]))],
    );
    if (name === "tests" && items) await replaceItems(c, id, items);
    await audit(c, who, `${name}.update`, name, id, {
      changed: items ? [...keys, "items"] : keys,
    });
    return scrub(first(updated));
  });
}

export async function remove(pool: pg.Pool, id: string, who: Actor): Promise<void> {
  await tx(pool, async (c) => {
    const rows = await query(c, "DELETE FROM mixer_presets WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) throw new HttpProblem("not_found");
    await audit(c, who, "mixer-presets.delete", "mixer-presets", id, {});
  });
}

interface Moving {
  id: string;
  review_status: string;
  slug?: string;
}

/** The only code path that changes review_status: state machine, revisions, audit and outbox in one transaction. */
async function moveRows(
  c: Db,
  name: Resource,
  rows: Moving[],
  to: string,
  note: string | undefined,
  who: Actor,
  bulk: boolean,
): Promise<void> {
  const entity = RESOURCES[name].entity;
  if (entity === null) throw new Error("Resource has no review status");
  const bad = rows.filter((r) => !canTransition(entity, r.review_status, to));
  if (bad.length > 0)
    throw new HttpProblem(
      "conflict",
      `Invalid transition to ${to} for ids: ${bad
        .slice(0, 20)
        .map((r) => `${r.id} (${r.review_status})`)
        .join(", ")}`,
    );
  const ids = rows.map((r) => r.id);
  if (entity === "test" && to === "published") {
    const [unpublished] = await query(
      c,
      `SELECT count(*)::int AS n FROM test_items ti JOIN questions q ON q.id = ti.question_id
       WHERE ti.test_id = ANY($1::bigint[]) AND q.review_status <> 'published'`,
      [ids],
    );
    if (Number(unpublished?.["n"]) > 0)
      throw new HttpProblem("conflict", "A test can only be published with published questions");
  }
  if (entity === "question") await snapshotRevisions(c, ids);
  const reviewCols = entity === "test" ? "" : ", review_note = $3, reviewed_at = now()";
  await query(
    c,
    `UPDATE ${RESOURCES[name].table}
     SET review_status = $2::text${reviewCols}, version = version + 1,
         published_at = CASE WHEN $2::text = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
     WHERE id = ANY($1::bigint[])`,
    entity === "test" ? [ids, to] : [ids, to, note ?? null],
  );
  const touched = rows.filter((r) => r.review_status === "published" || to === "published");
  if (touched.length > 0)
    await query(
      c,
      "INSERT INTO outbox_events (kind, payload) VALUES ($1, $2::jsonb)",
      entity === "test"
        ? ["purge_paths", JSON.stringify({ paths: touched.map((r) => `/${r.slug ?? ""}`) })]
        : ["rebuild", JSON.stringify({ entity, ids: touched.map((r) => r.id) })],
    );
  await audit(
    c,
    who,
    `${entity}.${bulk ? "bulk_transition" : "transition"}`,
    name,
    bulk ? null : (ids[0] ?? null),
    bulk
      ? { to, note, count: ids.length, ids: ids.slice(0, 200) }
      : { from: rows[0]?.review_status, to, note },
  );
}

export async function transition(
  pool: pg.Pool,
  name: Resource,
  id: string,
  to: string,
  note: string | undefined,
  who: Actor,
): Promise<Row> {
  return tx(pool, async (c) => {
    const row = (await get(c, name, id, true)) as unknown as Moving;
    await moveRows(c, name, [row], to, note, who, false);
    return get(c, name, id);
  });
}

export async function bulkTransition(
  pool: pg.Pool,
  name: Resource,
  body: {
    to: string;
    note?: string | undefined;
    expected_count: number;
    ids?: string[] | undefined;
    filter?: Record<string, unknown> | undefined;
  },
  who: Actor,
): Promise<{ count: number }> {
  return tx(pool, async (c) => {
    const params: unknown[] = [];
    const where: string[] = [];
    if (body.ids) {
      params.push([...new Set(body.ids)]);
      where.push("id = ANY($1::bigint[])");
    } else {
      const columns = { ...RESOURCES[name].filters };
      for (const [param, value] of Object.entries(body.filter ?? {})) {
        const column = columns[param];
        if (column === undefined || value === undefined) continue;
        params.push(value);
        where.push(`${column} = $${String(params.length)}`);
      }
    }
    const rows = (await query(
      c,
      `SELECT * FROM ${RESOURCES[name].table} WHERE ${where.join(" AND ")} ORDER BY id LIMIT 1001 FOR UPDATE`,
      params,
    )) as unknown as Moving[];
    if (rows.length > 1000)
      throw new HttpProblem("validation_failed", "Filter matches more than 1000 rows; narrow it");
    if (rows.length !== body.expected_count)
      throw new HttpProblem(
        "conflict",
        `expected_count mismatch: ${String(rows.length)} rows match, expected ${String(body.expected_count)}`,
      );
    await moveRows(c, name, rows, body.to, body.note, who, true);
    return { count: rows.length };
  });
}
