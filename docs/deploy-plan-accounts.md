# Kế hoạch triển khai tài khoản phụ huynh (S-U4)

**Không tự động.** Mã tài khoản (xác thực, phiên) chỉ lên server khi chủ duyệt từng bước; agent không deploy, không bật cờ. Thiết kế: [user-accounts.md](user-accounts.md), [ADR 0008](adr/0008-user-accounts-parent-first.md). Kết quả pen-test/tải: [pentest-asvs-l2-accounts.md](pentest-asvs-l2-accounts.md). Cờ tắt = không route `/api/v1/account/*`, web 404 các trang tài khoản, luyện tập ẩn danh không đổi.

Hai giai đoạn tách nhau: **(1) đưa mã lên với cờ TẮT** (an toàn, đảo ngược được) và **(2) bật cờ** (chỉ khi mục B xong).

## A. Việc của chủ (OWNER STEPS), theo thứ tự

| # | Việc | Khi nào | Ghi chú |
|---|---|---|---|
| O1 | Chọn nhà gửi email (Resend/Brevo free, subdomain gửi riêng), tạo SPF/DKIM/DMARC | trước giai đoạn 2 | **Chặn bật cờ** (pentest F1). Sau đó giao dev thẻ "adapter email" (mã hiện chỉ có stub) |
| O2 | Luật sư duyệt Chính sách/Điều khoản/đồng ý; điền `[TÊN PHÁP NHÂN]`, `[EMAIL LIÊN HỆ]`, `[NGÀY HIỆU LỰC]`, `[NHÀ GỬI EMAIL]` trong `web/lib/account/legal.ts`; thêm câu "dữ liệu đã xóa vẫn còn trong bản sao lưu tối đa 6 tháng rồi tự hết" (runbook 10.3) | trước giai đoạn 2 | Chữ pháp lý đang là BẢN NHÁP |
| O3 | Google Cloud: hai project, OAuth client Web, redirect URI, màn hình đồng ý, brand verification (runbook 9.1; user-accounts.md mục 5) | trước giai đoạn 2 nếu muốn Google | Không dán secret vào chat/card |
| O4 | Chạy `bash deploy/gen-secrets.sh` (chạy lại an toàn: chỉ thêm tệp thiếu `user_session_hmac_key`, và tạo `google_client_secret` **rỗng**). Dán client secret Google vào `~/beejunior-secrets/google_client_secret` bằng tay (`chmod 600`) | giai đoạn 1 (bắt buộc: compose mới cần tệp tồn tại) | `user_session_hmac_key` phải khác `session_hmac_key`; **lưu bản sao an toàn** (10.3: dùng để xóa lại sau khôi phục) |
| O5 | Đặt `TRUST_PROXY=<CIDR mạng menglish-proxy>` trong `deploy/.env` (deploy-plan-s-f.md B) | giai đoạn 1 | Bắt buộc trước khi bật cờ (pentest F6) |
| O6 | Cài dòng cron `accounts:purge-expired` từ `deploy/ops/crontab.example` | giai đoạn 1 | Không có dữ liệu thì chạy vô hại |
| O7 | Xác nhận với luật sư các điểm "cần xác nhận" (user-accounts.md mục 9): thời hạn xóa/72 giờ, thông báo vi phạm, chuyển dữ liệu ra nước ngoài (nhà gửi email) | trước giai đoạn 2 | |
| O8 | Duyệt bật cờ, giờ thấp điểm, ngoài giờ học | giai đoạn 2 | |

## B. Điều kiện bật cờ (tất cả phải đúng)
1. O1 xong và adapter email đã merge + thử gửi thật (xác minh và đặt lại).
2. O2, O5, O7 xong; Chính sách mới đã lên và chủ duyệt.
3. `watchdog.sh` xanh, có backup trong 24 giờ, `restore-test` PASS gần nhất.
4. Google (nếu bật): O3 xong và `GOOGLE_*` đủ ba biến (runbook 9.2).

## C. Giai đoạn 1 — mã lên, cờ TẮT
Thứ tự (mỗi bước chủ duyệt; lệnh theo runbook mục 2–3):
1. Boss merge PR; ghi tag image đang chạy (`docker inspect -f '{{.Config.Image}}' beejunior-api-1 beejunior-web-1`) để quay lại.
2. O4, O5. `deploy/.env` **không** đặt `ACCOUNTS_ENABLED` (mặc định `false`).
3. `bash deploy/ops/backup.sh`.
4. Dựng image `api` và `web` tag mới. Migration **0027–0038 chỉ thêm bảng, cột, chỉ mục** (không đổi dữ liệu cũ; có bước down): `dc run --rm migrate`. Kiểm `dc logs migrate` báo `up: N migration(s)`.
5. `dc up -d api web` (trần `api` mới 192 MB). Đợi `healthy`.
6. Kiểm với cờ tắt: `curl -s -o /dev/null -w '%{http_code}' https://beejunior.meducation.vn/api/v1/account/me` ⇒ **404**; `/dang-nhap` ⇒ 404; một đề thi bất kỳ làm được, chấm điểm bình thường; `docker stats --no-stream` `api` < 110 MB.
7. Theo dõi 24 giờ `watchdog.log`, `docker stats`. Quay lại: chạy lại tag cũ (migration thêm bảng không cản bản cũ).

## D. Giai đoạn 2 — bật cờ (sau mục B)
1. Backup mới. Đặt trong `deploy/.env` (tên biến, không chứa secret; secret ở `~/beejunior-secrets`): `ACCOUNTS_ENABLED=true`, `ACCOUNTS_ORIGIN=https://beejunior.meducation.vn`; nếu có Google: `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET_FILE=/run/secrets/google_client_secret`, `GOOGLE_REDIRECT_URI=https://beejunior.meducation.vn/api/v1/account/oauth/google/callback`.
2. `web` đọc cờ lúc **build và chạy**: dựng lại `web` (`ACCOUNTS_ENABLED` đã là build arg trong compose) rồi `dc up -d --force-recreate api web`.
3. `dc logs --tail 30 api`: không có `Missing environment`/`Invalid environment`; `/readyz` OK.
4. Smoke: runbook 9.4 (Google) và đăng ký email ➜ nhận thư ➜ xác minh ➜ tạo hồ sơ con ➜ đồng ý ➜ làm một đề ➜ xuất dữ liệu ➜ xóa tài khoản thử. Luyện tập ẩn danh vẫn chạy. Trang tài khoản có `noindex`, `no-store`. Log không chứa email/mật khẩu/token.
5. 24 giờ đầu: `docker stats` `api` (đỉnh dự kiến < 160 MB), số 429 đăng nhập, số tài khoản `pending` mới (ngưỡng Turnstile ở pentest F10).

## E. Rollback
Đặt `ACCOUNTS_ENABLED=false` (hoặc xóa dòng), dựng lại `web`, `dc up -d --force-recreate api web`. Route về 404; dữ liệu giữ nguyên (migration chỉ thêm). Chỉ tắt Google: bỏ ba biến `GOOGLE_*`. Gỡ hẳn schema chỉ khi chủ duyệt: `dc run --rm migrate node dist/main.mjs migrate --down --count 12` (mất dữ liệu tài khoản; backup trước).

## F. Việc dev còn lại sau PR này (thẻ riêng, không nằm trong S-U4)
Adapter email thật (chặn bật cờ); job xóa nhàn rỗi 24 tháng + email nhắc (trước 11/2028); nút "Đăng nhập bằng Google" và luồng liên kết ở web nếu chưa đủ; nhập tiến độ ẩn danh vào hồ sơ; chặn `at` tương lai (pentest F7, tùy chọn).
