import { createPublicReader } from "@bj/data";
import pg from "pg";
import { createUnconfiguredMailer } from "../accounts/mailer";
import { createTurnstileVerifier } from "../accounts/captcha";
import { createSmtpMailer } from "../accounts/smtp";
import type { MailLog } from "../accounts/smtp";
import { buildApp, loggerOptions } from "./app";
import { loadServerConfig } from "./config";

async function run(): Promise<void> {
  const config = loadServerConfig();
  const mailConfig = config.mail;
  const mailLog: MailLog = (event, errorClass) =>
    process.stderr.write(
      `${JSON.stringify({ level: event === "mail_sent" ? 30 : 50, event, ...(errorClass ? { errorClass } : {}) })}\n`,
    );
  const reader = createPublicReader({ connectionString: config.databaseUrl, poolMax: 10 });
  const cmsPool =
    config.reportSalt || config.adminAuth || config.accounts
      ? new pg.Pool({ connectionString: config.databaseUrl, max: 5, statement_timeout: 30_000 })
      : undefined;
  const { app } = await buildApp({
    reader,
    internalToken: config.internalToken,
    ...(cmsPool && config.reportSalt ? { cms: { pool: cmsPool, salt: config.reportSalt } } : {}),
    ...(cmsPool && config.adminAuth ? { auth: { pool: cmsPool, ...config.adminAuth } } : {}),
    ...(cmsPool && config.accounts
      ? {
          accounts: {
            pool: cmsPool,
            hmacKey: config.accounts.hmacKey,
            origin: config.accounts.origin,
            ...(config.accounts.google ? { google: config.accounts.google } : {}),
            ...(config.accounts.turnstileSecret
              ? { captcha: createTurnstileVerifier(config.accounts.turnstileSecret) }
              : {}),
            // MAIL_TRANSPORT=smtp -> queued SMTP (ADR 0009); otherwise sends fail and are logged.
            mailer: mailConfig
              ? createSmtpMailer(mailConfig, { log: mailLog })
              : createUnconfiguredMailer(),
          },
        }
      : {}),
    ...(config.adminDist ? { adminDist: config.adminDist } : {}),
    rateLimitPerMinute: config.rateLimitPerMinute,
    trustProxy: config.trustProxy,
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
