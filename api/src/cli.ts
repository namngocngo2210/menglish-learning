import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
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

Environment: DATABASE_URL or DATABASE_URL_FILE.`;

const json = (value: unknown): string => JSON.stringify(value, null, 2);

/** Runs one CLI invocation. Returns the process exit code; never calls process.exit itself. */
export async function main(
  argv: readonly string[],
  io: Io,
  env: Readonly<Record<string, string | undefined>>,
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
