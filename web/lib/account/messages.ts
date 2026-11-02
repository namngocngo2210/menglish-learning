import { AccountApiError } from "./client";

const DETAIL: Record<string, string> = {
 password_too_short: "Mật khẩu cần ít nhất 10 ký tự.",
 password_too_long: "Mật khẩu quá dài (tối đa 128 ký tự).",
 password_too_common: "Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác.",
 password_matches_email: "Mật khẩu không được trùng với email hoặc tên đăng nhập.",
 username_rejected: "Tên đăng nhập không phù hợp. Dùng 3–20 ký tự a-z, 0-9, dấu . _ - và đừng dùng tên thật của bé.",
 username_taken: "Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.",
 username_not_changeable: "Tên đăng nhập chỉ đổi được một lần và bạn đã dùng lượt đó.",
 captcha_failed: "Chưa xác nhận được bạn không phải máy. Hãy thử lại.",
 invalid_recovery: "Tên đăng nhập hoặc mã khôi phục không đúng, hoặc mã đã được dùng.",
 email_exists: "Email này đã được dùng cho một tài khoản khác.",
 invalid_token: "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
 nickname_rejected: "Biệt danh không phù hợp. Hãy dùng 2–20 ký tự, không dùng tên thật.",
 consent_text_outdated: "Nội dung đồng ý vừa được cập nhật. Hãy tải lại trang rồi đọc và đồng ý lại.",
 profile_limit_reached: "Mỗi tài khoản có tối đa 5 hồ sơ của con.",
 delete_account_instead: "Hãy xóa tài khoản nếu muốn rút đồng ý này.",
};
const wait = (s?: number) => s ? ` Thử lại sau ${s >= 120 ? `${Math.ceil(s / 60)} phút` : `${s} giây`}.` : "";

/** Vietnamese, non-revealing messages for every account API failure. */
export function accountErrorMessage(e: unknown): string {
 if (!(e instanceof AccountApiError)) return "Có lỗi xảy ra. Hãy thử lại.";
 if (e.detail && DETAIL[e.detail]) return DETAIL[e.detail]!;
 if (e.status === 0) return "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.";
 if (e.status === 401) return "Tên đăng nhập hoặc mật khẩu không đúng.";
 if (e.status === 403) return "Yêu cầu bị từ chối. Hãy tải lại trang rồi thử lại.";
 if (e.status === 409) return "Thao tác xung đột với trạng thái hiện tại. Hãy tải lại trang.";
 if (e.status === 422) return "Thông tin chưa hợp lệ. Hãy kiểm tra lại.";
 if (e.status === 429) return `Bạn thử quá nhiều lần.${wait(e.retryAfter)}`;
 if (e.status === 503) return "Dịch vụ tạm thời chưa sẵn sàng. Hãy thử lại sau.";
 return "Có lỗi xảy ra. Hãy thử lại.";
}
