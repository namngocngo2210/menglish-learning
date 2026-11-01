// Client-side envelope encryption for off-host backups (docs/backup-offsite-r2.md §3, ADR 0003/0007).
// X25519 (ephemeral sender key) -> HKDF-SHA256 -> AES-256-GCM key wrap; data in AES-256-GCM chunks.
// The host holds only the PUBLIC key; the private key stays offline with the owner. node:crypto only.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const MAGIC = Buffer.from("BJBK1\0", "latin1");
const FP_LEN = 32;
const PUB_LEN = 32;
const HEADER_LEN = MAGIC.length + FP_LEN + PUB_LEN + 12 + 48 + 4 + 4;
const TAG_LEN = 16;
const MAX_CHUNK = 16 * 1024 * 1024; // refuse absurd chunk sizes from a hostile header
export const DEFAULT_CHUNK = 1024 * 1024;

const sha256 = (...parts) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest();
};

/** SHA-256 of the SPKI DER of an X25519 public key (hex): identifies which key encrypted an object. */
export function keyFingerprint(publicKey) {
  return sha256(publicKey.export({ type: "spki", format: "der" })).toString("hex");
}

const wrapKey = (shared, ephPub) =>
  Buffer.from(hkdfSync("sha256", shared, ephPub, "bj-backup-wrap-v1", 32));

const chunkNonce = (prefix, counter) => {
  const n = Buffer.alloc(12);
  prefix.copy(n, 0);
  n.writeBigUInt64BE(BigInt(counter), 4);
  return n;
};

/** Generates a keypair for tests/dev. Production keys are made offline with openssl (see the doc). */
export function generateBackupKeyPair() {
  return generateKeyPairSync("x25519");
}

async function* rechunk(source, size) {
  // Yields {data, final}; the last chunk is always flagged so truncation is detectable.
  let buf = Buffer.alloc(0);
  for await (const part of source) {
    buf = buf.length ? Buffer.concat([buf, part]) : Buffer.from(part);
    while (buf.length > size) {
      yield { data: buf.subarray(0, size), final: false };
      buf = buf.subarray(size);
    }
  }
  yield { data: buf, final: true };
}

/** Encrypts an async iterable of Buffers; yields Buffers (header first). */
export async function* encryptStream(source, recipientPublicKey, chunkSize = DEFAULT_CHUNK) {
  const eph = generateKeyPairSync("x25519");
  const ephPub = eph.publicKey.export({ type: "spki", format: "der" }).subarray(-PUB_LEN);
  const fp = Buffer.from(keyFingerprint(recipientPublicKey), "hex");
  const dek = randomBytes(32);
  const wrapNonce = randomBytes(12);
  const wrap = createCipheriv(
    "aes-256-gcm",
    wrapKey(diffieHellman({ privateKey: eph.privateKey, publicKey: recipientPublicKey }), ephPub),
    wrapNonce,
  );
  wrap.setAAD(Buffer.concat([MAGIC, fp, ephPub]));
  const wrapped = Buffer.concat([wrap.update(dek), wrap.final(), wrap.getAuthTag()]);
  const prefix = randomBytes(4);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(chunkSize);
  const header = Buffer.concat([MAGIC, fp, ephPub, wrapNonce, wrapped, prefix, size]);
  const headerHash = sha256(header);
  yield header;
  let counter = 0;
  for await (const { data, final } of rechunk(source, chunkSize)) {
    const c = createCipheriv("aes-256-gcm", dek, chunkNonce(prefix, counter++));
    c.setAAD(Buffer.concat([headerHash, Buffer.from([final ? 1 : 0])]));
    yield Buffer.concat([c.update(data), c.final(), c.getAuthTag()]);
  }
}

/** Decrypts what encryptStream produced. Throws on a wrong key, any modified bit, or truncation. */
export async function* decryptStream(source, recipientPrivateKey) {
  const it = source[Symbol.asyncIterator]();
  let buf = Buffer.alloc(0);
  let ended = false;
  const fill = async (n) => {
    while (buf.length < n && !ended) {
      const { value, done } = await it.next();
      if (done) ended = true;
      else buf = buf.length ? Buffer.concat([buf, value]) : Buffer.from(value);
    }
  };
  await fill(HEADER_LEN);
  if (buf.length < HEADER_LEN || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("not a BeeJunior backup (bad header)");
  }
  const header = buf.subarray(0, HEADER_LEN);
  buf = buf.subarray(HEADER_LEN);
  let o = MAGIC.length;
  const fp = header.subarray(o, (o += FP_LEN));
  const ephPub = header.subarray(o, (o += PUB_LEN));
  const wrapNonce = header.subarray(o, (o += 12));
  const wrapped = header.subarray(o, (o += 48));
  const prefix = header.subarray(o, (o += 4));
  const chunkSize = header.readUInt32BE(o);
  if (chunkSize < 1 || chunkSize > MAX_CHUNK) throw new Error("bad chunk size in header");
  const myFp = keyFingerprint(createPublicKey(recipientPrivateKey));
  if (myFp !== fp.toString("hex")) throw new Error("wrong key: fingerprint does not match");
  const ephPublicKey = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b656e032100", "hex"), ephPub]),
    format: "der",
    type: "spki",
  });
  const unwrap = createDecipheriv(
    "aes-256-gcm",
    wrapKey(diffieHellman({ privateKey: recipientPrivateKey, publicKey: ephPublicKey }), ephPub),
    wrapNonce,
  );
  unwrap.setAAD(Buffer.concat([MAGIC, fp, ephPub]));
  unwrap.setAuthTag(wrapped.subarray(32));
  const dek = Buffer.concat([unwrap.update(wrapped.subarray(0, 32)), unwrap.final()]);
  const headerHash = sha256(header);
  const block = chunkSize + TAG_LEN;
  let counter = 0;
  const open = (data, final) => {
    if (data.length < TAG_LEN) throw new Error("truncated backup");
    const d = createDecipheriv("aes-256-gcm", dek, chunkNonce(prefix, counter++));
    d.setAAD(Buffer.concat([headerHash, Buffer.from([final ? 1 : 0])]));
    d.setAuthTag(data.subarray(data.length - TAG_LEN));
    return Buffer.concat([d.update(data.subarray(0, data.length - TAG_LEN)), d.final()]);
  };
  for (;;) {
    await fill(block + 1);
    if (buf.length > block) {
      yield open(buf.subarray(0, block), false);
      buf = buf.subarray(block);
    } else {
      yield open(buf, true);
      return;
    }
  }
}

export const loadPublicKey = (pem) => createPublicKey(pem);
export const loadPrivateKey = (pem) => createPrivateKey(pem);
