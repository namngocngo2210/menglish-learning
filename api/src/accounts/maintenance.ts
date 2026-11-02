import type pg from "pg";
import { hmacHex } from "../admin/crypto";

const DAY = 24 * 3600_000;

/** One row of `deletion_requests`, exported from the live database before an old backup is restored. */
export interface DeletionRef {
  userRef: string;
  scope: "profile" | "account";
  targetRef: string | null;
}

/**
 * Drops account data past its retention (docs/user-accounts.md section 3): attempts 30 days, spent or
 * expired tokens and dead sessions 30 days, account audit rows 12 months. Needs a role that may DELETE from
 * audit_log (the owner/superuser CLI role, not bj_api).
 */
export async function purgeExpired(
  pool: pg.Pool,
  now = new Date(),
): Promise<Record<string, number>> {
  const ago = (days: number): Date => new Date(now.getTime() - days * DAY);
  const run = async (sql: string, cutoff: Date): Promise<number> =>
    (await pool.query(sql, [cutoff])).rowCount ?? 0;
  return {
    login_attempts: await run("DELETE FROM login_attempts WHERE created_at < $1", ago(30)),
    user_tokens: await run(
      "DELETE FROM user_tokens WHERE COALESCE(used_at, expires_at) < $1",
      ago(30),
    ),
    user_sessions: await run(
      "DELETE FROM user_sessions WHERE LEAST(COALESCE(revoked_at, absolute_expires_at), absolute_expires_at) < $1",
      ago(30),
    ),
    audit_log: await run(
      "DELETE FROM audit_log WHERE entity_type = 'user' AND created_at < $1",
      ago(365),
    ),
  };
}

/**
 * After restoring an OLD backup, deletes again whatever the live database had already deleted: accounts
 * whose HMAC pseudonym is in `refs` (rows cascade) and profiles listed by `targetRef`. Nothing is logged.
 */
export async function reapplyDeletions(
  pool: pg.Pool,
  hmacKey: string,
  refs: readonly DeletionRef[],
): Promise<{ users: number; profiles: number }> {
  const accounts = new Set(refs.filter((r) => r.scope === "account").map((r) => r.userRef));
  const profiles = new Set(
    refs.flatMap((r) => (r.scope === "profile" && r.targetRef !== null ? [r.targetRef] : [])),
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const users = (await client.query<{ id: string }>("SELECT id::text FROM users")).rows
      .filter((u) => accounts.has(hmacHex(hmacKey, `user:${u.id}`)))
      .map((u) => u.id);
    const gone = (
      await client.query<{ external_id: string }>("SELECT external_id FROM profiles")
    ).rows
      .filter((p) => profiles.has(hmacHex(hmacKey, `profile:${p.external_id}`)))
      .map((p) => p.external_id);
    await client.query("DELETE FROM profiles WHERE external_id = ANY($1::uuid[])", [gone]);
    await client.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [users]);
    await client.query("COMMIT");
    return { users: users.length, profiles: gone.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
