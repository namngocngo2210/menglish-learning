import { randomUUID } from "node:crypto";
import http from "node:http";
import pg from "pg";
import { loadConfig } from "./config";
import { importOcr } from "./import-ocr";
import { createLogger } from "./log";
import { edgePoster } from "./outbox";
import { tick } from "./runner";

const log = createLogger();
const command = process.argv[2] ?? "run";

function fatal(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function run(): Promise<void> {
  const cfg = (() => {
    try {
      return loadConfig();
    } catch (error) {
      return fatal(error instanceof Error ? error.message : "invalid configuration");
    }
  })();
  const pool = new pg.Pool({
    connectionString: cfg.databaseUrl,
    max: 3,
    statement_timeout: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // An idle client dies when postgres restarts; without a listener Node exits (found by the S-F chaos run).
  pool.on("error", (error) => {
    log.warn("pg_pool_error", { reason: error.message });
  });
  const workerId = `worker-${randomUUID()}`;
  const post =
    cfg.edgePurgeUrl !== undefined && cfg.edgePurgeToken !== undefined
      ? edgePoster(cfg.edgePurgeUrl, cfg.edgePurgeToken)
      : undefined;
  if (post === undefined) log.warn("outbox_disabled", { reason: "EDGE_PURGE_URL/TOKEN not set" });

  const health = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200).end("ok");
      return;
    }
    if (req.url === "/readyz") {
      Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("timeout"));
          }, 1000);
        }),
      ])
        .then(() => {
          res.writeHead(200).end("ok");
        })
        .catch(() => {
          res.writeHead(503).end("db unavailable");
        });
      return;
    }
    res.writeHead(404).end();
  });
  health.listen(cfg.healthPort, "127.0.0.1");

  const state = { stopping: false };
  const stop = (): void => {
    state.stopping = true;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  log.info("worker_started", { workerId });
  let lastReap = 0;
  while (!state.stopping) {
    try {
      // The reaper runs inside tick(); throttle by skipping nothing - it is one cheap UPDATE per loop.
      const r = await tick({ pool, cfg, log, workerId, post });
      lastReap = Date.now();
      if (r.ranJob) continue; // drain the queue before sleeping
    } catch (error) {
      log.error("tick_failed", { reason: error instanceof Error ? error.message : "unknown" });
    }
    await new Promise((resolve) => setTimeout(resolve, cfg.pollIntervalMs));
  }
  log.info("worker_stopped", { lastTickAt: lastReap });
  health.close();
  await pool.end();
}

async function ocr(): Promise<void> {
  const cfg = loadConfig();
  const dirFlag = process.argv.indexOf("--dir");
  const dir = dirFlag > 0 ? (process.argv[dirFlag + 1] ?? "crawler/ocr") : "crawler/ocr";
  const pool = new pg.Pool({ connectionString: cfg.databaseUrl, max: 1 });
  try {
    const r = await importOcr(pool, dir);
    log.info("import_ocr_done", { files: r.files, inserted: r.inserted, ...r.skipped });
    if (r.inserted === 0 && Object.keys(r.skipped).length > 0)
      process.stderr.write(
        "Nothing inserted: create/enable the official-exam source in the CMS first.\n",
      );
  } finally {
    await pool.end();
  }
}

try {
  if (command === "run") await run();
  else if (command === "import-ocr") await ocr();
  else fatal("Usage: main.mjs run | import-ocr [--dir <path>]");
} catch (error) {
  fatal(error instanceof Error ? error.message : "worker failed");
}
