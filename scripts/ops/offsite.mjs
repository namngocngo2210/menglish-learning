#!/usr/bin/env node
// Off-host backup to Cloudflare R2 (or any S3 endpoint): encrypt -> upload -> verify. See docs/backup-offsite-r2.md.
//   offsite.mjs upload <dump>            encrypt with the PUBLIC key and upload to daily (+weekly Sun, +monthly 1st)
//   offsite.mjs verify                   download the newest daily object and compare its SHA-256 (round trip)
//   offsite.mjs age-check [--max-hours]  exit 1 if the newest daily object is older than the limit (watchdog)
//   offsite.mjs decrypt <key.pem> <in.enc> <out>   OWNER side: needs the private key, never run on the host
// Config: env vars (names in deploy/example.env) or --env-file <path> (KEY=VALUE lines, mode 600). Values are never printed.
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  readFileSync,
  statSync,
  appendFileSync,
  writeFileSync,
} from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  decryptStream,
  encryptStream,
  keyFingerprint,
  loadPrivateKey,
  loadPublicKey,
} from "./backup-crypto.mjs";
import { createS3 } from "./s3.mjs";

const log = (event, extra = {}) =>
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...extra }));

export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trimStart().startsWith("#")) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const fileOrEnv = (env, name) =>
  env[name] ?? (env[`${name}_FILE`] ? readFileSync(env[`${name}_FILE`], "utf8").trim() : undefined);

export function loadConfig(env) {
  const cfg = {
    endpoint: env.R2_ENDPOINT,
    bucket: env.R2_BUCKET,
    accessKeyId: fileOrEnv(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: fileOrEnv(env, "R2_SECRET_ACCESS_KEY"),
    publicKeyFile: env.BACKUP_PUBLIC_KEY_FILE,
  };
  const names = {
    endpoint: "R2_ENDPOINT",
    bucket: "R2_BUCKET",
    accessKeyId: "R2_ACCESS_KEY_ID",
    secretAccessKey: "R2_SECRET_ACCESS_KEY",
  };
  const missing = Object.entries(names)
    .filter(([k]) => !cfg[k])
    .map(([, n]) => n);
  if (missing.length) throw new Error(`missing configuration: ${missing.join(", ")}`);
  return cfg;
}

/** Prefixes a backup taken at `now` goes to; lifecycle rules on each prefix implement 14d / 8w / 6m. */
export function prefixesFor(now) {
  const out = ["pg/daily"];
  if (now.getUTCDay() === 0) out.push("pg/weekly");
  if (now.getUTCDate() === 1) out.push("pg/monthly");
  return out;
}

export const objectKey = (prefix, now) => {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return `${prefix}/${now.getUTCFullYear()}/${p(now.getUTCMonth() + 1)}/${p(now.getUTCDate())}/beejunior-${stamp}.dump.enc`;
};

async function sha256File(path) {
  const h = createHash("sha256");
  for await (const c of createReadStream(path)) h.update(c);
  return h.digest("hex");
}

export async function upload({ s3, publicKey, dumpPath, now = new Date() }) {
  const tmp = join(process.env.TMPDIR ?? tmpdir(), `bj-offsite-${process.pid}.enc`);
  try {
    await pipeline(
      Readable.from(encryptStream(createReadStream(dumpPath), publicKey)),
      createWriteStream(tmp, { mode: 0o600 }),
    );
    const size = statSync(tmp).size;
    const sha256 = await sha256File(tmp);
    const keys = [];
    for (const prefix of prefixesFor(now)) {
      const key = objectKey(prefix, now);
      await s3.put(key, createReadStream(tmp), {
        size,
        sha256,
        metadata: { sha256, keyfp: keyFingerprint(publicKey) },
      });
      const head = await s3.head(key);
      if (head.size !== size || head.metadata["x-amz-meta-sha256"] !== sha256)
        throw new Error(`verification mismatch for ${key}`);
      keys.push(key);
    }
    return { keys, size, sha256 };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

const newest = async (s3) => {
  const items = await s3.list("pg/daily/");
  return items.sort((a, b) => b.lastModified - a.lastModified)[0];
};

export async function verify({ s3 }) {
  const item = await newest(s3);
  if (!item) throw new Error("no objects under pg/daily/");
  const head = await s3.head(item.key);
  const h = createHash("sha256");
  let size = 0;
  for await (const c of await s3.get(item.key)) {
    h.update(c);
    size += c.length;
  }
  if (size !== head.size || h.digest("hex") !== head.metadata["x-amz-meta-sha256"])
    throw new Error(`round trip mismatch for ${item.key}`);
  return { key: item.key, size };
}

export async function ageCheck({ s3, maxHours = 26, now = new Date() }) {
  const item = await newest(s3);
  if (!item) throw new Error("no objects under pg/daily/");
  const hours = (now - item.lastModified) / 3_600_000;
  if (hours > maxHours)
    throw new Error(`newest backup is ${hours.toFixed(1)} h old (limit ${maxHours})`);
  return { key: item.key, hours: Number(hours.toFixed(1)) };
}

export async function decryptFile(keyPem, inPath, outPath) {
  await pipeline(
    Readable.from(decryptStream(createReadStream(inPath), loadPrivateKey(keyPem))),
    createWriteStream(outPath, { mode: 0o600 }),
  );
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i < 0 ? undefined : args.splice(i, 2)[1];
  };
  const envFile = take("--env-file");
  const maxHours = Number(take("--max-hours") ?? 26);
  const [cmd, ...rest] = args;
  if (cmd === "decrypt") {
    const [keyFile, inPath, outPath] = rest;
    if (!outPath) throw new Error("usage: decrypt <key.pem> <in.enc> <out>");
    await decryptFile(readFileSync(keyFile), inPath, outPath);
    return log("decrypt_ok", { out: outPath });
  }
  const env = { ...(envFile ? parseEnvFile(readFileSync(envFile, "utf8")) : {}), ...process.env };
  const cfg = loadConfig(env);
  const s3 = createS3(cfg);
  const statusFile = env.BJ_OFFSITE_STATUS_FILE;
  try {
    if (cmd === "upload") {
      if (!rest[0]) throw new Error("usage: upload <dump>");
      if (!cfg.publicKeyFile) throw new Error("missing configuration: BACKUP_PUBLIC_KEY_FILE");
      const r = await upload({
        s3,
        publicKey: loadPublicKey(readFileSync(cfg.publicKeyFile)),
        dumpPath: rest[0],
      });
      if (statusFile) writeFileSync(statusFile, `${new Date().toISOString()} ${r.keys[0]}\n`);
      log("backup_offsite_ok", r);
    } else if (cmd === "verify") log("backup_offsite_verified", await verify({ s3 }));
    else if (cmd === "age-check") log("backup_offsite_fresh", await ageCheck({ s3, maxHours }));
    else throw new Error("usage: offsite.mjs upload|verify|age-check|decrypt");
  } catch (e) {
    log("backup_offsite_failed", { command: cmd, error: String(e.message ?? e) });
    if (statusFile)
      appendFileSync(`${statusFile}.err`, `${new Date().toISOString()} ${cmd} ${e.message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => {
    log("backup_offsite_failed", { error: String(e.message ?? e) });
    process.exitCode = 1;
  });
}
