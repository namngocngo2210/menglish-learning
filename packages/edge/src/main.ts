import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { loadConfig } from "./config";
import { createEdge } from "./edge";
import { createLogger } from "./logger";
import { createHttpUpstream } from "./upstream";

const WARM_INTERVAL_MS = 10 * 60 * 1000;
const STATS_INTERVAL_MS = 60 * 1000;

async function waitForUpstream(probe: () => Promise<boolean>, attempts: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await probe()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function run(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger((line) => process.stdout.write(line));
  const fetchUpstream = createHttpUpstream(config.upstream, config.upstreamTimeoutMs);
  const edge = createEdge({ config, fetchUpstream, logger });

  let next: ChildProcess | undefined;
  if (config.spawnNext) {
    next = spawn(process.execPath, ["web/server.js"], {
      stdio: "inherit",
      env: { ...process.env, PORT: config.upstream.port || "3000", HOSTNAME: config.upstream.hostname },
    });
    next.on("exit", (code) => {
      logger.warn("next_exited", { code: code ?? -1 });
      process.exit(code ?? 1);
    });
  }

  const shutdown = (): void => {
    next?.kill("SIGTERM");
    void edge.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await new Promise<void>((resolve) => edge.server.listen(config.port, "0.0.0.0", resolve));
  logger.info("start", { port: config.port, spawnNext: config.spawnNext, purge: config.token !== undefined });

  setInterval(() => {
    logger.info("stats", { ...edge.stats, entries: edge.store.size, bytes: edge.store.bytes });
  }, STATS_INTERVAL_MS).unref();

  if (config.warmEnabled) {
    const ready = await waitForUpstream(async () => {
      try {
        return (await fetchUpstream({ method: "GET", path: "/readyz", headers: {} })).status === 200;
      } catch {
        return false;
      }
    }, 60);
    if (ready) void edge.warm();
    setInterval(() => {
      void edge.warm();
    }, WARM_INTERVAL_MS).unref();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
