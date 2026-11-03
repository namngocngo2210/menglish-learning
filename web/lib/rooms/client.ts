import { ROOM_ERROR_CODES, type CreateRoomInput, type CreateRoomResponse, type JoinResponse, type PreviewResponse, type QuizResponse, type ReportReason, type ResultsResponse, type ReviewItem, type RoomErrorCode, type RoomSettingsPatch, type RoomSnapshot } from "./types";
import { normalizeRoomCode } from "./code";

export class RoomsApiError extends Error {
 constructor(public status: number, public code: RoomErrorCode, message: string, public retryAfterSeconds?: number, public details?: Record<string, unknown>) {
  super(message); this.name = "RoomsApiError";
 }
}
const knownCode = (code: unknown): RoomErrorCode => ROOM_ERROR_CODES.includes(code as RoomErrorCode) ? (code as RoomErrorCode) : "unknown";

export type SnapshotResult = { notModified: true } | { notModified: false; room: RoomSnapshot; etag: string | null };

export function createRoomsClient({ baseUrl = "/rt", fetchImpl }: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
 // Same-origin only: a path like "/rt" (protocol-relative "//host" would leave the origin).
 if (!/^\/(?!\/)[A-Za-z0-9/_-]*$/.test(baseUrl)) throw new Error("Rooms baseUrl must be a same-origin path");
 const base = baseUrl.replace(/\/+$/, "");
 const doFetch: typeof fetch = (...args) => (fetchImpl ?? fetch)(...args);
 const room = (code: string) => {
  const c = normalizeRoomCode(code);
  if (!c) throw new RoomsApiError(404, "room_not_found", "Mã phòng không hợp lệ");
  return `${base}/rooms/${c}`;
 };
 async function raw(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
   res = await doFetch(path, { ...rest, credentials: "same-origin", cache: "no-store", headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, ...(json !== undefined ? { body: JSON.stringify(json) } : {}) });
  } catch {
   throw new RoomsApiError(0, "network", "Không kết nối được máy chủ");
  }
  if (res.ok || res.status === 304) return res;
  let body: { error?: { code?: string; message?: string } & Record<string, unknown> } | null = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  const retry = Number(res.headers.get("Retry-After"));
  throw new RoomsApiError(res.status, knownCode(body?.error?.code), body?.error?.message ?? res.statusText, Number.isFinite(retry) && retry > 0 ? retry : undefined, body?.error);
 }
 const json = async <T,>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> => {
  const res = await raw(path, init);
  return (res.status === 204 ? undefined : await res.json()) as T;
 };
 const post = <T = unknown,>(path: string, body: unknown = {}) => json<T>(path, { method: "POST", json: body });
 return {
  create: (input: CreateRoomInput) => post<CreateRoomResponse>(`${base}/rooms`, input),
  preview: (code: string) => json<PreviewResponse>(`${room(code)}/preview`),
  join: (code: string, name: string) => post<JoinResponse>(`${room(code)}/join`, { name }),
  async snapshot(code: string, etag?: string | null): Promise<SnapshotResult> {
   const res = await raw(`${room(code)}/snapshot`, { headers: etag ? { "If-None-Match": etag } : {} });
   if (res.status === 304) return { notModified: true };
   return { notModified: false, room: (await res.json()) as RoomSnapshot, etag: res.headers.get("ETag") };
  },
  settings: (code: string, patch: RoomSettingsPatch) => post(`${room(code)}/settings`, patch),
  kick: (code: string, playerId: string) => post(`${room(code)}/kick`, { playerId }),
  ready: (code: string, ready: boolean) => post(`${room(code)}/${ready ? "ready" : "unready"}`),
  start: (code: string) => post(`${room(code)}/start`),
  quiz: (code: string) => json<QuizResponse>(`${room(code)}/quiz`),
  putAnswer: (code: string, questionId: string, key: string | null) => json(`${room(code)}/answers`, { method: "PUT", json: { questionId, key } }),
  submit: (code: string) => post(`${room(code)}/submit`),
  finish: (code: string) => post(`${room(code)}/finish`),
  results: (code: string) => json<ResultsResponse>(`${room(code)}/results`),
  review: (code: string) => json<ReviewItem[]>(`${room(code)}/review`),
  rematch: (code: string) => post(`${room(code)}/rematch`),
  leave: (code: string) => post(`${room(code)}/leave`),
  close: (code: string) => post(`${room(code)}/close`),
  report: (code: string, reason: ReportReason) => post(`${room(code)}/report`, { reason }),
 };
}
export type RoomsClient = ReturnType<typeof createRoomsClient>;
