import { RoomsApiError } from "./client";
import { normalizeRoomCode } from "./code";
import type { CreateRoomInput, Skill, TestSpec } from "./types";
import { parseEntranceSlug, parseTestSlug } from "@/lib/routes";

export interface CatalogTest { slug: string; title: string; grade: number; skill: Skill | null; size: number }
export interface CatalogTopic { grade: number; skill: Skill; slug: string; name: string }
export interface PoolRow { grade: number; skill: Skill; topic: string; n: number }
export interface RoomCatalog { tests: CatalogTest[]; topics: CatalogTopic[]; pool: PoolRow[] }

export const MIX_SIZES = [10, 20, 40] as const;
export const PLAYER_OPTIONS = [2, 5, 10, 20, 30, 45] as const;
export const TIME_OPTIONS = [null, 15, 30] as const;
export const NAME_MIN = 2;
export const NAME_MAX = 20;
export const DEFAULT_MAX_PLAYERS = 10;
export type Difficulty = "balanced" | "easy" | "medium" | "hard";

/** Number of published questions matching the mix filter (topic only applies when it belongs to the selected skills). */
export function availableCount(pool: readonly PoolRow[], grade: number, skills: readonly Skill[], topic: string | null): number {
 return pool.filter(r => r.grade === grade && skills.includes(r.skill) && (!topic || r.topic === topic)).reduce((s, r) => s + r.n, 0);
}

/** Accepts a bare slug, "/path", or a full URL on this site; returns a known slug or null. */
export function parseTestInput(input: string, siteHost?: string): string | null {
 let text = input.trim();
 if (!text) return null;
 if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
  try {
   const url = new URL(text);
   if (!["http:", "https:"].includes(url.protocol) || (siteHost && url.host !== siteHost)) return null;
   text = url.pathname;
  } catch { return null; }
 }
 const slug = text.replace(/[?#].*$/, "").replace(/^\/+|\/+$/g, "");
 return parseTestSlug(slug) || parseEntranceSlug(slug) ? slug : null;
}

/** Display name rules mirror the server (2-20 chars); blocklist/uniqueness are server-side only. */
export function validateName(raw: string): string | null {
 const name = raw.normalize("NFKC").trim().replace(/ +/g, " ");
 const len = [...name].length;
 if (!name) return "Hãy nhập tên hiển thị.";
 if (len < NAME_MIN) return `Tên cần ít nhất ${NAME_MIN} ký tự.`;
 if (len > NAME_MAX) return `Tên tối đa ${NAME_MAX} ký tự.`;
 if (!/^[\p{L}\p{M}\p{N} ._-]+$/u.test(name) || !/\p{L}/u.test(name)) return "Tên chỉ gồm chữ, số, dấu cách, dấu chấm, gạch ngang hoặc gạch dưới, và có ít nhất một chữ cái.";
 if (/\d{6}/.test(name)) return "Không dùng số điện thoại hoặc dãy số dài làm tên.";
 return null;
}
export const cleanName = (raw: string) => raw.normalize("NFKC").trim().replace(/ +/g, " ");

export interface CreateDraft {
 name: string; kind: "fixed" | "mix"; slug: string | null;
 grade: 6 | 7 | 8 | 9; skills: Skill[]; topic: string | null; size: 10 | 20 | 40; difficulty: Difficulty;
 time: 15 | 30 | null; maxPlayers: number;
}
export type CreateErrors = Partial<Record<"name" | "test" | "skills" | "size" | "maxPlayers", string>>;

export function validateCreate(d: CreateDraft, c: RoomCatalog): CreateErrors {
 const e: CreateErrors = {};
 const n = validateName(d.name); if (n) e.name = n;
 if (d.kind === "fixed") {
  if (!d.slug || !c.tests.some(t => t.slug === d.slug)) e.test = "Hãy chọn một đề có sẵn hoặc dán đường dẫn đề hợp lệ.";
 } else {
  if (d.skills.length === 0) e.skills = "Chọn ít nhất một kỹ năng.";
  else if (availableCount(c.pool, d.grade, d.skills, d.topic) < d.size) e.size = `Chỉ có ${availableCount(c.pool, d.grade, d.skills, d.topic)} câu phù hợp, ít hơn ${d.size} câu đã chọn.`;
 }
 if (!Number.isInteger(d.maxPlayers) || d.maxPlayers < 2 || d.maxPlayers > 45) e.maxPlayers = "Số người từ 2 đến 45.";
 return e;
}

export function buildCreateInput(d: CreateDraft): CreateRoomInput {
 const test: TestSpec = d.kind === "fixed"
  ? { mode: "fixed", slug: d.slug ?? "" }
  : { mode: "mix", grade: d.grade, skills: d.skills, topicSlug: d.skills.length === 1 ? d.topic : null, size: d.size, difficulty: d.difficulty };
 return { name: cleanName(d.name), maxPlayers: d.maxPlayers, timeLimitMinutes: d.time, test };
}

/** Vietnamese message + target field for an API error. */
export function describeRoomError(error: unknown): { message: string; field: "name" | "code" | "form" } {
 if (!(error instanceof RoomsApiError)) return { message: "Có lỗi xảy ra. Hãy thử lại.", field: "form" };
 switch (error.code) {
  case "name_taken": return { message: "Tên này đã có người dùng trong phòng. Hãy chọn tên khác.", field: "name" };
  case "name_rejected": return { message: "Tên này không dùng được, hãy chọn tên khác.", field: "name" };
  case "room_full": return { message: "Phòng đã đủ người.", field: "form" };
  case "room_not_found": return { message: "Không tìm thấy phòng. Mã có 6 ký tự, không phân biệt hoa thường.", field: "code" };
  case "room_not_joinable": return { message: "Phòng đã bắt đầu hoặc đã bị khóa, không vào thêm được.", field: "form" };
  case "already_joined": return { message: "Bạn đã ở trong phòng này.", field: "form" };
  case "not_enough_questions": {
   const available = Number((error.details as { available?: unknown } | undefined)?.available);
   return { message: Number.isFinite(available) ? `Chỉ có ${available} câu phù hợp với bộ lọc này.` : "Không đủ câu hỏi cho bộ lọc này.", field: "form" };
  }
  case "invalid_input": return { message: "Thông tin chưa hợp lệ. Hãy kiểm tra lại.", field: "form" };
  case "rate_limited": return { message: `Bạn thao tác quá nhanh. Thử lại sau ${error.retryAfterSeconds ?? 30} giây.`, field: "form" };
  case "busy": return { message: "Hệ thống đang bận. Hãy thử lại sau ít phút.", field: "form" };
  case "network": return { message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", field: "form" };
  default: return { message: "Có lỗi xảy ra. Hãy thử lại.", field: "form" };
 }
}

/** Code entry: returns the normalized code or a message. */
export function checkCodeInput(raw: string): { code: string } | { error: string } {
 const code = normalizeRoomCode(raw);
 return code ? { code } : { error: "Mã gồm 6 ký tự (chữ và số, không có 0, 1, I, L, O). Hãy kiểm tra lại." };
}
/** Accepts a code or a full room link, e.g. host/luyen-tap-nhom/phong/K7M2QX. */
export function extractRoomCode(raw: string): string {
 const m = /\/phong\/([^/?#\s]+)/i.exec(raw) ?? /[?&]ma=([^&#\s]+)/i.exec(raw);
 return m ? decodeURIComponent(m[1]) : raw;
}

const SKILL_LABEL: Record<string, string> = { "doc-hieu": "Đọc hiểu", "ngu-phap": "Ngữ pháp", "tu-vung": "Từ vựng", "viet-cau": "Viết câu" };
/** One-line room summary for the join screen: "Title · Lớp 7 · Ngữ pháp · 20 câu". */
export function summarizeTest(t: { title?: string; grade?: number; skills?: readonly string[]; size?: number; kind?: string }): string {
 const parts = [t.title ?? (t.kind === "mix" ? "Đề trộn" : "Đề luyện tập")];
 if (t.grade) parts.push(`Lớp ${t.grade}`);
 if (t.skills?.length) parts.push(t.skills.map(s => SKILL_LABEL[s] ?? s).join(", "));
 if (t.size) parts.push(`${t.size} câu`);
 return parts.join(" · ");
}
