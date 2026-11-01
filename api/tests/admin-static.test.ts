import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PublicReader } from "@bj/data";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_CSP, safeSegments } from "../src/server/admin-static";
import { buildApp } from "../src/server/app";
import type { BuiltApp } from "../src/server/app";

let dist: string;
const apps: BuiltApp[] = [];

beforeAll(() => {
  const base = mkdtempSync(join(tmpdir(), "bj-admin-"));
  dist = join(base, "dist");
  mkdirSync(join(dist, "assets"), { recursive: true });
  writeFileSync(join(base, "secret.txt"), "TOP-SECRET");
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>admin</title>");
  writeFileSync(join(dist, "assets", "app-1.js"), "console.log(1)");
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((b) => b.app.close()));
});

const start = async (adminDist?: string): Promise<BuiltApp> => {
  const built = await buildApp({
    reader: {} as PublicReader,
    internalToken: undefined,
    rateLimitPerMinute: 1000,
    logger: false,
    ...(adminDist ? { adminDist } : {}),
  });
  apps.push(built);
  return built;
};

describe("/admin static", () => {
  it("serves index with a strict CSP and no-store", async () => {
    const { app } = await start(dist);
    for (const url of ["/admin", "/admin/", "/admin/some/deep/route"]) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-security-policy"]).toBe(ADMIN_CSP);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.body).toContain("<title>admin</title>");
    }
    expect(ADMIN_CSP).not.toContain("unsafe-inline");
  });

  it("caches hashed assets as immutable and answers HEAD", async () => {
    const { app } = await start(dist);
    const res = await app.inject({ url: "/admin/assets/app-1.js" });
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["content-type"]).toContain("text/javascript");
    expect((await app.inject({ method: "HEAD", url: "/admin/assets/app-1.js" })).statusCode).toBe(
      200,
    );
  });

  it("never reads outside the dist directory", async () => {
    const { app } = await start(dist);
    for (const url of [
      "/admin/../secret.txt",
      "/admin/%2e%2e/secret.txt",
      "/admin/..%2fsecret.txt",
      "/admin/assets/%2e%2e/%2e%2e/secret.txt",
      "/admin/%00.js",
      "/admin/..%5csecret.txt",
      "/admin/%zz",
    ]) {
      const res = await app.inject({ url });
      expect(res.body, url).not.toContain("TOP-SECRET");
      expect([301, 400, 404], url).toContain(res.statusCode);
    }
  });

  it("falls back to index only for extensionless paths", async () => {
    const { app } = await start(dist);
    expect((await app.inject({ url: "/admin/missing.js" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/admin/x.exe" })).statusCode).toBe(404);
  });

  it("is not registered without ADMIN_DIST", async () => {
    const { app } = await start();
    expect((await app.inject({ url: "/admin" })).statusCode).toBe(404);
  });
});

describe("safeSegments", () => {
  it("rejects traversal and accepts plain paths", () => {
    expect(safeSegments("/admin/assets/a.js?x=1")).toEqual(["assets", "a.js"]);
    expect(safeSegments("/admin/")).toEqual([]);
    expect(safeSegments("/admin/..%2f..")).toBeNull();
    expect(safeSegments("/admin/a%00")).toBeNull();
  });
});
