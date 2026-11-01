export type Skill = "doc-hieu" | "ngu-phap" | "tu-vung" | "viet-cau";
export type RoomState = "lobby" | "playing" | "results" | "closed";
export type PlayerStatus = "joined" | "playing" | "submitted" | "left";
export type TestSpec =
 | { mode: "fixed"; slug: string }
 | { mode: "mix"; grade: 6 | 7 | 8 | 9; skills: Skill[]; topicSlug: string | null; size: 10 | 20 | 40; difficulty: "balanced" | "easy" | "medium" | "hard" };
export interface CreateRoomInput { name: string; maxPlayers?: number; timeLimitMinutes?: 15 | 30 | null; test: TestSpec }
export interface RoomSettings { maxPlayers: number; timeLimitMinutes: 15 | 30 | null; locked: boolean; test: { title?: string; grade?: number; skills?: Skill[]; size?: number; kind?: "fixed" | "mix" } & Partial<TestSpec> }
export interface PlayerView { playerId: string; name: string; isHost: boolean; status: PlayerStatus; connected: boolean }
export interface Me { playerId: string; name?: string; isHost: boolean; status?: PlayerStatus; answeredCount?: number }
export interface RoomSnapshot {
 code: string; state: RoomState; version: number; serverNow: string; settings: RoomSettings;
 startedAt: string | null; deadlineAt: string | null; players: PlayerView[]; submittedCount: number; playerCount: number; me: Me;
}
export interface CreateRoomResponse { code: string; me: Me; room: RoomSnapshot }
export interface JoinResponse { code?: string; me: Me; room?: RoomSnapshot }
export interface PreviewResponse { test: RoomSettings["test"]; playerCount: number; maxPlayers: number; joinable: boolean }
export interface QuizOption { key: string; text: string }
/** Deliberately has no correctKey/explanation: the play screen must never receive them. */
export interface QuizQuestion { id: string; passageId: string | null; stem: string; options: QuizOption[] }
export interface QuizPassage { id: string; title: string; body: string }
export interface QuizResponse { questions: QuizQuestion[]; passages: QuizPassage[]; answers: Record<string, string> }
export interface RankingRow { rank: number; playerId: string; name: string; correct: number; total: number; percent: number; isMe: boolean; note: "left" | null }
export interface ResultsResponse { ranking: RankingRow[]; me: { correct: number; total: number; rank: number }; duel: null | { outcome: "win" | "draw" | "lose"; myCorrect: number; theirCorrect: number } }
export interface ReviewItem { questionId: string; stem: string; options: QuizOption[]; selectedKey: string | null; correctKey: string; explanation?: string | null }
export type ReportReason = "ten_khong_phu_hop" | "noi_dung_sai" | "khac";
export type RoomSettingsPatch = Partial<Pick<RoomSettings, "maxPlayers" | "timeLimitMinutes" | "locked">> & { test?: TestSpec };

export const ROOM_ERROR_CODES = ["invalid_input", "no_session", "not_host", "room_not_found", "room_not_joinable", "room_full", "name_taken", "bad_state", "name_rejected", "not_enough_questions", "rate_limited", "busy", "network", "unknown"] as const;
export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

export const SSE_EVENTS = ["snapshot", "player_joined", "player_left", "player_kicked", "player_connection", "host_changed", "settings_changed", "game_started", "progress", "results_ready", "rematch", "room_closed", "superseded", "server_restarting"] as const;
export type SseEventName = (typeof SSE_EVENTS)[number];
export type CloseReason = "host_closed" | "idle" | "empty" | "maintenance" | "expired";
