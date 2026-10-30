# Kiến trúc hệ thống

Website luyện tiếng Anh cho học sinh lớp 6–9 (thương hiệu riêng, tạm chạy ở `beta.meducation.vn`).
Giai đoạn 1: trắc nghiệm **đọc + viết**, học sinh công khai dùng miễn phí không cần đăng nhập, có quảng cáo. Nghe/nói làm sau. Chủ sở hữu duy nhất quản trị nội dung cần đăng nhập riêng phía server; không có đội biên tập hay nhiều vai trò.

## Bổ sung thiết kế UI v2 — chưa triển khai

Fixture `docs/previews/sky-blue-v2/` là Next.js static export riêng để duyệt giao diện, dùng shadcn/ui + Tailwind + Lucide, không phải ứng dụng `web/` hay CMS thật. Màn hình admin/login là mock, không bảo vệ route/API, không lưu credential/session; không có backend, crawl, analytics hay quảng cáo chạy thật.

Thiết kế tương lai phải bổ sung server-side owner login/session, authorization mọi API admin, secure cookie/CSRF phù hợp, audit publish/delete/crawl/config, validation/rate limit và chống SSRF cho cấu hình nguồn (xem [security.md](security.md)). Luồng nội dung: **quarantine/draft → owner review → publish**, không tự xuất bản sau ingestion. Schema/API/session/worker thật cần phê duyệt riêng; PR thiết kế không thực hiện những thay đổi đó. Các phần kiến trúc bên dưới vẫn là kế hoạch tương lai, không phải năng lực đã có của preview.

## Sơ đồ

```
Người dùng ──► Caddy (HTTPS, beta.meducation.vn) ──┬──► web  : Next.js  :3000   (FE, SSG/ISR)
                                                   └──► /api/* ─► api : Go + Gin :8080
                                                                    ├──► postgres : PostgreSQL 16
                                                                    └──► redis    : Redis 7 (rate limit, cache)
crawler : Go (job theo lịch, không public) ──► postgres
```

- Chạy chung máy chủ hiện tại (3 core / 6 GB, dùng chung với MEnglish), sau Caddy có sẵn (`menglish-proxy-caddy-1`).
- 4 container riêng, mạng Docker riêng; chỉ `web` và `api` nối vào mạng của Caddy. `postgres`, `redis`, `crawler` không mở cổng ra ngoài.
- Ngân sách tài nguyên (giới hạn trong compose):

| Service  | CPU  | RAM     |
|----------|------|---------|
| web      | 0.5  | 256 MB  |
| api      | 0.5  | 128 MB  |
| postgres | 0.5  | 384 MB  |
| redis    | 0.25 | 96 MB   |
| crawler  | 0.5  | 256 MB (chỉ chạy khi có job) |

## Cấu trúc repo (monorepo)

```
web/        Next.js (App Router, TypeScript)
api/        Go + Gin (HTTP API)
crawler/    Go (crawl + parse + sinh câu theo quy tắc + import)
internal/   Go dùng chung giữa api và crawler (model, db, mixer)
db/         migrations (goose) + queries (sqlc)
deploy/     docker-compose, Dockerfile, mẫu .env, script backup
docs/       tài liệu thiết kế (thư mục này)
```

## Frontend — Next.js

- App Router, TypeScript, React Server Components.
- Trang nội dung (lớp, kỹ năng, chủ đề, đề cố định) render sẵn **SSG + ISR** (revalidate 1 giờ): HTML đầy đủ không cần JS → chuẩn SEO, nhẹ máy chủ.
- Phần client: làm bài, đếm giờ, nộp bài, xem kết quả, "Làm đề ngẫu nhiên", tiến độ lưu `localStorage`.
- Dữ liệu lúc build lấy từ API nội bộ (`http://api:8080`, có khóa nội bộ).
- Mobile-first, tiếng Việt, khả năng truy cập (WCAG AA). Chi tiết SEO: [seo.md](seo.md).
- Quảng cáo: component `AdSlot` (AdSense chế độ trẻ em / không cá nhân hóa); không đặt giữa các câu khi đang làm bài.

## Backend — Go + Gin

- Gin (router, middleware), `pgx` + `sqlc` (truy vấn có kiểu, tham số hóa), `goose` (migration), `go-redis`.
- Middleware: request id, log có cấu trúc (`slog`), recovery, CORS (chỉ domain site), giới hạn kích thước body, rate limit ([security.md](security.md#rate-limit)), header bảo mật.

### API (v1)

| Method | Path | Mô tả |
|--------|------|-------|
| GET  | `/api/v1/grades` | Danh sách lớp + số đề |
| GET  | `/api/v1/topics?grade=&skill=` | Chủ đề theo lớp/kỹ năng |
| GET  | `/api/v1/tests/{slug}` | Đề cố định (câu hỏi + phương án, **không có đáp án**) + `attempt_token` |
| POST | `/api/v1/tests/random` | Trộn đề mới theo lớp/kỹ năng/chủ đề/số câu |
| POST | `/api/v1/attempts` | Nộp bài (token + đáp án chọn) → điểm, đáp án đúng, giải thích, nguồn |
| GET  | `/api/v1/internal/sitemap` | Dữ liệu sitemap (chỉ gọi nội bộ, có khóa) |
| GET  | `/healthz`, `/readyz` | Health check |

Lỗi trả JSON thống nhất `{ "error": { "code", "message" } }`, không lộ chi tiết nội bộ.

### Trộn đề (mixer)

- Sinh tất định theo `seed`: cùng seed → cùng thứ tự câu và phương án → URL đề cố định ổn định cho SEO.
- Trộn thứ tự câu **và** thứ tự phương án; câu thuộc cùng bài đọc giữ nguyên nhóm.
- Không lặp câu giữa các đề cố định cùng chủ đề; cân bằng độ khó (mặc định 40% dễ / 40% vừa / 20% khó).
- Đề ngẫu nhiên: seed mới mỗi lần, không lưu trang (không index).
- Ánh xạ đáp án sau khi trộn được lưu phía server (gắn với `attempt_token`), không gửi xuống trình duyệt.

## Crawler — Go

Xem [content-sources.md](content-sources.md). Chạy theo lịch (cron trong container, mặc định 1 lần/tuần) hoặc tay; idempotent; ghi log + báo cáo số lượng.

## Môi trường

- `deploy/docker-compose.yml` + `deploy/.env.example` (không commit `.env` thật).
- Dev local: `docker compose -f deploy/docker-compose.yml up` với Postgres/Redis local.
- CI (GitHub Actions): lint + test Go/TS, `govulncheck`, `npm audit`, `gitleaks`, build image, Lighthouse CI.
- Deploy: chủ dự án thực hiện (agent không deploy).
