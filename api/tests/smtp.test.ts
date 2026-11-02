import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../src/cli";
import { createSmtpMailer, errorClass, loadMailConfig } from "../src/accounts/smtp";
import type { SmtpConfig } from "../src/accounts/smtp";

const PASSWORD = ["s3cret", "App", "Passw0rd"].join("-");
const RECIPIENT = "parent.private@example.org";
const BODY = "link-body-token-12345";

let dir: string;
let cert: string;
let key: string;

interface Behaviour {
  implicitTls?: boolean;
  noStarttls?: boolean;
  badAuth?: boolean;
  silent?: boolean;
  /** Reply 451 to the first N MAIL FROM commands. */
  transientFailures?: number;
}

/** Minimal SMTP server speaking just enough of RFC 5321 for nodemailer. */
async function fakeSmtp(behaviour: Behaviour) {
  const received: string[] = [];
  let mailFromCount = 0;
  const handle = (initial: net.Socket): void => {
    let socket: net.Socket = initial;
    let buffer = "";
    let data = false;
    let message = "";
    const reply = (line: string): void => void socket.write(`${line}\r\n`);
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString("utf8");
      for (let at = buffer.indexOf("\r\n"); at >= 0; at = buffer.indexOf("\r\n")) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        if (data) {
          if (line === ".") {
            data = false;
            received.push(message);
            reply("250 queued");
          } else message += `${line}\n`;
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO")) {
          const secure = socket instanceof tls.TLSSocket;
          reply(
            `250-fake\r\n${!secure && !behaviour.noStarttls ? "250-STARTTLS\r\n" : ""}250 AUTH PLAIN LOGIN`,
          );
        } else if (cmd === "STARTTLS" && behaviour.noStarttls) {
          reply("502 not offered");
        } else if (cmd === "STARTTLS") {
          reply("220 go");
          socket.removeListener("data", onData);
          const upgraded = new tls.TLSSocket(socket, { isServer: true, cert, key });
          socket = upgraded;
          upgraded.on("data", onData);
          upgraded.on("error", () => undefined);
        } else if (cmd.startsWith("AUTH")) {
          const ok =
            !behaviour.badAuth &&
            Buffer.from(line.split(" ")[2] ?? "", "base64")
              .toString()
              .endsWith(PASSWORD);
          reply(ok ? "235 ok" : "535 5.7.8 bad credentials");
        } else if (cmd.startsWith("MAIL FROM")) {
          mailFromCount += 1;
          reply(mailFromCount <= (behaviour.transientFailures ?? 0) ? "451 try later" : "250 ok");
        } else if (cmd.startsWith("RCPT") || cmd === "RSET") reply("250 ok");
        else if (cmd === "DATA") {
          data = true;
          message = "";
          reply("354 go");
        } else if (cmd === "QUIT") {
          reply("221 bye");
          socket.end();
        } else reply("502 no");
      }
    };
    socket.on("data", onData);
    socket.on("error", () => undefined);
    if (!behaviour.silent) reply("220 fake ESMTP");
  };
  const server = behaviour.implicitTls
    ? tls.createServer({ cert, key }, handle)
    : net.createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as net.AddressInfo).port,
    received,
    mailFromCount: () => mailFromCount,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

const config = (port: number): SmtpConfig => ({
  host: "localhost",
  port,
  user: "bot@example.org",
  pass: PASSWORD,
  from: "BeeJunior <bot@example.org>",
});
const message = { to: RECIPIENT, subject: "Xác minh", text: `Open ${BODY}` };
const fast = { retryDelayMs: () => 0, connectTimeoutMs: 400, sendTimeoutMs: 400 };

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "bj-smtp-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost",
      "-keyout",
      join(dir, "k.pem"),
      "-out",
      join(dir, "c.pem"),
    ],
    { stdio: "ignore" },
  );
  cert = readFileSync(join(dir, "c.pem"), "utf8");
  key = readFileSync(join(dir, "k.pem"), "utf8");
});

afterAll(() => undefined);

describe("smtp mailer", () => {
  it("delivers over STARTTLS (default mode)", async () => {
    const server = await fakeSmtp({});
    const mailer = createSmtpMailer(config(server.port), { ...fast, ca: cert });
    await mailer.deliver(message);
    await mailer.close();
    expect(server.received).toHaveLength(1);
    expect(server.received[0]).toContain(BODY);
    await server.close();
  });

  it("queues send() without waiting for SMTP and logs only event names", async () => {
    const server = await fakeSmtp({});
    const logs: unknown[][] = [];
    const mailer = createSmtpMailer(config(server.port), {
      ...fast,
      ca: cert,
      log: (...args) => logs.push(args),
    });
    await mailer.send(message);
    expect(server.received).toHaveLength(0); // returned before delivery
    await mailer.close();
    expect(server.received).toHaveLength(1);
    expect(logs).toEqual([["mail_sent"]]);
    await server.close();
  });

  it("rejects a server without STARTTLS (TLS is required, never plain)", async () => {
    const server = await fakeSmtp({ noStarttls: true });
    const mailer = createSmtpMailer(config(server.port), { ...fast, ca: cert, maxRetries: 0 });
    await expect(mailer.deliver(message)).rejects.toBeDefined();
    expect(server.received).toHaveLength(0);
    await mailer.close();
    await server.close();
  });

  it("verifies the certificate: an untrusted self-signed server is refused", async () => {
    const server = await fakeSmtp({});
    const mailer = createSmtpMailer(config(server.port), { ...fast, maxRetries: 0 }); // no ca
    await expect(mailer.deliver(message)).rejects.toBeDefined();
    expect(server.received).toHaveLength(0);
    await mailer.close();
    await server.close();
  });

  it("does not retry an authentication failure and redacts the error", async () => {
    const server = await fakeSmtp({ badAuth: true });
    const logs: unknown[][] = [];
    const mailer = createSmtpMailer(config(server.port), {
      ...fast,
      ca: cert,
      log: (...args) => logs.push(args),
    });
    const error = (await mailer.deliver(message).catch((e: unknown) => e)) as Error;
    expect(errorClass(error)).toBe("EAUTH");
    expect(error.message + error.name).not.toMatch(/credentials|bot@example/);
    expect(logs).toEqual([["mail_send_failed", "EAUTH"]]);
    await mailer.close();
    await server.close();
  });

  it("retries transient failures at most twice, then succeeds or gives up", async () => {
    const recovering = await fakeSmtp({ transientFailures: 2 });
    const a = createSmtpMailer(config(recovering.port), { ...fast, ca: cert });
    await a.deliver(message);
    expect(recovering.received).toHaveLength(1);
    expect(recovering.mailFromCount()).toBe(3);
    await a.close();
    await recovering.close();

    const failing = await fakeSmtp({ transientFailures: 99 });
    const logs: unknown[][] = [];
    const b = createSmtpMailer(config(failing.port), {
      ...fast,
      ca: cert,
      log: (...x) => logs.push(x),
    });
    await expect(b.deliver(message)).rejects.toBeDefined();
    expect(failing.mailFromCount()).toBe(3); // 1 try + 2 retries
    expect(logs.map((l) => l[0])).toEqual(["mail_retry", "mail_retry", "mail_send_failed"]);
    await b.close();
    await failing.close();
  });

  it("times out on a server that never greets", async () => {
    const server = await fakeSmtp({ silent: true });
    const mailer = createSmtpMailer(config(server.port), { ...fast, ca: cert, maxRetries: 0 });
    await expect(mailer.deliver(message)).rejects.toMatchObject({ code: "ETIMEDOUT" });
    await mailer.close();
    await server.close();
  });

  it("supports implicit TLS (port 465 mode)", async () => {
    const server = await fakeSmtp({ implicitTls: true });
    const mailer = createSmtpMailer(config(server.port), { ...fast, ca: cert, implicitTls: true });
    await mailer.deliver(message);
    expect(server.received).toHaveLength(1);
    // The same server refuses a STARTTLS-mode client: it never falls back to plain text.
    const starttls = createSmtpMailer(config(server.port), { ...fast, ca: cert, maxRetries: 0 });
    await expect(starttls.deliver(message)).rejects.toBeDefined();
    await starttls.close();
    await mailer.close();
    await server.close();
  });

  it("never writes the password, recipient or body to logs", async () => {
    const server = await fakeSmtp({ badAuth: true });
    const lines: string[] = [];
    const mailer = createSmtpMailer(config(server.port), {
      ...fast,
      ca: cert,
      log: (event, cls) => lines.push(JSON.stringify({ event, cls })),
    });
    await mailer.send(message);
    await mailer.close();
    const all = lines.join("\n");
    for (const secret of [PASSWORD, RECIPIENT, BODY]) expect(all).not.toContain(secret);
    expect(all).toContain("mail_send_failed");
    await server.close();
  });

  it("bounds the queue so a flood cannot grow memory", async () => {
    const server = await fakeSmtp({ silent: true });
    const mailer = createSmtpMailer(config(server.port), {
      ...fast,
      ca: cert,
      maxRetries: 0,
      maxQueue: 1,
    });
    await mailer.send(message); // taken by the worker, which then blocks on the silent server
    await mailer.send(message); // fills the queue
    await expect(mailer.send(message)).rejects.toMatchObject({ name: "mail_queue_full" });
    await mailer.close();
    await server.close();
  });
});

describe("loadMailConfig", () => {
  it("is off unless MAIL_TRANSPORT=smtp", () => {
    expect(loadMailConfig({})).toBeUndefined();
    expect(loadMailConfig({ MAIL_TRANSPORT: "none" })).toBeUndefined();
    expect(() => loadMailConfig({ MAIL_TRANSPORT: "plain" })).toThrow("MAIL_TRANSPORT");
  });

  it("names missing variables, defaults to 587 and strips spaces from the app password", () => {
    expect(() => loadMailConfig({ MAIL_TRANSPORT: "smtp" })).toThrow(
      "SMTP_HOST, SMTP_USER, SMTP_PASS_FILE, MAIL_FROM",
    );
    const file = join(dir, "smtp_pass");
    writeFileSync(file, "abcd efgh ijkl mnop\n");
    const cfg = loadMailConfig({
      MAIL_TRANSPORT: "smtp",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "u@gmail.com",
      SMTP_PASS_FILE: file,
      MAIL_FROM: "BeeJunior <u@gmail.com>",
    });
    expect(cfg).toMatchObject({ port: 587, pass: "abcdefghijklmnop" });
  });

  it("rejects header injection and a bad port without echoing values", () => {
    const file = join(dir, "smtp_pass2");
    writeFileSync(file, PASSWORD);
    const base = {
      MAIL_TRANSPORT: "smtp",
      SMTP_HOST: "h",
      SMTP_USER: "u",
      SMTP_PASS_FILE: file,
      MAIL_FROM: "a@b.c",
    };
    expect(() => loadMailConfig({ ...base, MAIL_FROM: "a@b.c\r\nBcc: x@y.z" })).toThrow(
      "MAIL_FROM",
    );
    expect(() => loadMailConfig({ ...base, SMTP_PORT: "99999" })).toThrow("SMTP_PORT");
  });
});

describe("cli mail:test", () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) }, out, err };
  };

  it("fails with a class only when SMTP is unreachable, never printing the address or password", async () => {
    const file = join(dir, "smtp_pass3");
    writeFileSync(file, PASSWORD);
    const c = io();
    const code = await main(["mail:test", RECIPIENT], c.io, {
      MAIL_TRANSPORT: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
      SMTP_USER: "u",
      SMTP_PASS_FILE: file,
      MAIL_FROM: "a@b.c",
    });
    expect(code).toBe(1);
    expect(c.err).toHaveLength(1);
    expect(c.err[0]).toMatch(/^fail [A-Z]+$/);
    expect(c.err.concat(c.out).join("")).not.toMatch(new RegExp(`${PASSWORD}|${RECIPIENT}`));
  });

  it("explains missing transport and bad usage", async () => {
    const a = io();
    expect(await main(["mail:test", RECIPIENT], a.io, {})).toBe(1);
    expect(a.err[0]).toBe("fail MAIL_TRANSPORT_NOT_SMTP");
    const b = io();
    expect(await main(["mail:test"], b.io, {})).toBe(2);
  });
});
