// Runs ONE crawl job against a fake origin and prints peak RSS. Bundled and started by memory.test.ts
// with the production heap flag, so the measurement matches the container.
import pg from "pg";
import { runCrawlJob } from "../src/crawl";
import { claimJob } from "../src/queue";

const pool = new pg.Pool({ connectionString: process.env["CHILD_DB"], max: 2 });
const job = await claimJob(pool, "mem-worker");
if (!job) throw new Error("no job");
const counters = await runCrawlJob(
  {
    pool,
    cfg: { crawlDataDir: process.env["CHILD_DATA"] ?? "/tmp/bj-mem", heartbeatMs: 60_000 },
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    workerId: "mem-worker",
    gapMs: 0,
    fetchOptions: {
      testServer: { port: Number(process.env["CHILD_PORT"]) },
      resolver: () => Promise.resolve(["127.0.0.1"]),
    },
  },
  job,
);
await pool.end();
process.stdout.write(
  JSON.stringify({ maxRssMb: process.resourceUsage().maxRSS / 1024, ...counters }) + "\n",
);
