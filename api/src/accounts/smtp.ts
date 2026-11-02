import { readFileSync } from "node:fs";
import type { Transporter } from "nodemailer";
import type { MailMessage, Mailer } from "./mailer";

/** Provider-neutral SMTP settings (docs/adr/0009). TLS is always required; there is no plain-text mode. */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
}

/** Logs event names and an error class only: never an address, password or message body. */
export type MailLog = (event: string, errorClass?: string) => void;

export interface SmtpOptions {
  log?: MailLog;
  connectTimeoutMs?: number;
  sendTimeoutMs?: number;
  /** Delay before retry n (1-based). */
  retryDelayMs?: (attempt: number) => number;
  maxRetries?: number;
  maxQueue?: number;
  /** Defaults to port 465; the override lets tests use a random port. */
  implicitTls?: boolean;
  /** Extra trusted CA (tests only); verification stays ON. */
  ca?: string;
}

export interface SmtpMailer extends Mailer {
  /** Sends now with retries and rejects with a redacted error; used by `mail:test`. */
  deliver(message: MailMessage): Promise<void>;
  /** Waits for queued mail, then closes the connection pool. */
  close(): Promise<void>;
}

type Env = Readonly<Record<string, string | undefined>>;

/** MAIL_TRANSPORT=smtp -> config; unset/none -> undefined. Errors name variables, never values. */
export function loadMailConfig(env: Env): SmtpConfig | undefined {
  const get = (name: string): string | undefined => {
    const value = env[name];
    return value === undefined || value === "" ? undefined : value;
  };
  const transport = get("MAIL_TRANSPORT") ?? "none";
  if (transport === "none") return undefined;
  if (transport !== "smtp") throw new Error("Invalid environment: MAIL_TRANSPORT (smtp or none)");
  const host = get("SMTP_HOST");
  const user = get("SMTP_USER");
  const passFile = get("SMTP_PASS_FILE");
  const from = get("MAIL_FROM");
  if (!host || !user || !passFile || !from) {
    const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS_FILE", "MAIL_FROM"].filter(
      (name) => get(name) === undefined,
    );
    throw new Error(`Missing environment: ${missing.join(", ")}`);
  }
  const port = Number(get("SMTP_PORT") ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid environment: SMTP_PORT");
  const replyTo = get("MAIL_REPLY_TO");
  if (/[\r\n]/.test(from) || /[\r\n]/.test(replyTo ?? ""))
    throw new Error("Invalid environment: MAIL_FROM or MAIL_REPLY_TO");
  // Google shows app passwords as four groups separated by spaces; the real password has none.
  const pass = readFileSync(passFile, "utf8").replace(/\s+/g, "");
  if (pass === "") throw new Error("Invalid environment: SMTP_PASS_FILE (empty)");
  return {
    host,
    port,
    user,
    pass,
    from,
    ...(replyTo ? { replyTo } : {}),
  };
}

/** Maps any failure to a short class (EAUTH, ETIMEDOUT, ...); the original message may echo addresses. */
export function errorClass(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,40}$/.test(code) ? code : "EUNKNOWN";
}

const permanent = (error: unknown): boolean => {
  const status = (error as { responseCode?: unknown } | null)?.responseCode;
  return errorClass(error) === "EAUTH" || (typeof status === "number" && status >= 500);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createSmtpMailer(config: SmtpConfig, options: SmtpOptions = {}): SmtpMailer {
  const log = options.log ?? (() => undefined);
  const maxRetries = options.maxRetries ?? 2;
  const maxQueue = options.maxQueue ?? 100;
  const delay = options.retryDelayMs ?? ((attempt: number) => 2000 * attempt);
  // Loaded on first use so an api without mail configured pays no memory for nodemailer.
  let created: Promise<Transporter> | undefined;
  const getTransport = (): Promise<Transporter> =>
    (created ??= import("nodemailer").then(({ default: nodemailer }) =>
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: options.implicitTls ?? config.port === 465, // implicit TLS; otherwise STARTTLS is mandatory below
        requireTLS: true,
        auth: { user: config.user, pass: config.pass },
        tls: {
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          ...(options.ca ? { ca: options.ca } : {}),
        },
        connectionTimeout: options.connectTimeoutMs ?? 10_000,
        greetingTimeout: options.connectTimeoutMs ?? 10_000,
        socketTimeout: options.sendTimeoutMs ?? 20_000,
        pool: true,
        maxConnections: 1,
      }),
    ));

  async function deliver(message: MailMessage): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await (
          await getTransport()
        ).sendMail({
          from: config.from,
          ...(config.replyTo ? { replyTo: config.replyTo } : {}),
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        return;
      } catch (error) {
        const cls = errorClass(error);
        if (permanent(error) || attempt >= maxRetries) {
          log("mail_send_failed", cls);
          throw Object.assign(new Error(`mail_${cls}`), { name: `mail_${cls}`, code: cls });
        }
        log("mail_retry", cls);
        await sleep(delay(attempt + 1));
      }
    }
  }

  // One worker drains the queue so handlers return at once and SMTP sees one message at a time.
  const queue: MailMessage[] = [];
  let draining: Promise<void> | undefined;
  const drain = async (): Promise<void> => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      await deliver(next).then(
        () => {
          log("mail_sent");
        },
        () => undefined, // already logged by deliver
      );
    }
    draining = undefined;
  };

  return {
    deliver,
    send(message) {
      if (queue.length >= maxQueue) {
        log("mail_queue_full");
        return Promise.reject(
          Object.assign(new Error("mail_queue_full"), { name: "mail_queue_full" }),
        );
      }
      queue.push(message);
      draining ??= drain();
      return Promise.resolve();
    },
    async close() {
      await draining;
      if (created) (await created).close();
    },
  };
}
