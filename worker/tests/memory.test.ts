import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createWorkerDb, listen, voaHandler } from "./helpers";
import type { TestDb } from "./helpers";

const WORKER_CAP_MB = 320; // decision D8
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

describe.skipIf(ADMIN_URL === undefined)("worker memory", () => {
  let db: TestDb;
  let origin: { port: number; close(): Promise<void> };
  beforeAll(async () => {
    db = await createWorkerDb();
    // 100 articles of roughly 40 KB each (the crawl limit cap).
    origin = await listen(voaHandler(100, 75));
  });
  afterAll(async () => {
    await origin.close();
    await db.remove();
  });

  it("keeps peak RSS of a 100-article job under the 320 MB worker cap with the production heap flag", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bj-mem-"));
    const bundle = join(dir, "child.mjs");
    buildSync({
      entryPoints: [here("./memory-child.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: bundle,
      external: ["pg-native"],
      alias: { "@crawler": here("../../crawler/src/lib.ts") },
      banner: {
        js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
      },
      logLevel: "silent",
    });
    await db.admin.query(
      "INSERT INTO crawl_jobs (source_id, params) SELECT id, '{\"limit\":100}' FROM sources WHERE code = 'voa-learning-english'",
    );
    const { stdout: out } = await promisify(execFile)(
      "node",
      ["--max-old-space-size=224", bundle],
      {
        env: {
          ...process.env,
          CHILD_DB: db.url,
          CHILD_PORT: String(origin.port),
          CHILD_DATA: join(dir, "data"),
        },
        encoding: "utf8",
        maxBuffer: 1 << 20,
      },
    );
    const result = JSON.parse(out.trim().split("\n").at(-1) ?? "{}") as {
      maxRssMb: number;
      fetched: number;
      quarantined: number;
    };
    process.stdout.write(
      `MEASURED worker peak RSS: ${result.maxRssMb.toFixed(0)} MB (cap ${String(WORKER_CAP_MB)} MB), ${String(result.fetched)} fetched, ${String(result.quarantined)} quarantined\n`,
    );
    expect(result.fetched).toBeGreaterThanOrEqual(100);
    expect(result.quarantined).toBeGreaterThan(0);
    expect(result.maxRssMb).toBeLessThan(WORKER_CAP_MB);
  }, 280_000);
});
