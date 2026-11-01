# ADR 0002: Các quyết định backend R0 và D2–D14

- Trạng thái: R0 **được chấp nhận** (chủ quyết định 2026-11-01, blueprint §4). D2–D14: **đề xuất — là khuyến nghị của dev, chưa có xác nhận riêng của chủ**; chủ chuyển từng dòng sang "được chấp nhận" (sửa cột Trạng thái, một PR nhỏ) hoặc thay thế bằng ADR mới.
- Ngày: 2026-11-01
- Người quyết định: owner (Babay1903)
- Liên quan: [backend-decisions.md](../backend-decisions.md) (nguồn lý do và điều kiện đổi ý), [backend-blueprint.md](../backend-blueprint.md), ADR 0001 (D1)

## Bối cảnh

Blueprint liệt kê các quyết định cần chủ. D1 đã tách thành ADR 0001. Tệp này ghi phần còn lại để mỗi quyết định có chỗ tham chiếu ổn định (`ADR-0002#d5`) mà không cần đọc lại cả blueprint. Bảng dưới là **kết quả**; lý do/điều kiện đổi ý nằm ở `backend-decisions.md` — không sao chép để khỏi lệch.

## Quyết định

| # | Kết quả | Trạng thái |
|---|---|---|
| R0 | Trang công khai SSR từ DB + cache HTML ngắn hạn, trả bản cũ khi DB chết; static/ISR chỉ dự phòng | Được chấp nhận |
| D2 | Không dùng Redis (rate limit trong RAM/Postgres, hàng đợi trong Postgres) | Đề xuất |
| D3 | TOTP 2FA cho admin, tuỳ chọn bật từ S-C | Đề xuất |
| D4 | Edge-cache nhỏ trong container `web`; đánh giá `use cache` ở S-B | Đề xuất |
| D5 | Admin là SPA tĩnh do `api` phục vụ ở `/admin` | Đề xuất |
| D6 | `pg_dump` 03:30 hằng ngày; giữ 14 ngày + 8 tuần + 6 tháng; kiểm khôi phục hằng tuần; thêm bản mã hoá ngoài máy | Đề xuất |
| D7 | Chủ chạy `deploy/gen-secrets.sh` một lần trên máy chủ; mật khẩu admin nhập qua TTY; agent không đọc | Đề xuất |
| D8 | Cap: web 384 MB, api 160, postgres 256, worker 320 (≈ 1,12 GB); rooms +192 MB | Đề xuất |
| D9 | Chấm điểm giữ ở trình duyệt; thêm `POST /attempts` sau nếu cần | Đề xuất |
| D10 | Cho phép sửa Caddy dùng chung (`/api/*`, `/admin*`, upstream `web:3100`, `encode zstd gzip`), ops `caddy validate` + giữ file cũ | Đề xuất |
| D11 | DB là nguồn sự thật nội dung sau khi bảng đối chiếu = 0; JSON trong git thành seed đóng băng | Đề xuất |
| D12 | Chưa đặt Cloudflare phía trước | Đề xuất |
| D13 | `web` đọc DB trực tiếp bằng role chỉ-đọc `bj_web` trên view `v_public_*` | Đề xuất |
| D14 | Giữ tiến trình `rooms` riêng, dùng chung `packages/core` | Đề xuất |

## Phương án đã cân nhắc

Xem cột "Đổi ý khi" trong `backend-decisions.md` và các phương án ở blueprint §2–§6.

## Hệ quả

- Một quyết định đang "Đề xuất" **không** được dùng làm cớ để bỏ qua nó trong sprint: dev làm theo khuyến nghị, nhưng chạm vào hạ tầng máy chủ (D6, D7, D8, D10) vẫn cần chủ duyệt riêng (blueprint §6.7).
- Đổi một dòng = ADR mới thay thế (mẫu `0000-template.md`), không sửa lịch sử.
