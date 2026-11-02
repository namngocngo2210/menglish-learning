import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { purgeExpired, reapplyDeletions } from "../src/accounts/maintenance";
import { hmacHex } from "../src/admin/crypto";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

const KEY = "k".repeat(48);
const ref = (kind: string, id: string): string => hmacHex(KEY, `${kind}:${id}`);

describe.skipIf(ADMIN_URL === undefined)("account maintenance (PostgreSQL)", () => {
  let db: TestDb;
  let pool: pg.Pool;

  beforeAll(async () => {
    db = await createMigratedDb();
    pool = new pg.Pool({ connectionString: db.url, max: 2 });
  }, 120_000);
  afterAll(async () => {
    await pool.end();
    await db.remove();
  });

  it("purges only data past retention", async () => {
    const now = new Date("2026-12-01T00:00:00Z");
    const day = (d: number): Date => new Date(now.getTime() - d * 24 * 3600_000);
    const u = await pool.query<{ id: string }>(
      "INSERT INTO users (username, email, email_verified_at, status) VALUES ('muser','m@example.test',now(),'active') RETURNING id::text",
    );
    const uid = u.rows[0]?.id;
    for (const [d, ok] of [
      [40, false],
      [5, true],
    ] as const)
      await pool.query(
        "INSERT INTO login_attempts (key_hash, success, created_at) VALUES ($1,$2,$3)",
        [`k${String(d)}`, ok, day(d)],
      );
    for (const [name, exp] of [
      ["old", 40],
      ["fresh", -1],
    ] as const)
      await pool.query(
        "INSERT INTO user_tokens (user_id, purpose, token_sha256, expires_at) VALUES ($1,'verify_email',$2,$3)",
        [uid, name, day(exp)],
      );
    for (const [name, abs] of [
      ["old", 40],
      ["live", -20],
    ] as const)
      await pool.query(
        "INSERT INTO user_sessions (id, user_id, csrf_secret, expires_at, absolute_expires_at) VALUES ($1,$2,'c',$3,$3)",
        [name, uid, day(abs)],
      );
    for (const [e, d] of [
      ["user", 400],
      ["user", 10],
      ["admin", 400],
    ] as const)
      await pool.query(
        "INSERT INTO audit_log (action, entity_type, created_at) VALUES ('x',$1,$2)",
        [e, day(d)],
      );

    expect(await purgeExpired(pool, now)).toEqual({
      login_attempts: 1,
      user_tokens: 1,
      user_sessions: 1,
      audit_log: 1,
    });
    expect((await pool.query("SELECT count(*)::int AS n FROM audit_log")).rows[0]).toEqual({
      n: 2,
    });
    expect((await pool.query("SELECT id FROM user_sessions")).rows).toEqual([{ id: "live" }]);
  });

  it("re-applies deletions to a restored backup and leaves everyone else alone", async () => {
    await pool.query("TRUNCATE users RESTART IDENTITY CASCADE");
    const ids: string[] = [];
    for (const email of ["a@example.test", "b@example.test", "c@example.test"])
      ids.push(
        (
          await pool.query<{ id: string }>(
            "INSERT INTO users (username, email, email_verified_at, status) VALUES ('user' || split_part($1,'@',1),$1,now(),'active') RETURNING id::text",
            [email],
          )
        ).rows[0]?.id ?? "",
      );
    const prof: string[] = [];
    for (const [uid, nick] of [
      [ids[1], "Bông Sen"],
      [ids[1], "Hoa Mai"],
      [ids[2], "Sao Mai"],
    ] as const)
      prof.push(
        (
          await pool.query<{ external_id: string }>(
            "INSERT INTO profiles (user_id, nickname, grade) VALUES ($1,$2,6) RETURNING external_id",
            [uid, nick],
          )
        ).rows[0]?.external_id ?? "",
      );

    const out = await reapplyDeletions(pool, KEY, [
      { userRef: ref("user", ids[0] ?? ""), scope: "account", targetRef: null },
      {
        userRef: ref("user", ids[1] ?? ""),
        scope: "profile",
        targetRef: ref("profile", prof[0] ?? ""),
      },
      { userRef: ref("user", "999"), scope: "account", targetRef: null },
    ]);
    expect(out).toEqual({ users: 1, profiles: 1 });
    expect(
      (await pool.query("SELECT email FROM users ORDER BY id")).rows.map((r) => r.email),
    ).toEqual(["b@example.test", "c@example.test"]);
    expect(
      (await pool.query("SELECT nickname FROM profiles ORDER BY id")).rows.map((r) => r.nickname),
    ).toEqual(["Hoa Mai", "Sao Mai"]);
    expect(await reapplyDeletions(pool, KEY, [])).toEqual({ users: 0, profiles: 0 });
  });
});
