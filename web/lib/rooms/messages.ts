import { RoomsApiError } from "./client";
import type { RoomErrorCode } from "./types";

const TEXT: Partial<Record<RoomErrorCode, string>> = {
 not_host: "Chỉ chủ phòng làm được việc này.",
 not_all_ready: "Chưa phải ai cũng sẵn sàng. Đang cập nhật…",
 bad_state: "Phòng đã chuyển sang bước khác. Đang cập nhật…",
 no_session: "Em không còn trong phòng này.",
 rate_limited: "Em thao tác hơi nhanh. Chờ một chút rồi thử lại.",
 busy: "Máy chủ đang bận. Thử lại sau ít giây.",
 network: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
 room_not_found: "Phòng không còn tồn tại.",
 invalid_input: "Yêu cầu không hợp lệ.",
};
export function errorMessage(error: unknown): string {
 if (error instanceof RoomsApiError) {
  const base = TEXT[error.code] ?? "Có lỗi xảy ra. Em thử lại nhé.";
  return error.code === "rate_limited" && error.retryAfterSeconds ? `${base} (khoảng ${error.retryAfterSeconds} giây)` : base;
 }
 return "Có lỗi xảy ra. Em thử lại nhé.";
}
