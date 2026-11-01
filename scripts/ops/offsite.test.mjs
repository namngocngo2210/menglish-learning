import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { loadPublicKey } from "./backup-crypto.mjs";
import {
  ageCheck,
  decryptFile,
  loadConfig,
  objectKey,
  parseEnvFile,
  prefixesFor,
  upload,
  verify,
} from "./offsite.mjs";
import { createS3 } from "./s3.mjs";

// Fake S3 endpoint: stores objects in memory, answers PUT/HEAD/GET/list-v2. Needs a SigV4 Authorization header.
const store = new Map();
let corrupt = false;
let server;
let endpoint;
before(async () => {
  server = http.createServer((req, res) => {
    if (
      !/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/auto\/s3\/aws4_request,/.test(
        req.headers.authorization ?? "",
      )
    ) {
      res.writeHead(403).end("<Error>SignatureDoesNotMatch</Error>");
      return;
    }
    const url = new URL(req.url, "http://x");
    const key = decodeURIComponent(url.pathname.replace(/^\/bkt\//, ""));
    if (req.method === "PUT") {
      const parts = [];
      req
        .on("data", (c) => parts.push(c))
        .on("end", () => {
          let body = Buffer.concat(parts);
          if (corrupt) body = body.subarray(0, body.length - 1);
          const meta = Object.fromEntries(
            Object.entries(req.headers).filter(([k]) => k.startsWith("x-amz-meta-")),
          );
          store.set(key, { body, meta, at: new Date() });
          res.writeHead(200).end();
        });
    } else if (url.searchParams.get("list-type") === "2") {
      const p = url.searchParams.get("prefix") ?? "";
      const xml = [...store]
        .filter(([k]) => k.startsWith(p))
        .map(
          ([k, v]) =>
            `<Contents><Key>${k}</Key><LastModified>${v.at.toISOString()}</LastModified><Size>${v.body.length}</Size></Contents>`,
        );
      res
        .writeHead(200)
        .end(
          `<ListBucketResult><IsTruncated>false</IsTruncated>${xml.join("")}</ListBucketResult>`,
        );
    } else {
      const o = store.get(key);
      if (!o) return void res.writeHead(404).end("<Error>NoSuchKey</Error>");
      res.writeHead(200, { "content-length": o.body.length, ...o.meta });
      res.end(req.method === "HEAD" ? undefined : o.body);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  endpoint = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const s3 = () => createS3({ endpoint, bucket: "bkt", accessKeyId: "AK", secretAccessKey: "SK" });
const dir = mkdtempSync(join(tmpdir(), "bj-offsite-test-"));
const sh = (...a) => execFileSync("openssl", a, { stdio: "pipe" });
sh("genpkey", "-algorithm", "X25519", "-out", join(dir, "priv.pem"));
sh("pkey", "-in", join(dir, "priv.pem"), "-pubout", "-out", join(dir, "pub.pem"));
const publicKey = loadPublicKey(readFileSync(join(dir, "pub.pem")));

test("prefixes follow the retention tiers and keys carry no content hints", () => {
  assert.deepEqual(prefixesFor(new Date("2026-11-03T03:30:00Z")), ["pg/daily"]);
  assert.deepEqual(prefixesFor(new Date("2026-11-01T03:30:00Z")), [
    "pg/daily",
    "pg/weekly",
    "pg/monthly",
  ]); // Sunday + 1st
  assert.equal(
    objectKey("pg/daily", new Date("2026-11-03T03:30:00Z")),
    "pg/daily/2026/11/03/beejunior-20261103T033000Z.dump.enc",
  );
});

test("upload (openssl-made key) -> verify -> age-check -> owner-side decrypt gives the original dump", async () => {
  const dump = join(dir, "x.dump");
  const data = randomBytes(3_000_000);
  writeFileSync(dump, data);
  const r = await upload({ s3: s3(), publicKey, dumpPath: dump, now: new Date() });
  assert.equal(r.keys.length >= 1, true);
  assert.equal((await verify({ s3: s3() })).size, r.size);
  assert.equal((await ageCheck({ s3: s3(), maxHours: 26 })).hours < 1, true);
  await assert.rejects(
    ageCheck({ s3: s3(), maxHours: 26, now: new Date(Date.now() + 30 * 3_600_000) }),
    /old/,
  );
  const enc = join(dir, "o.enc");
  writeFileSync(enc, store.get(r.keys[0]).body);
  const out = join(dir, "o.dump");
  await decryptFile(readFileSync(join(dir, "priv.pem")), enc, out);
  assert.deepEqual(readFileSync(out), data);
  assert.equal(
    store.get(r.keys[0]).body.includes(data.subarray(0, 64)),
    false,
    "stored object is ciphertext",
  );
});

test("a truncated upload (size mismatch on HEAD) fails loudly", async () => {
  corrupt = true;
  const dump = join(dir, "y.dump");
  writeFileSync(dump, randomBytes(1000));
  await assert.rejects(upload({ s3: s3(), publicKey, dumpPath: dump }), /mismatch/);
  corrupt = false;
});

test("verify on an empty bucket fails loudly", async () => {
  const bad = createS3({ endpoint, bucket: "bkt", accessKeyId: "AK", secretAccessKey: "SK" });
  store.clear();
  await assert.rejects(verify({ s3: bad }), /no objects/);
});

test("config: missing names are listed, values never printed; env file + *_FILE parsing", () => {
  assert.throws(
    () => loadConfig({}),
    /R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/,
  );
  assert.deepEqual(parseEnvFile('# c\nR2_BUCKET=b\nX="q v"\n'), { R2_BUCKET: "b", X: "q v" });
  const f = join(dir, "sec");
  writeFileSync(f, "topsecret\n");
  const cfg = loadConfig({
    R2_ENDPOINT: "e",
    R2_BUCKET: "b",
    R2_ACCESS_KEY_ID: "a",
    R2_SECRET_ACCESS_KEY_FILE: f,
  });
  assert.equal(cfg.secretAccessKey, "topsecret");
  const run = spawnSync("node", [new URL("./offsite.mjs", import.meta.url).pathname, "age-check"], {
    env: { PATH: process.env.PATH, R2_BUCKET: "b" },
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /backup_offsite_failed/);
});
