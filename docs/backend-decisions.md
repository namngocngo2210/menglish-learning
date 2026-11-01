# Quyết định cần chủ — Backend/DB BeeJunior

Chi tiết: [backend-blueprint.md](backend-blueprint.md). Cột "Khuyến nghị" là đề xuất của dev; bạn trả lời "theo khuyến nghị" cho cả bảng nếu đồng ý.

| # | Quyết định | Khuyến nghị | Đổi ý khi |
|---|---|---|---|
| **R0** | Render công khai | **SSR từ DB (đã quyết 1/11)** + cache HTML ngắn hạn, stale khi DB chết; static/ISR chỉ dự phòng | — |
| D1 | Stack backend | **B: TypeScript (Fastify + Kysely), monorepo, tái dùng mixer/crawler/zod** | cần ≥ 2 replica, RAM < 700 MB, hoặc chỉ có người viết Go |
| D2 | Redis | **Không dùng** (rate limit trong RAM/Postgres, hàng đợi trong Postgres) | chạy ≥ 2 replica `api`/`web`, hoặc rooms scale ngang |
| D3 | 2FA (TOTP) cho admin | **Có, tuỳ chọn bật ngay từ S-C** (thêm ≈ 1 ngày) | không muốn quản lý mã khôi phục |
| D4 | Cách cài cache HTML của SSR | **Edge-cache nhỏ trong container `web`** (đã đo); đánh giá thêm `use cache` của Next ở S-B | Caddy dùng chung được phép thêm module cache |
| D5 | Giao diện admin | **SPA tĩnh do `api` phục vụ ở `/admin`** (tách khỏi bundle công khai) | muốn dùng chung hoàn toàn component với `web` |
| D6 | Sao lưu | **Cloudflare R2 đã chốt (1/11)**: `pg_dump` 03:30 hằng ngày → `~/backups/beejunior/` + bản mã hoá phía client tải lên bucket riêng; giữ 14 ngày + 8 tuần + 6 tháng; thiết kế/runbook: [backup-offsite-r2.md](backup-offsite-r2.md) | không cần DR ngoài máy |
| D7 | Bí mật | Bạn chạy `deploy/gen-secrets.sh` **một lần trên máy chủ**, mật khẩu admin tự nhập qua TTY khi `admin:create`; agent không đọc | muốn ops làm thay (cần duyệt riêng) |
| D8 | Giới hạn tài nguyên | web 384 MB/1 CPU, api 160, postgres 256, worker 320 ⇒ **cap 1,12 GB** (thường trực ≈ 0,4–0,5 GB [ước]); khi mở rooms +192 MB | bạn muốn trần ≤ 1 GB (giảm worker/web, chấp nhận rủi ro) |
| D9 | Chấm điểm | **Giữ chấm ở trình duyệt** (như hôm nay; đáp án nằm trong trang) — docs cũ ghi "server chấm" nhưng chưa từng làm | muốn chống sao chép đáp án / thống kê chính xác → thêm `POST /attempts` giai đoạn sau |
| D10 | Sửa Caddy dùng chung | Cho phép thêm `/api/*`, `/admin*`, đổi upstream `web:3100`, `encode zstd gzip`; ops `caddy validate` + giữ file cũ để rollback | — |
| D11 | Nguồn sự thật nội dung | DB sau khi bảng đối chiếu = 0; JSON trong git thành "seed đóng băng" | — |
| D12 | Cloudflare phía trước | **Chưa** (sau khi có traffic thật) | bị cào/DDoS hoặc cần cache edge |
| D13 | `web` đọc DB | **Trực tiếp bằng role chỉ-đọc `bj_web` trên view công khai** (nhanh, ít RAM) | muốn web không bao giờ giữ mật khẩu DB → gọi `api` nội bộ (thêm 1 chặng) |
| D14 | Rooms sau backend | Giữ tiến trình `rooms` riêng, cùng monorepo/`packages/core` | muốn gom vào `api` để bớt 1 container |

Cần duyệt riêng trên máy chủ (agent không tự làm): container mới + volume, đổi cấu hình Caddy, cron backup, tạo secret/tài khoản admin — xem [§6.7](backend-blueprint.md#67-cần-chủ-duyệt-trên-máy-chủ-agent-không-tự-làm).
