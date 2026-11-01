import { createPublicReader } from "@bj/data";
import pg from "pg";
import { buildApp, loggerOptions } from "./app";
import { loadServerConfig } from "./config";

async function run(): Promise<void> {
  const config = loadServerConfig();
  const reader = createPublicReader({ connectionString: config.databaseUrl, poolMax: 10 });
  const cmsPool = config.reportSalt
    ? new pg.Pool({ connectionString: config.databaseUrl, max: 5, statement_timeout: 30_000 })
    : undefined;
  const { app } = await buildApp({
    reader,
    internalToken: config.internalToken,
    ...(cmsPool && config.reportSalt ? { cms: { pool: cmsPool, salt: config.reportSalt } } : {}),
    rateLimitPerMinute: config.rateLimitPerMinute,
    logger: loggerOptions(config.logLevel),
  });
  const stop = (): void => {
    void app
      .close()
      .then(() => reader.close())
      .then(() => cmsPool?.end())
      .then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  await app.listen({ port: config.port, host: config.host });
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
