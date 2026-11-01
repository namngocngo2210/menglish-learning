# ADR 0001: Backend bằng TypeScript (Fastify + Kysely), monorepo

- Trạng thái: **được chấp nhận** (owner xác nhận D1 ngày 2026-11-01)
- Ngày: 2026-11-01
- Người quyết định: owner (Babay1903)
- Liên quan: [backend-blueprint.md §2](../backend-blueprint.md), [backend-decisions.md](../backend-decisions.md) (D1), thẻ kanban t_cbe773ed, t_8ba0d330

## Bối cảnh

Cần backend + Postgres cho BeeJunior (một chủ, 23 MB dữ liệu, traffic công khai gần như tĩnh, máy dùng chung ≈ 1 GB RAM cho cả stack). Phần đắt nhất là **độ đúng** của logic đã có test: mixer tất định theo seed, URL đề cố định cho SEO, OCR merge, schema zod. Ba phương án đã so (A Go+Gin, B TypeScript, C Next-only) — ma trận và số đo ở blueprint §2.2 và §4.5.

## Quyết định

Chúng ta dùng **TypeScript (Node 22 LTS): Fastify 5 + Kysely + `pg`, zod, `node-pg-migrate` (SQL up/down)**, trong **một monorepo npm workspaces** (`packages/core`, `api`, `worker`, `admin`, `web`, `rooms`). Không dùng ORM nặng. Chuẩn kỹ thuật đi kèm: [engineering-standards.md](../engineering-standards.md).

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Go + Gin | RAM api thấp nhất [ước] | Viết lại mixer/scoring/classifier/crawler, cần golden-vector; hai toolchain |
| **B. TypeScript** | Tái dùng nguyên code + test + zod; một ngôn ngữ; prototype đo 22 MB rảnh / 35 MB tải [đo] | +30–70 MB so với Go [ước]; bề mặt npm lớn; Node đơn luồng |
| C. Next-only | Ít container nhất | Admin/DB/session chung process với trang công khai (blast radius, SEO) |

## Hệ quả

- Việc nặng (crawl, OCR merge, sinh đề hàng loạt) chạy ở `worker`, không trong request.
- Bề mặt dependency lớn hơn → lockfile, `npm audit` chặn high+, allowlist giấy phép, ADR cho thư viện nặng ([standards §10](../engineering-standards.md)).
- Hợp đồng giữa các tầng là **OpenAPI sinh từ zod + schema SQL**, không phải code TS → có thể thay riêng lớp `api` sang Go sau này.
- Đổi ý khi: cần ≥ 2 replica, ngân sách RAM < ~700 MB, chủ có đội chỉ viết Go, hoặc đo `api` thật > 160 MB sau S-B.
- Ngoại lệ giấy phép ghi nhận ở đây: `@img/sharp-*` (libvips LGPL, nhị phân dựng sẵn do Next.js kéo vào, liên kết động, không sửa) — xem `scripts/license-exceptions.json`.
