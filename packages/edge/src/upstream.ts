import http from "node:http";

export interface UpstreamRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Buffer;
}

export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export type FetchUpstream = (request: UpstreamRequest) => Promise<UpstreamResponse>;

/** Plain-HTTP client for the Next.js process on the loopback interface. Rejects on timeout or socket error. */
export function createHttpUpstream(base: URL, timeoutMs: number): FetchUpstream {
  return (request) =>
    new Promise<UpstreamResponse>((resolve, reject) => {
      const req = http.request(
        {
          hostname: base.hostname,
          port: base.port,
          path: request.path,
          method: request.method,
          headers: { ...request.headers, "accept-encoding": "identity" },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("error", reject);
          res.on("end", () => {
            const headers: Record<string, string> = {};
            for (const [name, value] of Object.entries(res.headers)) {
              if (typeof value === "string") headers[name] = value;
              else if (Array.isArray(value)) headers[name] = value.join(", ");
            }
            resolve({ status: res.statusCode ?? 502, headers, body: Buffer.concat(chunks) });
          });
        },
      );
      const timer = setTimeout(() => {
        req.destroy(new Error("upstream timeout"));
      }, timeoutMs);
      req.on("close", () => {
        clearTimeout(timer);
      });
      req.on("error", reject);
      req.end(request.body);
    });
}
