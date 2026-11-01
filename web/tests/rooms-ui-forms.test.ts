import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RoomsApiError } from "@/lib/rooms/client";
import { availableCount, buildCreateInput, checkCodeInput, describeRoomError, extractRoomCode, parseTestInput, summarizeTest, validateCreate, validateName, type CreateDraft, type RoomCatalog } from "@/lib/rooms/form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const catalog: RoomCatalog = {
 tests: [{ slug: "lop-7/ngu-phap/thi-hien-tai-don/de-1", title: "Thì hiện tại đơn — Đề 1", grade: 7, skill: "ngu-phap", size: 20 }],
 topics: [{ grade: 7, skill: "ngu-phap", slug: "thi-hien-tai-don", name: "Thì hiện tại đơn" }],
 pool: [{ grade: 7, skill: "ngu-phap", topic: "thi-hien-tai-don", n: 12 }, { grade: 7, skill: "ngu-phap", topic: "so-sanh", n: 30 }, { grade: 7, skill: "tu-vung", topic: "gia-dinh", n: 8 }],
};
const draft: CreateDraft = { name: "Minh", kind: "mix", slug: null, grade: 7, skills: ["ngu-phap"], topic: null, size: 20, difficulty: "balanced", time: null, maxPlayers: 10 };

describe("availableCount", () => {
 it("sums by grade, skills and optional topic", () => {
  expect(availableCount(catalog.pool, 7, ["ngu-phap"], null)).toBe(42);
  expect(availableCount(catalog.pool, 7, ["ngu-phap", "tu-vung"], null)).toBe(50);
  expect(availableCount(catalog.pool, 7, ["ngu-phap"], "thi-hien-tai-don")).toBe(12);
  expect(availableCount(catalog.pool, 6, ["ngu-phap"], null)).toBe(0);
 });
});

describe("validateCreate / buildCreateInput", () => {
 it("accepts a valid mix and blocks when too few questions", () => {
  expect(validateCreate(draft, catalog)).toEqual({});
 });
 it("reports short pool, no skills, bad name, missing fixed test, bad capacity", () => {
  expect(validateCreate({ ...draft, topic: "thi-hien-tai-don" }, catalog).size).toContain("12");
  expect(validateCreate({ ...draft, skills: [] }, catalog).skills).toBeTruthy();
  expect(validateCreate({ ...draft, name: "A" }, catalog).name).toBeTruthy();
  expect(validateCreate({ ...draft, kind: "fixed", slug: "lop-7/ngu-phap/x/de-9" }, catalog).test).toBeTruthy();
  expect(validateCreate({ ...draft, kind: "fixed", slug: catalog.tests[0].slug }, catalog)).toEqual({});
  expect(validateCreate({ ...draft, maxPlayers: 46 }, catalog).maxPlayers).toBeTruthy();
  expect(validateCreate({ ...draft, maxPlayers: 45 }, catalog).maxPlayers).toBeUndefined();
 });
 it("builds API payloads (timer null = unlimited, topic only with one skill)", () => {
  expect(buildCreateInput({ ...draft, name: "  Minh  ", topic: "thi-hien-tai-don" })).toEqual({ name: "Minh", maxPlayers: 10, timeLimitMinutes: null, test: { mode: "mix", grade: 7, skills: ["ngu-phap"], topicSlug: "thi-hien-tai-don", size: 20, difficulty: "balanced" } });
  expect(buildCreateInput({ ...draft, skills: ["ngu-phap", "tu-vung"], topic: "thi-hien-tai-don", time: 15 }).test).toMatchObject({ topicSlug: null });
  expect(buildCreateInput({ ...draft, kind: "fixed", slug: "thi-vao-lop-10/de-1", time: 30 })).toMatchObject({ timeLimitMinutes: 30, test: { mode: "fixed", slug: "thi-vao-lop-10/de-1" } });
 });
});

describe("parseTestInput", () => {
 it("accepts slug, path and same-host URL; rejects foreign hosts and junk", () => {
  const slug = "lop-7/ngu-phap/thi-hien-tai-don/de-1";
  expect(parseTestInput(slug)).toBe(slug);
  expect(parseTestInput(`/${slug}/`)).toBe(slug);
  expect(parseTestInput(`https://beejunior.meducation.vn/${slug}?x=1#a`, "beejunior.meducation.vn")).toBe(slug);
  expect(parseTestInput(`https://evil.example/${slug}`, "beejunior.meducation.vn")).toBeNull();
  expect(parseTestInput("javascript:alert(1)")).toBeNull();
  expect(parseTestInput("thi-vao-lop-10/de-2")).toBe("thi-vao-lop-10/de-2");
  expect(parseTestInput("lop-7/ngu-phap")).toBeNull();
  expect(parseTestInput("")).toBeNull();
 });
});

describe("validateName", () => {
 it("enforces 2-20 chars and charset", () => {
  expect(validateName("")).toBeTruthy();
  expect(validateName("A")).toBeTruthy();
  expect(validateName("a".repeat(21))).toBeTruthy();
  expect(validateName("Nguyễn Minh")).toBeNull();
  expect(validateName("<b>Hi</b>")).toBeTruthy();
  expect(validateName("12345")).toBeTruthy();
  expect(validateName("Bạn 0912345678")).toBeTruthy();
 });
});

describe("room codes", () => {
 it("normalizes codes and extracts them from links", () => {
  expect(checkCodeInput("k7m-2qx")).toEqual({ code: "K7M2QX" });
  expect("error" in checkCodeInput("K7M2Q0")).toBe(true);
  expect("error" in checkCodeInput("K7M")).toBe(true);
  expect(extractRoomCode("https://x.vn/luyen-tap-nhom/phong/K7M2QX?a=1")).toBe("K7M2QX");
  expect(extractRoomCode("https://x.vn/luyen-tap-nhom/vao?ma=K7M2QX")).toBe("K7M2QX");
  expect(extractRoomCode("k7m2qx")).toBe("k7m2qx");
 });
});

describe("describeRoomError", () => {
 const err = (status: number, code: ConstructorParameters<typeof RoomsApiError>[1], details?: Record<string, unknown>, retry?: number) => new RoomsApiError(status, code, "x", retry, details);
 it("maps server errors to Vietnamese messages and fields", () => {
  expect(describeRoomError(err(409, "name_taken"))).toMatchObject({ field: "name" });
  expect(describeRoomError(err(422, "name_rejected"))).toMatchObject({ field: "name" });
  expect(describeRoomError(err(409, "room_full")).message).toContain("đủ người");
  expect(describeRoomError(err(404, "room_not_found")).field).toBe("code");
  expect(describeRoomError(err(409, "room_not_joinable")).message).toContain("bắt đầu");
  expect(describeRoomError(err(422, "not_enough_questions", { available: 7 })).message).toContain("7");
  expect(describeRoomError(err(429, "rate_limited", undefined, 12)).message).toContain("12");
  expect(describeRoomError(err(0, "network")).message).toContain("kết nối");
  expect(describeRoomError(new Error("boom")).field).toBe("form");
 });
});

describe("summarizeTest", () => {
 it("joins title, grade, skills and size", () => {
  expect(summarizeTest({ title: "Đề 1", grade: 7, skills: ["ngu-phap"], size: 20 })).toBe("Đề 1 · Lớp 7 · Ngữ pháp · 20 câu");
  expect(summarizeTest({ kind: "mix", size: 10 })).toBe("Đề trộn · 10 câu");
 });
});

describe("rendered forms", () => {
 it("create form: labelled fields, 44px chips, live count, no ads, no secrets", async () => {
  const { CreateRoomForm } = await import("@/components/rooms/CreateRoomForm");
  const html = renderToStaticMarkup(createElement(CreateRoomForm, { catalog }));
  expect(html).toContain('for="tao-name"');
  expect(html).toContain("Không giới hạn");
  expect(html).toContain("15 phút");
  expect(html).toContain("30 phút");
  expect(html).toContain("2 (đấu đôi)");
  expect(html).toContain(">45<");
  expect(html).toContain("min-h-11");
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("Có <strong>42</strong>");
  expect(html).not.toMatch(/AdSlot|adsbygoogle|correctKey/);
 });
 it("join forms: labelled name input, summary card, code input", async () => {
  const { JoinNameForm } = await import("@/components/rooms/JoinNameForm");
  const { JoinCodeForm } = await import("@/components/rooms/JoinCodeForm");
  const html = renderToStaticMarkup(createElement(JoinNameForm, { code: "K7M2QX", preview: { test: { title: "Đề 1", grade: 7, skills: ["ngu-phap"], size: 20, kind: "fixed" }, playerCount: 4, maxPlayers: 10, joinable: true }, onJoined: () => {}, onBlocked: () => {} }));
  expect(html).toContain('for="vao-ten"');
  expect(html).toContain("K7M2QX");
  expect(html).toContain("4/10 người");
  expect(html).toContain("Đề 1 · Lớp 7 · Ngữ pháp · 20 câu");
  expect(renderToStaticMarkup(createElement(JoinCodeForm))).toContain('for="vao-ma"');
 });
});
