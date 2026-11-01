import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { Readable } from "node:stream";
import { decryptStream, encryptStream, generateBackupKeyPair } from "./backup-crypto.mjs";

const collect = async (it) => Buffer.concat(await Array.fromAsync(it));
const enc = async (data, pub, chunk) => collect(encryptStream(Readable.from([data]), pub, chunk));
const dec = (data, priv) => collect(decryptStream(Readable.from([data]), priv));

test("round trip is bit-exact across chunk boundaries (empty, small, exact multiple, large)", async () => {
  const { publicKey, privateKey } = generateBackupKeyPair();
  for (const n of [0, 1, 63, 64, 65, 640, 1000]) {
    const data = randomBytes(n);
    assert.deepEqual(await dec(await enc(data, publicKey, 64), privateKey), data, `size ${n}`);
  }
});

test("a flipped bit anywhere is rejected", async () => {
  const { publicKey, privateKey } = generateBackupKeyPair();
  const blob = await enc(randomBytes(300), publicKey, 64);
  for (const i of [0, 10, 80, 140, 200, blob.length - 1]) {
    const bad = Buffer.from(blob);
    bad[i] ^= 1;
    await assert.rejects(dec(bad, privateKey), `byte ${i}`);
  }
});

test("truncation (dropping the last chunk or part of it) and appended data are rejected", async () => {
  const { publicKey, privateKey } = generateBackupKeyPair();
  const blob = await enc(randomBytes(300), publicKey, 64);
  await assert.rejects(dec(blob.subarray(0, blob.length - 80), privateKey));
  await assert.rejects(dec(blob.subarray(0, blob.length - 5), privateKey));
  await assert.rejects(dec(Buffer.concat([blob, randomBytes(30)]), privateKey));
});

test("a different private key cannot decrypt", async () => {
  const a = generateBackupKeyPair();
  const b = generateBackupKeyPair();
  await assert.rejects(dec(await enc(randomBytes(10), a.publicKey), b.privateKey), /wrong key/);
});

test("ciphertext does not contain the plaintext and differs per run", async () => {
  const { publicKey } = generateBackupKeyPair();
  const data = Buffer.from("PGDMP-secret-marker".repeat(10));
  const [x, y] = [await enc(data, publicKey), await enc(data, publicKey)];
  assert.equal(x.includes("secret-marker"), false);
  assert.notDeepEqual(x, y);
});
