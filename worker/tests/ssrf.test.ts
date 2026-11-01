import { describe, expect, it } from "vitest";
import { isBlockedIp, matchesAllowlist, safeFetch, SsrfError } from "../src/ssrf";
import type { SafeFetchOptions } from "../src/ssrf";
import { listen } from "./helpers";

describe("isBlockedIp", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "192.0.0.8",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd00:ec2::254",
    "fe80::1",
    "ff02::1",
    "::ffff:10.0.0.1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "64:ff9b::a00:1",
    "2002:0a00:0001::",
    "2002:7f00:1::",
    "2001:db8::1",
    "2001::1",
    "100::1",
    "not-an-ip",
    "1.2.3",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "151.101.1.1",
    "172.32.0.1",
    "100.63.255.255",
    "2606:4700::1111",
    "2001:4860:4860::8888",
    "2002:0808:0808::1",
  ])("allows public address %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("matchesAllowlist", () => {
  const list = ["learningenglish.voanews.com", "*.gov.vn", "hanoi.edu.vn"];
  it("accepts exact and wildcard hosts, ignoring case and a trailing dot", () => {
    expect(matchesAllowlist("LearningEnglish.voanews.com.", list)).toBe(true);
    expect(matchesAllowlist("moet.gov.vn", list)).toBe(true);
    expect(matchesAllowlist("a.b.gov.vn", list)).toBe(true);
    expect(matchesAllowlist("hanoi.edu.vn", list)).toBe(true);
  });
  it("rejects look-alike and parent hosts", () => {
    for (const host of [
      "evil-voanews.com",
      "learningenglish.voanews.com.evil.net",
      "xlearningenglish.voanews.com",
      "gov.vn",
      "evilgov.vn",
      "sub.hanoi.edu.vn",
      "voanews.com",
    ])
      expect(matchesAllowlist(host, list)).toBe(false);
  });
});

const base = (extra: Partial<SafeFetchOptions> = {}): SafeFetchOptions => ({
  allowedHosts: ["good.example"],
  resolver: () => Promise.resolve(["93.184.216.34"]),
  ...extra,
});
const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return e instanceof SsrfError ? e.code : "other";
  }
};

describe("safeFetch URL and DNS checks", () => {
  it("rejects http, userinfo, custom ports, IP literals and hosts outside the allowlist", async () => {
    expect(await code(safeFetch("http://good.example/", base()))).toBe("scheme");
    expect(await code(safeFetch("https://u:p@good.example/", base()))).toBe("credentials");
    expect(await code(safeFetch("https://good.example:8443/", base()))).toBe("port");
    expect(await code(safeFetch("https://93.184.216.34/", base()))).toBe("host_not_allowed");
    expect(await code(safeFetch("https://[::1]/", base()))).toBe("host_not_allowed");
    expect(await code(safeFetch("https://evil.example/", base()))).toBe("host_not_allowed");
  });

  it("rejects a host resolving to a private address or to a mix of public and private", async () => {
    for (const answer of [
      ["10.0.0.5"],
      ["169.254.169.254"],
      ["::1"],
      ["93.184.216.34", "192.168.0.1"],
    ])
      expect(
        await code(
          safeFetch("https://good.example/", base({ resolver: () => Promise.resolve(answer) })),
        ),
      ).toBe("blocked_ip");
  });

  it("rejects when DNS fails or returns nothing", async () => {
    expect(
      await code(
        safeFetch(
          "https://good.example/",
          base({ resolver: () => Promise.reject(new Error("x")) }),
        ),
      ),
    ).toBe("dns");
    expect(
      await code(safeFetch("https://good.example/", base({ resolver: () => Promise.resolve([]) }))),
    ).toBe("dns");
  });
});

describe("safeFetch against a local origin", () => {
  const withOrigin = async (
    handler: Parameters<typeof listen>[0],
    run: (port: number, hits: () => number) => Promise<void>,
  ): Promise<void> => {
    let n = 0;
    const server = await listen((req, res) => {
      n++;
      handler(req, res);
    });
    try {
      await run(server.port, () => n);
    } finally {
      await server.close();
    }
  };
  const local = (port: number, extra: Partial<SafeFetchOptions> = {}): SafeFetchOptions =>
    base({ testServer: { port }, resolver: () => Promise.resolve(["127.0.0.1"]), ...extra });

  it("returns the body and pins the connection to the validated address when DNS would rebind", async () => {
    await withOrigin(
      (_req, res) => res.writeHead(200, { "content-type": "text/plain" }).end("hello"),
      async (port) => {
        let calls = 0;
        // First answer is loopback (allowed only through testServer); a second lookup would be private.
        const resolver = (): Promise<string[]> =>
          Promise.resolve(++calls === 1 ? ["127.0.0.1"] : ["10.0.0.9"]);
        const res = await safeFetch("https://good.example/x", local(port, { resolver }));
        expect(res.body.toString()).toBe("hello");
        expect(calls).toBe(1); // resolved exactly once: connect used the validated address
      },
    );
  });

  it("follows a redirect inside the allowlist and re-validates every hop", async () => {
    await withOrigin(
      (req, res) => {
        if (req.url === "/a") res.writeHead(302, { location: "https://good.example/b" }).end();
        else res.writeHead(200).end("final");
      },
      async (port) => {
        expect((await safeFetch("https://good.example/a", local(port))).body.toString()).toBe(
          "final",
        );
      },
    );
  });

  it("refuses redirects to a non-allowlisted host, a private literal, http, and chains over 3 hops", async () => {
    await withOrigin(
      (req, res) => {
        const to: Record<string, string> = {
          "/evil": "https://evil.example/",
          "/ip": "https://169.254.169.254/latest/meta-data",
          "/http": "http://good.example/",
          "/loop": "https://good.example/loop",
        };
        res.writeHead(302, { location: to[req.url ?? ""] ?? "/" }).end();
      },
      async (port) => {
        expect(await code(safeFetch("https://good.example/evil", local(port)))).toBe(
          "host_not_allowed",
        );
        expect(await code(safeFetch("https://good.example/ip", local(port)))).toBe(
          "host_not_allowed",
        );
        expect(await code(safeFetch("https://good.example/http", local(port)))).toBe("scheme");
        expect(await code(safeFetch("https://good.example/loop", local(port)))).toBe("redirect");
      },
    );
  });

  it("returns a 3xx unchanged in manual mode", async () => {
    await withOrigin(
      (_req, res) => res.writeHead(301, { location: "https://good.example/b" }).end(),
      async (port) => {
        expect(
          (await safeFetch("https://good.example/a", local(port, { redirect: "manual" }))).status,
        ).toBe(301);
      },
    );
  });

  it("aborts when the body exceeds the size cap, with or without a content-length", async () => {
    await withOrigin(
      (req, res) => {
        if (req.url === "/declared")
          res.writeHead(200, { "content-length": "5000" }).end("x".repeat(5000));
        else {
          res.writeHead(200);
          res.write("x".repeat(3000));
          res.end("y".repeat(3000));
        }
      },
      async (port) => {
        expect(
          await code(safeFetch("https://good.example/declared", local(port, { maxBytes: 1000 }))),
        ).toBe("too_large");
        expect(
          await code(safeFetch("https://good.example/chunked", local(port, { maxBytes: 4000 }))),
        ).toBe("too_large");
      },
    );
  });

  it("rejects an unexpected content-type and times out on a stalled origin", async () => {
    await withOrigin(
      (req, res) => {
        if (req.url === "/slow") return; // never answers
        res.writeHead(200, { "content-type": "application/octet-stream" }).end("bin");
      },
      async (port) => {
        expect(
          await code(
            safeFetch("https://good.example/f", local(port, { contentTypes: ["text/html"] })),
          ),
        ).toBe("content_type");
        expect(
          await code(safeFetch("https://good.example/slow", local(port, { timeoutMs: 150 }))),
        ).toBe("timeout");
      },
    );
  });
});
