# ADR 0009: Gửi email bằng SMTP trung lập nhà cung cấp (nodemailer), api nối `bj-egress`

- Trạng thái: **đề xuất** (chờ chủ duyệt qua PR)
- Ngày: 2026-11-02
- Người quyết định: owner (Babay1903)
- Liên quan: thẻ kanban t_91a743a1, [ADR 0008](0008-user-accounts-parent-first.md), [runbook §11](../runbook.md), standards §10 (dependency)

## Bối cảnh

Tài khoản phụ huynh cần gửi email xác minh/đặt lại mật khẩu. Chủ muốn chạy **ngay** bằng SMTP của một Gmail tạm (mật khẩu ứng dụng), sau đó đổi sang Resend/Brevo mà **không sửa mã**. `api` nằm trên mạng `bj-internal` (`internal: true`, không ra Internet) nên hiện không thể gửi.

## Quyết định

1. **Adapter SMTP trung lập** `api/src/accounts/smtp.ts`, cấu hình chỉ bằng tên biến: `MAIL_TRANSPORT=smtp|none` (mặc định `none` ⇒ vẫn là adapter "chưa cấu hình"), `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS mặc định, 465 TLS ngầm), `SMTP_USER`, `SMTP_PASS_FILE` (mật khẩu đọc từ tệp secret, loại bỏ khoảng trắng của mật khẩu ứng dụng Google), `MAIL_FROM`, `MAIL_REPLY_TO` tùy chọn. Đổi sang Resend/Brevo chỉ là đổi các giá trị này.
2. **Bắt buộc TLS, kiểm chứng chứng chỉ BẬT** (`requireTLS`, `rejectUnauthorized`, TLS ≥ 1.2); máy chủ không có STARTTLS ⇒ từ chối, không gửi plain. Timeout kết nối 10 s, gửi 20 s; thử lại tối đa 2 lần (không thử lại lỗi đăng nhập hay 5xx); hàng đợi trong tiến trình tối đa 100 thư, một luồng gửi, nên handler không chờ SMTP. Log chỉ có tên sự kiện + mã lỗi (`mail_sent`, `mail_retry`, `mail_send_failed`, `mail_queue_full`), không địa chỉ, mật khẩu hay nội dung; lỗi ném ra đã được rút gọn còn mã lớp lỗi.
3. **Dependency: `nodemailer@^10.3.1`** (MIT-0, trong allowlist; 0 phụ thuộc gián tiếp; ~1,7 MB cài; `npm audit --audit-level=high` sạch). Chỉ nạp trong `api`, được esbuild đóng gói vào `dist` (image runtime không có `node_modules`). Lý do chọn thay vì tự viết client `node:tls`: SMTP có nhiều chi tiết dễ sai (STARTTLS, AUTH, dot-stuffing, mã hóa tiêu đề UTF-8 cho tiếng Việt, header injection) và đường email là đường bảo mật (xác minh/đặt lại mật khẩu); thư viện được dùng rộng rãi giảm rủi ro hơn ≈150 dòng tự bảo trì. Khác với ADR 0007 (S3 chỉ 4 thao tác, có vector kiểm thử công bố), ở đây không có vector tương đương.
4. **Egress:** gắn `api` vào mạng `bj-egress` (đã có cho `worker`) trong `deploy/compose.yml`. Không đụng firewall host, Caddy hay container khác.
5. **Secret:** tệp `smtp_pass` (Docker secret, như các secret khác); `gen-secrets.sh` chỉ tạo tệp **rỗng** 600 để compose gắn được, chủ tự dán mật khẩu ứng dụng. Không giá trị nào trong repo.
6. CLI `mail:test <to>` gửi một thư thử, chỉ in `ok` hoặc `fail <mã lỗi>`.
7. `ACCOUNTS_ENABLED` vẫn mặc định TẮT; cấu hình mail chỉ được đọc khi bật tài khoản (`mail:test` luôn chạy được).

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| nodemailer (chọn) | Đã được kiểm chứng, 0 phụ thuộc con, MIT-0 | +1,7 MB; thêm một dependency phải theo dõi bản vá |
| Client `node:tls` tự viết | Không dependency | Tự chịu rủi ro lỗi giao thức/bảo mật ở đường xác thực |
| API HTTP của Resend/Brevo | Không cần cổng SMTP | Gắn vào một nhà cung cấp, không dùng được Gmail tạm |

## Hệ quả và đánh đổi bảo mật

- `bj-egress` là bridge thường: **api có thể kết nối ra mọi địa chỉ Internet**, không chỉ `smtp.gmail.com:587/465` (Compose không lọc theo đích; lọc cần firewall host, ngoài phạm vi). Giảm thiểu: api chạy `read_only`, `cap_drop: ALL`, `no-new-privileges`, giới hạn RAM/PID; mã chỉ có hai đích ra ngoài (SMTP và Google OIDC, vốn cũng cần egress); route `/api/*` không có URL do người dùng cung cấp để fetch (không có SSRF qua đầu vào). Khi có nhu cầu siết chặt: thêm quy tắc `DOCKER-USER` theo IP/cổng (việc ops, ADR riêng).
- Mật khẩu ứng dụng Gmail nằm trên host (tệp 600) và trong bộ nhớ api; thu hồi bằng cách xóa mật khẩu ứng dụng trong tài khoản Google.
- Gmail có hạn mức (~500 người nhận/ngày), có thể vào spam và có thể chặn truy cập tự động; đây là giải pháp **tạm** (runbook §11 ghi đường chuyển sang Resend/Brevo).
- Đổi ý khi: nhà cung cấp chính thức được chọn (đổi giá trị biến, không đổi mã), hoặc cần SPF/DKIM tùy biến (cân nhắc API của nhà cung cấp).
