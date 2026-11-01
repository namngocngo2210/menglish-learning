# Rooms (luyện tập nhóm) — vận hành

Dịch vụ `rooms/` (Node 22, `node:http`, trạng thái chỉ trong RAM, không DB/secret/outbound). Thiết kế: `group-practice*.md`; biến môi trường: `rooms/README.md`.

## Thành phần
| Thứ | Giá trị |
|-----|---------|
| Image / container | `menglish-learning-rooms:latest` / `menglish-learning-rooms` |
| Dockerfile | `rooms/Dockerfile` (context = gốc repo; ignore ở `rooms/Dockerfile.dockerignore`) |
| Compose | service `rooms` trong `docker-compose.yml` và `deploy/compose.yml` (chỉ `expose 3100`, mạng `menglish-proxy`, 256 MB, 0,5 CPU, `read_only`, `no-new-privileges`, tmpfs `/tmp`, user 1001) |
| Ngân hàng đề | `bank-rooms.json` (có đáp án) sinh lúc build image từ `web/content/tests` (chỉ câu `published`), nằm **trong image** (`/app/data`), web không phục vụ |
| Caddy | khối `beejunior.meducation.vn` trong `menglish-main/docker/proxy/Caddyfile`: `handle /rt/* { reverse_proxy menglish-learning-rooms:3100 { flush_interval -1 } }` (SSE không buffer) |
| Health | `GET /rt/healthz` (luôn trả 200 kể cả khi cờ tắt; có `enabled`, `rooms`, `players`, `sse`, `rssMb`) — là HEALTHCHECK của image |

## Build / chạy
```bash
docker build -f rooms/Dockerfile -t menglish-learning-rooms:latest .     # từ gốc repo (dùng heavy nếu host bận)
docker compose up -d rooms                                             # hoặc: docker compose -f deploy/compose.yml up -d rooms
docker inspect -f '{{.State.Health.Status}}' menglish-learning-rooms
docker exec menglish-learning-rooms wget -qO- http://127.0.0.1:3100/rt/healthz
docker logs --tail 50 menglish-learning-rooms
```
Đề mới (publish thêm câu hỏi) chỉ có trong phòng sau khi **build lại image** rooms.

## Bật / tắt cờ
Cờ `ROOMS_ENABLED` ở hai nơi, phải cùng giá trị:
1. **rooms** (runtime): `ROOMS_ENABLED=true docker compose up -d rooms` (hoặc đặt trong `.env` cạnh compose). Tắt: `false`/bỏ biến → mọi `/rt/*` trừ `/rt/healthz` trả 503.
2. **web** (build time — trang tĩnh đọc cờ lúc build): `ROOMS_ENABLED=true docker compose build web && docker compose up -d web`. Cờ tắt → `/luyen-tap-nhom` hiện "sắp ra mắt", `/vao`, `/phong/*` trả 404, nút "Tạo phòng từ đề này" ẩn.

Thứ tự bật: rooms (true) → kiểm tra `/rt/healthz` có `"enabled":true` → chạy smoke → build lại web với cờ true. `ROOMS_COOKIE_SECURE`/`ROOMS_ALLOWED_ORIGINS` giữ mặc định (đúng cho beejunior.meducation.vn).

## Rollback
1. Web: build lại với `ROOMS_ENABLED=false` (hoặc bỏ biến) rồi `up -d web` → giao diện về "sắp ra mắt".
2. Rooms: `ROOMS_ENABLED=false docker compose up -d rooms` (đang chơi sẽ bị đóng, xem "Restart").
3. Nếu cần gỡ hẳn: xóa khối `handle /rt/* { ... }` khỏi Caddyfile (beejunior) và reload Caddy (`caddy validate` trước); `docker compose rm -sf rooms`. Không đụng gì tới các khối khác.

## Bộ nhớ, restart, sức chứa
- RSS mục tiêu < 192 MB (giới hạn container 256 MB, Node `--max-old-space-size=160`). Đo thật: 300 phòng × 6 người, xem `rooms/README.md` (`load-test`, `mem-check`). Theo dõi `rssMb` ở `/rt/healthz`.
- Trạng thái chỉ trong RAM: restart/redeploy làm mất mọi phòng. SIGTERM → từ chối phòng mới, báo `server_restarting`, chờ tối đa `ROOMS_DRAIN_MS` (30 s) cho phòng đang `playing`, rồi đóng phần còn lại (`room_closed: maintenance`) và thoát 0; compose có `stop_grace_period: 40s`. Deploy ngoài giờ học.
- Giới hạn mặc định: 300 phòng, 45 người/phòng, 2000 luồng SSE, 3 phòng đang mở/IP, 10 phòng tạo/giờ/IP. Chỉnh bằng env (xem README); mỗi thay đổi cần `up -d rooms`.

## Smoke test
```bash
scripts/rooms-smoke.sh                       # qua https://beejunior.meducation.vn/rt (cần cờ ON, curl + jq)
scripts/rooms-smoke.sh http://127.0.0.1:3100 # trực tiếp (server đặt ROOMS_COOKIE_SECURE=false)
```
Tạo phòng 1v1 → người thứ hai vào → bắt đầu → cả hai nộp → lấy kết quả; kiểm tra không có `correctKey`/`explanation` ở create/preview/join/quiz/snapshot trước khi có kết quả; luôn đóng phòng khi kết thúc. Mỗi lần chạy tốn 1 lượt tạo phòng của IP chạy script (giới hạn 10/giờ).
