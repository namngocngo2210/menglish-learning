import { expect, it, vi } from "vitest";
import { createRoomsClient, RoomsApiError } from "@/lib/rooms/client";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/rooms/code";

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

it("normalizes room codes", () => {
  expect(normalizeRoomCode(" k7m-2qx ")).toBe("K7M2QX");
  for (const bad of ["", "K7M2Q", "K7M2QXX", "K7M2Q0", "K7M2QI", "K7M2QO", "K7M2Q!"]) expect(isValidRoomCode(bad)).toBe(false);
});

it("sends same-origin JSON requests to /rt", async () => {
  const f = vi.fn().mockImplementation(async () => json({ code: "K7M2QX" }));
  const c = createRoomsClient({ fetchImpl: f });
  await c.join("k7m2qx", "An");
  const [url, init] = f.mock.calls[0];
  expect(url).toBe("/rt/rooms/K7M2QX/join");
  expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: JSON.stringify({ name: "An" }), headers: { "Content-Type": "application/json" } });
  await c.putAnswer("K7M2QX", "q1", "B");
  expect(f.mock.calls[1][1].method).toBe("PUT");
  await c.report("K7M2QX", "khac");
  expect(f.mock.calls[2][0]).toBe("/rt/rooms/K7M2QX/report");
});

it("refuses non same-origin base URLs and invalid codes", async () => {
  for (const b of ["https://evil.example/rt", "//evil.example/rt", "rt", "/rt?x=1"]) expect(() => createRoomsClient({ baseUrl: b })).toThrow(/same-origin/);
  expect(() => createRoomsClient({ fetchImpl: vi.fn() }).preview("nope")).toThrowError(expect.objectContaining({ code: "room_not_found" }));
});

it("maps error bodies, Retry-After and network failures", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(json({ error: { code: "name_taken", message: "Trùng tên" } }, { status: 409 }))
    .mockResolvedValueOnce(json({ error: { code: "rate_limited", message: "x" } }, { status: 429, headers: { "Retry-After": "7" } }))
    .mockResolvedValueOnce(new Response("oops", { status: 500 }))
    .mockRejectedValueOnce(new TypeError("fail"));
  const c = createRoomsClient({ fetchImpl: f });
  await expect(c.join("K7M2QX", "An")).rejects.toMatchObject({ status: 409, code: "name_taken", message: "Trùng tên" });
  await expect(c.join("K7M2QX", "An")).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 7 });
  await expect(c.start("K7M2QX")).rejects.toMatchObject({ status: 500, code: "unknown" });
  const e = await c.start("K7M2QX").catch(x => x);
  expect(e).toBeInstanceOf(RoomsApiError);
  expect(e).toMatchObject({ status: 0, code: "network" });
});

it("snapshot supports ETag and 304, 204 responses resolve", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(json({ code: "K7M2QX" }, { headers: { ETag: 'W/"1-p"' } }))
    .mockResolvedValueOnce(new Response(null, { status: 304 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const c = createRoomsClient({ fetchImpl: f });
  const a = await c.snapshot("K7M2QX");
  expect(a).toMatchObject({ notModified: false, etag: 'W/"1-p"' });
  expect(await c.snapshot("K7M2QX", 'W/"1-p"')).toEqual({ notModified: true });
  expect(f.mock.calls[1][1].headers["If-None-Match"]).toBe('W/"1-p"');
  await expect(c.close("K7M2QX")).resolves.toBeUndefined();
});
