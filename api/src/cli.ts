import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pg from "pg";
import { createAdmin, readHidden } from "./admin/create";
import { purgeExpired, reapplyDeletions } from "./accounts/maintenance";
import type { DeletionRef } from "./accounts/maintenance";
import type { TtyIn, TtyOut } from "./admin/create";
import { loadConfig } from "./config";
import { connect } from "./db/connection";
import { readContentDir } from "./import/files";
import { compareSnapshot, diffSummaries, summarizeDatabase, summarizePlan } from "./import/parity";
import { buildPlan } from "./import/plan";
import { applyPlan } from "./import/write";
import { migrate } from "./migrate";
import { exportSnapshot } from "./snapshot/export";
import { writeSnapshot } from "./snapshot/write";

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

const DEFAULT_CONTENT_DIR = fileURLToPath(new URL("../../web/content", import.meta.url));

const USAGE = `Usage: bj <command> [options]

Commands:
  migrate [--down --count N | --down --all]   Apply (default) or revert SQL migrations
  import [--content-dir DIR] [--dry-run]      Idempotent import of the seed JSON (quarantine + published)
  parity [--content-dir DIR]                  Import-parity report; exit 1 on any difference
  export-snapshot --out DIR                   Write the published content as a ContentBundle
  admin:create <email>                        Create the single owner account (password typed at the TTY)
  accounts:purge-expired                      Delete account data past retention (run daily as the owner DB role)
  accounts:reapply-deletions --file F.json    After restoring an OLD backup: re-delete accounts/profiles listed in F
                                              (needs USER_SESSION_HMAC_KEY or USER_SESSION_HMAC_KEY_FILE)

Environment: DATABASE_URL or DATABASE_URL_FILE.`;

const json = (value: unknown): string => JSON.stringify(value, null, 2);

/** Runs one CLI invocation. Returns the process exit code; never calls process.exit itself. */
export async function main(
  argv: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
  tty: { input: TtyIn; output: TtyOut } = { input: process.stdin, output: process.stdout },
): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || command === "--help") {
    io.out(USAGE);
    return command === undefined ? 2 : 0;
  }
  try {
    switch (command) {
      case "migrate":
        return await runMigrate(rest, io, env);
      case "import":
        return await runImport(rest, io, env);
      case "parity":
        return await runParity(rest, io, env);
      case "export-snapshot":
        return await runExport(rest, io, env);
      case "admin:create":
        return await runAdminCreate(rest, io, env, tty);
      case "accounts:purge-expired":
        return await runAccountsMaintenance(rest, io, env, "purge");
      case "accounts:reapply-deletions":
        return await runAccountsMaintenance(rest, io, env, "reapply");
      default:
        io.err(`Unknown command: ${command}\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runMigrate(
  args: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { down: { type: "boolean" }, count: { type: "string" }, all: { type: "boolean" } },
    strict: true,
  });
  const direction = values.down === true ? "down" : "up";
  let count: number | undefined;
  if (values.count !== undefined) {
    count = Number(values.count);
    if (!Number.isInteger(count) || count < 1)
      throw new Error("--count must be a positive integer");
  }
  if (direction === "down" && count === undefined && values.all !== true) {
    throw new Error("Refusing to revert everything: pass --count N or --all");
  }
  const names = await migrate(loadConfig(env).databaseUrl, {
    direction,
    ...(env["MIGRATIONS_DIR"] === undefined ? {} : { dir: env["MIGRATIONS_DIR"] }),
    ...(count === undefined ? {} : { count }),
  });
  io.out(
    `${direction}: ${names.length} migration(s)${names.length ? ` (${names.join(", ")})` : ""}`,
  );
  return 0;
}

async function runImport(
  args: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { "content-dir": { type: "string" }, "dry-run": { type: "boolean" } },
    strict: true,
  });
  const plan = buildPlan(readContentDir(values["content-dir"] ?? DEFAULT_CONTENT_DIR));
  const handle = connect(loadConfig(env).databaseUrl);
  try {
    const report = await applyPlan(handle.db, plan, { dryRun: values["dry-run"] === true });
    io.out(json(report));
  } finally {
    await handle.close();
  }
  return 0;
}

async function runParity(
  args: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { "content-dir": { type: "string" } },
    strict: true,
  });
  const files = readContentDir(values["content-dir"] ?? DEFAULT_CONTENT_DIR);
  const plan = buildPlan(files);
  const expected = summarizePlan(plan);
  const handle = connect(loadConfig(env).databaseUrl);
  try {
    const actual = await summarizeDatabase(handle.db);
    const differences = diffSummaries(expected, actual);
    const roundTrip = compareSnapshot(await exportSnapshot(handle.db), files);
    io.out(
      json({
        counts: { expected: expected.counts, database: actual.counts },
        textDigest: { expected: expected.textDigest, database: actual.textDigest },
        differences: differences.length,
        differenceSamples: differences.slice(0, 20),
        snapshotRoundTrip: roundTrip,
      }),
    );
    return differences.length === 0 && roundTrip.differences === 0 ? 0 : 1;
  } finally {
    await handle.close();
  }
}

/** `accounts:purge-expired` and `accounts:reapply-deletions`: run as the owner DB role (audit_log DELETE). */
async function runAccountsMaintenance(
  args: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
  task: "purge" | "reapply",
): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { file: { type: "string" } },
    strict: true,
  });
  let key = "";
  let refs: DeletionRef[] = [];
  if (task === "reapply") {
    const keyFile = env["USER_SESSION_HMAC_KEY_FILE"];
    key = (keyFile ? readFileSync(keyFile, "utf8") : (env["USER_SESSION_HMAC_KEY"] ?? "")).trim();
    if (key.length < 32)
      throw new Error("Missing environment: USER_SESSION_HMAC_KEY or USER_SESSION_HMAC_KEY_FILE");
    if (values.file === undefined) throw new Error("--file is required");
    refs = JSON.parse(readFileSync(values.file, "utf8")) as DeletionRef[];
    if (!Array.isArray(refs)) throw new Error("--file must hold a JSON array");
  }
  const pool = new pg.Pool({ connectionString: loadConfig(env).databaseUrl, max: 1 });
  try {
    io.out(
      json(task === "purge" ? await purgeExpired(pool) : await reapplyDeletions(pool, key, refs)),
    );
  } finally {
    await pool.end();
  }
  return 0;
}

/** `admin:create <email>`: the password is read from the TTY only (D7), never from argv, env or files. */
async function runAdminCreate(
  args: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
  tty: { input: TtyIn; output: TtyOut },
): Promise<number> {
  const { positionals } = parseArgs({ args: [...args], options: {}, allowPositionals: true });
  const email = positionals[0];
  if (positionals.length !== 1 || email === undefined)
    throw new Error("Usage: admin:create <email>");
  const databaseUrl = loadConfig(env).databaseUrl;
  const password = await readHidden("Password: ", tty.input, tty.output);
  const again = await readHidden("Repeat password: ", tty.input, tty.output);
  if (password !== again) throw new Error("Passwords do not match");
  await createAdmin(databaseUrl, email, password);
  io.out("Admin account created.");
  return 0;
}

async function runExport(
  args: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { out: { type: "string" } },
    strict: true,
  });
  if (values.out === undefined) throw new Error("export-snapshot requires --out DIR");
  const handle = connect(loadConfig(env).databaseUrl);
  try {
    const manifest = writeSnapshot(values.out, await exportSnapshot(handle.db));
    io.out(json(manifest));
  } finally {
    await handle.close();
  }
  return 0;
}
