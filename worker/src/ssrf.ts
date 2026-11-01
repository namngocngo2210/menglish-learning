import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/** Thrown for every refused or failed guarded fetch. `code` is stable for logs/tests. */
export class SsrfError extends Error {
  constructor(
    readonly code:
      | "scheme"
      | "credentials"
      | "port"
      | "host_not_allowed"
      | "blocked_ip"
      | "dns"
      | "redirect"
      | "too_large"
      | "content_type"
      | "timeout"
      | "network",
    message: string,
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

const V4_BLOCKS: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, includes the cloud metadata address 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

function v4Blocked(ip: string): boolean {
  const value = v4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    return Math.floor(value / size) === Math.floor(v4ToInt(base) / size);
  });
}

/** Expands an IPv6 literal into eight 16-bit groups (handles `::` and a trailing dotted IPv4). */
function v6Groups(ip: string): number[] | undefined {
  let text = ip.split("%")[0] ?? ip;
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted?.[1] !== undefined) {
    const n = v4ToInt(dotted[1]);
    text = `${text.slice(0, -dotted[1].length)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] === "" || halves[0] === undefined ? [] : halves[0].split(":");
  const tail = halves[1] === undefined || halves[1] === "" ? [] : halves[1].split(":");
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return undefined;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...tail].map((g) =>
    Number.parseInt(g, 16),
  );
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff)
    ? groups
    : undefined;
}

function embeddedV4(hi: number, lo: number): string {
  return `${String(hi >> 8)}.${String(hi & 255)}.${String(lo >> 8)}.${String(lo & 255)}`;
}

/**
 * True when connecting to `ip` could reach an internal network: IPv4 private/loopback/link-local/
 * CGNAT/multicast/reserved, cloud-metadata, and every IPv6 address outside global unicast
 * (2000::/3) - which also blocks IPv4-mapped (::ffff:a.b.c.d), NAT64, ::1, fc00::/7 and fe80::/10.
 * 6to4 (2002::/16) is checked through its embedded IPv4. Unparseable input is blocked.
 */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return v4Blocked(ip);
  if (!net.isIPv6(ip)) return true;
  const g = v6Groups(ip);
  const [first, second, third] = [g?.[0], g?.[1], g?.[2]];
  if (g === undefined || first === undefined || second === undefined || third === undefined)
    return true;
  if ((first & 0xe000) !== 0x2000) return true;
  if (first === 0x2001 && (second === 0 || second === 0x0db8)) return true; // Teredo, documentation
  if (first === 0x2002) return v4Blocked(embeddedV4(second, third));
  return false;
}

/** Exact host or `*.suffix` (one or more labels); look-alike hosts never match. */
export function matchesAllowlist(host: string, patterns: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return patterns.some((raw) => {
    const p = raw.toLowerCase();
    return p.startsWith("*.") ? h.endsWith(`.${p.slice(2)}`) && h.length > p.length - 1 : h === p;
  });
}

export interface SafeFetchOptions {
  allowedHosts: readonly string[];
  /** Injectable for tests; defaults to the system resolver (all addresses). */
  resolver?: (host: string) => Promise<string[]>;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** "manual" returns 3xx responses unchanged (the crawler HttpClient refuses redirects itself). */
  redirect?: "follow" | "manual";
  /** Accepted content-type prefixes; omitted = any. */
  contentTypes?: readonly string[];
  headers?: Record<string, string>;
  /** TESTS ONLY: connect to 127.0.0.1:port over plain http (URL checks, allowlist and DNS checks still run on the https URL). */
  testServer?: { port: number };
}

export interface SafeResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

const defaultResolver = async (host: string): Promise<string[]> =>
  (await lookup(host, { all: true })).map((a) => a.address);

function validateUrl(url: URL, opts: SafeFetchOptions): void {
  if (url.protocol !== "https:")
    throw new SsrfError("scheme", `scheme not allowed: ${url.protocol}`);
  if (url.username !== "" || url.password !== "")
    throw new SsrfError("credentials", "credentials in URL are not allowed");
  if (url.port !== "") throw new SsrfError("port", "custom ports are not allowed");
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0)
    throw new SsrfError("host_not_allowed", "IP literal hosts are not allowed");
  if (!matchesAllowlist(url.hostname, opts.allowedHosts))
    throw new SsrfError("host_not_allowed", `host not on the source allowlist: ${url.hostname}`);
}

async function pinnedAddress(url: URL, opts: SafeFetchOptions): Promise<string> {
  let addresses: string[];
  try {
    addresses = await (opts.resolver ?? defaultResolver)(url.hostname);
  } catch {
    throw new SsrfError("dns", `cannot resolve ${url.hostname}`);
  }
  const first = addresses[0];
  if (first === undefined) throw new SsrfError("dns", `no address for ${url.hostname}`);
  const loopbackOk = (ip: string): boolean =>
    opts.testServer !== undefined && (ip === "127.0.0.1" || ip === "::1");
  // Every returned address must be public: a mixed answer is a rebinding signal.
  if (addresses.some((ip) => isBlockedIp(ip) && !loopbackOk(ip)))
    throw new SsrfError("blocked_ip", `${url.hostname} resolves to a blocked address`);
  return first;
}

function requestPinned(
  url: URL,
  ip: string,
  opts: SafeFetchOptions,
  maxBytes: number,
  timeoutMs: number,
): Promise<SafeResponse> {
  const family = net.isIPv6(ip) ? 6 : 4;
  const transport = opts.testServer === undefined ? https : http;
  return new Promise<SafeResponse>((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: opts.testServer?.port ?? 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { accept: "*/*", "accept-encoding": "identity", ...opts.headers },
        // The connection goes to the address validated above, never to a second DNS answer;
        // Host and TLS SNI still carry the original name.
        lookup: (_host, options, cb) => {
          if ((options as { all?: boolean }).all === true)
            (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [
              { address: ip, family },
            ]);
          else cb(null, ip, family);
        },
      },
      (res) => {
        const type = (res.headers["content-type"] ?? "").toLowerCase();
        const status = res.statusCode ?? 0;
        const wantsBody = status >= 200 && status < 300;
        if (wantsBody && opts.contentTypes && !opts.contentTypes.some((t) => type.startsWith(t))) {
          res.destroy();
          reject(new SsrfError("content_type", `content-type not accepted: ${type}`));
          return;
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          reject(new SsrfError("too_large", "response exceeds the size cap"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new SsrfError("too_large", "response exceeds the size cap"));
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers))
            if (typeof v === "string") headers[k] = v;
          resolve({ status, headers, body: Buffer.concat(chunks) });
        });
        res.on("error", () => {
          reject(new SsrfError("network", "response stream failed"));
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new SsrfError("timeout", "request timed out"));
    });
    const wall = setTimeout(() => {
      req.destroy();
      reject(new SsrfError("timeout", "request exceeded the total time limit"));
    }, timeoutMs * 2);
    req.on("close", () => {
      clearTimeout(wall);
    });
    req.on("error", (e) => {
      reject(e instanceof SsrfError ? e : new SsrfError("network", "request failed"));
    });
    req.end();
  });
}

/** The only way the worker fetches a remote URL (standards section 5, V12/V13). */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      throw new SsrfError("scheme", "invalid URL");
    }
    validateUrl(url, opts);
    const ip = await pinnedAddress(url, opts);
    const res = await requestPinned(
      url,
      ip,
      opts,
      opts.maxBytes ?? 20 * 1024 * 1024,
      opts.timeoutMs ?? 20_000,
    );
    const location = res.headers["location"];
    if (res.status >= 300 && res.status < 400 && location !== undefined) {
      if (opts.redirect === "manual") return res;
      current = new URL(location, url).href;
      continue;
    }
    return res;
  }
  throw new SsrfError("redirect", `more than ${String(maxRedirects)} redirects`);
}

/** fetch-compatible adapter so the crawler HttpClient can run through the guard. */
export function guardedFetch(base: Omit<SafeFetchOptions, "redirect">): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const res = await safeFetch(url, {
      ...base,
      redirect: init?.redirect === "manual" ? "manual" : "follow",
      headers: { ...base.headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    const noBody = res.status === 204 || res.status === 205 || res.status === 304;
    return new Response(noBody ? null : new Uint8Array(res.body), {
      status: res.status,
      headers: res.headers,
    });
  };
}
