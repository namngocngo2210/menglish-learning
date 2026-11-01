# Bảo mật

Giai đoạn 1 **học sinh công khai không cần tài khoản**, không có thanh toán. Điều này **không áp dụng cho quản trị viên duy nhất là chủ sở hữu**. Trọng tâm là chống lạm dụng, bảo vệ đáp án, bảo vệ hạ tầng và tuân thủ dữ liệu trẻ em.

## Ranh giới quản trị một chủ — thiết kế, chưa triển khai

- Quản trị chỉ có **một chủ sở hữu**, không nhân viên/vai trò; học sinh công khai không cần tài khoản. Fixture thiết kế ở `docs/previews/sky-blue-v2/` chỉ dùng mock data và state trong bộ nhớ. Màn hình đăng nhập mẫu không xác thực; hash/route frontend không phải biện pháp bảo mật. Không nhập mật khẩu thật, không lưu mật khẩu/token; bản static export không có vùng quản trị được bảo vệ.
- Khi được chủ sở hữu phê duyệt triển khai riêng: đăng nhập/session phía server cho **một chủ**, kiểm tra xác thực và phân quyền trên **mọi API admin** (không chỉ ẩn menu), cookie phiên `HttpOnly`, `Secure`, `SameSite` thích hợp; chống CSRF khi dùng cookie, xoay vòng/hủy phiên, rate limit đăng nhập và hành động nhạy cảm.
- Validate dữ liệu/giới hạn kích thước và tốc độ; audit log (bảng `audit_log`) cho thao tác publish/delete/crawl/config, không ghi bí mật hay dữ liệu cá nhân không cần thiết.
- Cấu hình nguồn không cho phép fetch URL tùy ý: cần allowlist nguồn/giao thức, kiểm tra DNS/IP và từng redirect, chặn loopback/private/link-local/metadata, giới hạn timeout/kích thước/kiểu nội dung để chống SSRF. Không coi validation ở frontend là đủ.
- Ingestion luôn **quarantine/draft → chủ sở hữu kiểm tra nguồn, giấy phép và nội dung → publish**; không auto-publish sau crawl hoặc parse thành công.
- Auth, schema, API admin, worker/crawler và cơ chế bảo vệ trên là **khoảng trống kiến trúc**, không được triển khai hay khẳng định hoạt động trong PR thiết kế. Cần chủ sở hữu duyệt riêng trước khi thực hiện.

## Hạ tầng

- Chỉ Caddy mở ra internet (HTTPS, tự gia hạn chứng chỉ). `api`, `postgres`, `redis`, `crawler` không publish cổng ra host.
- Mạng Docker nội bộ; chỉ `web` và `api` nối vào mạng của Caddy.
- Container chạy user không phải root, filesystem chỉ đọc (trừ volume cần ghi), `no-new-privileges`, giới hạn CPU/RAM.
- Postgres: user riêng cho `api` (chỉ SELECT/INSERT cần thiết), user riêng cho `crawler`, user migrate tách riêng.
- Redis: có mật khẩu, chỉ trong mạng nội bộ, tắt lệnh nguy hiểm (`FLUSHALL`, `CONFIG`).
- Secret chỉ trong `.env` trên server (quyền 600), không commit; repo có `.env.example`.
- Backup Postgres hằng ngày, thử khôi phục định kỳ.

## API (Gin)

- Rate limit: xem [Rate limit](#rate-limit).
- Kiểm tra đầu vào bằng `binding` (kiểu, độ dài, giới hạn giá trị); giới hạn body 64 KB.
- Truy vấn qua `sqlc`/`pgx` có tham số → không SQL injection.
- **Đáp án không lộ**: API đề không trả `is_correct`; server chấm. `attempt_token` ký HMAC-SHA256 (attempt id + hạn dùng), mỗi token nộp 1 lần, hết hạn sau 3 giờ.
- CORS chỉ cho domain của site; endpoint nội bộ (`/api/v1/internal/*`) yêu cầu khóa nội bộ và chỉ nhận từ mạng nội bộ.
- Lỗi trả mã + thông điệp chung; log chi tiết phía server, không ghi IP thô (lưu hash có salt), không log dữ liệu nhạy cảm.
- Header: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.

## Frontend (Next.js)

- Content-Security-Policy: chỉ script của site + AdSense; `frame-ancestors 'none'`; `Permissions-Policy` tắt camera/micro/vị trí ở giai đoạn 1.
- Nội dung crawl được làm sạch khi import (chỉ giữ văn bản thuần) và render dưới dạng text, không dùng `dangerouslySetInnerHTML` với dữ liệu nguồn.
- Không lưu dữ liệu cá nhân ở `localStorage` (chỉ tiến độ ẩn danh).

## Chống cào dữ liệu và bot

- Rate limit theo IP + mã thiết bị; tăng thời gian chờ khi một IP lấy quá nhiều đề khác nhau trong 1 giờ.
- `robots.txt` chặn bot cào dữ liệu đã biết (không chặn Googlebot/Bingbot).
- Khi traffic lớn: cân nhắc Cloudflare (WAF, chống DDoS) phía trước Caddy.

## Dữ liệu trẻ em (Nghị định 13/2023/NĐ-CP)

- Giai đoạn 1 không thu thập dữ liệu cá nhân: không đăng nhập, kết quả chỉ lưu ẩn danh (`device_hash`).
- AdSense ở chế độ trẻ em (child-directed, không quảng cáo theo hành vi).
- Có trang Chính sách quyền riêng tư và Điều khoản sử dụng.
- Giai đoạn 2: tài khoản do phụ huynh tạo và đồng ý; mật khẩu băm argon2id; cookie phiên `HttpOnly`, `Secure`, `SameSite=Lax`; chống CSRF; phụ huynh xem/xóa được dữ liệu của con.

## Quy trình

- CI chặn merge khi: `govulncheck` có lỗ hổng, `npm audit` mức high trở lên, `gitleaks` phát hiện secret.
- Dependabot cho Go modules, npm, GitHub Actions, Docker base image.
- Reviewer kiểm tra bảo mật mỗi PR (đầu vào, phân quyền, XSS, secret, header).
- Ops: watchdog theo dõi site (HTTP, 5xx, 429), định kỳ kiểm tra cổng mở trên host.

## Rate limit

Hai lớp, bộ đếm trong Redis.

### Lớp 1 — Caddy (tùy chọn)

Giới hạn chung theo IP cho mọi đường dẫn (mặc định 600 request/phút/IP, cao vì học sinh ở trường dùng chung IP). Cần Caddy có module `rate_limit`; nếu chưa thay bản Caddy dùng chung với MEnglish thì lớp 2 đảm nhận.

### Lớp 2 — Middleware Gin + Redis

Thuật toán cửa sổ trượt (sliding window). Khóa đếm = IP thật + mã thiết bị ẩn danh (cookie), kèm một mức trần riêng theo IP.

| Endpoint | Theo IP + thiết bị | Trần theo IP |
|----------|--------------------|--------------|
| `GET /api/v1/tests/{slug}`, `/topics`, `/grades` | 60/phút | 600/phút |
| `POST /api/v1/tests/random` | 10/phút, 100/ngày | 200/phút |
| `POST /api/v1/attempts` | 20/phút; 1 lần/token | 300/phút |
| `/api/v1/internal/*` | chỉ nội bộ, có khóa | — |

- IP thật lấy từ `X-Forwarded-For`, chỉ tin khi request đến từ Caddy (danh sách proxy tin cậy của Gin).
- Vượt giới hạn: `429 Too Many Requests` + `Retry-After`; giao diện hiện "Bạn làm nhanh quá, thử lại sau X giây".
- IP lấy quá nhiều đề khác nhau trong 1 giờ: tăng dần thời gian chờ.
- Redis lỗi: chuyển sang bộ đếm trong bộ nhớ của tiến trình (fail-open có giới hạn), không chặn toàn bộ người dùng.
- Mọi ngưỡng cấu hình qua biến môi trường.
- Kiểm thử: test tải xác nhận nhận 429 khi vượt ngưỡng, người dùng thường không bị ảnh hưởng, Redis tắt vẫn phục vụ.

## Ghi chú S-C (vòng sửa 1)
- OpenAPI `/api/v1/openapi.json` gồm cả `/api/v1/admin/*` và `POST /api/v1/public/reports` (khai báo trong `api/src/server/admin-openapi.ts`; test so khớp với bảng route của Fastify).
- `TOTP verify/disable` dùng chung bộ đếm sai + khoá 15 phút với đăng nhập (10 lần sai). Khoá-DoS: chỉ phiên đã đăng nhập của chính tài khoản mới kích hoạt được; khoá cũng chặn đăng nhập tài khoản đó 15 phút.
- `TRUST_PROXY` (mặc định tắt): chỉ đặt `true` hoặc IP/CIDR của Caddy khi api nằm sau proxy; để trống thì bỏ qua `X-Forwarded-For`.
- Chưa làm: chống replay mã TOTP trong cửa sổ 30 s (cần cột lưu step đã dùng + migration; mã sai đã bị giới hạn lần thử).
