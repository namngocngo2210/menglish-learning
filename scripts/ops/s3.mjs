// Minimal S3 client (SigV4, path-style) for Cloudflare R2: put / head / get / list. No dependency (ADR 0007).
import { createHash, createHmac } from "node:crypto";
import http from "node:http";
import https from "node:https";

const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
const hex = (data) => createHash("sha256").update(data).digest("hex");
const enc = (s) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** Returns the headers (incl. Authorization) to send. `date` is injectable for the AWS test vector. */
export function signRequest({
  method,
  url,
  headers = {},
  payloadHash,
  accessKeyId,
  secretAccessKey,
  region = "auto",
  date = new Date(),
}) {
  const u = new URL(url);
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const all = {
    ...headers,
    host: u.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const names = Object.keys(all)
    .map((k) => k.toLowerCase())
    .sort();
  const lower = Object.fromEntries(
    Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]),
  );
  const canonicalUri =
    u.pathname
      .split("/")
      .map((seg) => enc(decodeURIComponent(seg)))
      .join("/") || "/";
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [enc(k), enc(v)])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signedHeaders = names.join(";");
  const canonical = [
    method,
    canonicalUri,
    query,
    names.map((n) => `${n}:${lower[n]}\n`).join(""),
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, hex(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return {
    ...all,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
  };
}

const send = (method, url, headers, bodyStream) =>
  new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.request(url, { method, headers }, (res) => resolve(res));
    req.setTimeout(120_000, () => req.destroy(new Error("s3 request timeout")));
    req.on("error", reject);
    if (bodyStream) bodyStream.on("error", reject).pipe(req);
    else req.end();
  });

const readAll = async (res) => {
  const parts = [];
  for await (const p of res) parts.push(p);
  return Buffer.concat(parts);
};

export function createS3({ endpoint, bucket, accessKeyId, secretAccessKey, region = "auto" }) {
  const base = endpoint.replace(/\/+$/, "");
  const urlFor = (key, query = "") =>
    `${base}/${bucket}/${key.split("/").map(enc).join("/")}${query}`;
  const call = async (method, url, { headers = {}, payloadHash = hex(""), body } = {}) => {
    const signed = signRequest({
      method,
      url,
      headers,
      payloadHash,
      accessKeyId,
      secretAccessKey,
      region,
    });
    return send(method, url, signed, body);
  };
  const must = async (res, what) => {
    if (res.statusCode >= 200 && res.statusCode < 300) return res;
    const text = (await readAll(res)).toString("utf8").slice(0, 200);
    throw new Error(`${what} failed: HTTP ${res.statusCode} ${text.replace(/\s+/g, " ")}`);
  };
  return {
    /** PUT from a readable stream whose size and sha256 are already known. */
    async put(key, stream, { size, sha256, metadata = {} }) {
      const headers = { "content-length": size, "content-type": "application/octet-stream" };
      for (const [k, v] of Object.entries(metadata)) headers[`x-amz-meta-${k}`] = v;
      const res = await call("PUT", urlFor(key), { headers, payloadHash: sha256, body: stream });
      await must(res, `put ${key}`);
      await readAll(res);
    },
    async head(key) {
      const res = await must(await call("HEAD", urlFor(key)), `head ${key}`);
      await readAll(res);
      return { size: Number(res.headers["content-length"]), metadata: res.headers };
    },
    async get(key) {
      return must(await call("GET", urlFor(key)), `get ${key}`);
    },
    async list(prefix) {
      const out = [];
      let token = "";
      do {
        const q = `?list-type=2&prefix=${enc(prefix)}${token ? `&continuation-token=${enc(token)}` : ""}`;
        const res = await must(await call("GET", `${base}/${bucket}${q}`), "list");
        const xml = (await readAll(res)).toString("utf8");
        for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const field = (n) => m[1].match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1];
          out.push({
            key: field("Key"),
            lastModified: new Date(field("LastModified")),
            size: Number(field("Size")),
          });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? (xml.match(/<NextContinuationToken>([^<]*)</)?.[1] ?? "")
          : "";
      } while (token);
      return out;
    },
  };
}
