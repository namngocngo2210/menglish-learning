import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";

/** Same policy as admin/vite.config.ts (CSP); no inline script or style is ever needed. */
export const ADMIN_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

/** URL path under /admin -> safe relative segments, or null for anything that could leave the dist dir. */
export function safeSegments(url: string): string[] | null {
  const path = url.split("?")[0] ?? "";
  const out: string[] = [];
  for (const raw of path.split("/").slice(2)) {
    if (raw === "") continue;
    let part: string;
    try {
      part = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (/[/\\\0]/.test(part) || part === "." || part === "..") return null;
    out.push(part);
  }
  return out;
}

function send(reply: FastifyReply, type: string, body: Buffer, immutable: boolean): FastifyReply {
  const cache = immutable
    ? "public, max-age=31536000, immutable"
    : type.startsWith("text/html")
      ? "no-store"
      : "no-cache";
  return reply
    .code(200)
    .type(type)
    .header("content-security-policy", ADMIN_CSP)
    .header("x-content-type-options", "nosniff")
    .header("referrer-policy", "no-referrer")
    .header("cache-control", cache)
    .send(body);
}

/** Serves the built admin SPA (admin/dist) at /admin. Unknown extensionless paths fall back to index.html. */
export function registerAdminStatic(app: FastifyInstance, distDir: string): void {
  const html = MIME[".html"] ?? "text/html";
  const root = resolve(distDir);
  const handler = async (request: { url: string }, reply: FastifyReply): Promise<FastifyReply> => {
    const segments = safeSegments(request.url);
    if (!segments) return await reply.code(404).send();
    const file = resolve(join(root, ...segments));
    if (segments.length > 0 && !file.startsWith(root + sep)) return await reply.code(404).send();
    const ext = extname(file);
    try {
      if (segments.length > 0 && ext !== "") {
        const type = MIME[ext];
        if (!type) return await reply.code(404).send();
        return await send(reply, type, await readFile(file), segments[0] === "assets");
      }
      return await send(reply, html, await readFile(join(root, "index.html")), false);
    } catch {
      return await reply.code(404).send();
    }
  };
  app.get("/admin", handler);
  app.get("/admin/*", handler);
}
