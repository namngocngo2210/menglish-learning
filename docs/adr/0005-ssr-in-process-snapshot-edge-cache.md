# ADR 0005: SSR đọc snapshot nội dung trong tiến trình + edge cache là package riêng

- Trạng thái: **đề xuất** (chủ duyệt khi duyệt PR #22)
- Ngày: 2026-11-01
- Người quyết định: owner (Babay1903)
- Liên quan: thẻ t_eab9081e, PR #22, [backend-s-b.md](../backend-s-b.md), ADR 0002 (R0, D13)

## Bối cảnh

Toàn bộ route công khai phải SSR từ Postgres qua role `bj_web` trên view `v_public_*`, sitemap/robots/JSON-LD sinh động. Nội dung nhỏ (~2.700 câu hỏi, 373 URL), thay đổi chỉ khi publish. Container web bị giới hạn 384 MB / 1 CPU (D8), máy chủ dùng chung. HTML đầu ra phải giữ nguyên về nội dung/SEO so với bản static ([đo]: 374 trang khớp title/meta/canonical/JSON-LD/văn bản).

## Quyết định

1. Web đọc **một snapshot** nội dung (1 giao dịch REPEATABLE READ, 6 truy vấn) giữ trong tiến trình: TTL 30 s, single-flight, stale-on-error; làm mới thủ công qua hook nội bộ `/internal/refresh`. Mọi trang, sitemap, robots và JSON-LD sinh từ cùng snapshot.
2. Edge cache HTML (TTL theo route, SWR, ETag/304, load shedding, stale-on-error) là **package riêng `@bj/edge`**, bundle bằng esbuild vào image web, không phụ thuộc Next.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| **Snapshot trong tiến trình + edge package** | 0 truy vấn/trang, sống sót khi DB lỗi, đơn giản, test được độc lập | nội dung trễ tối đa TTL; mỗi tiến trình giữ một bản (nhỏ) |
| 2–4 truy vấn DB mỗi trang | luôn mới | tải DB theo lượt xem, chậm hơn, hỏng khi DB lỗi |
| ISR/`revalidate` của Next | có sẵn | khó kiểm soát stale-on-error/503, cache nằm trong framework |
| Cache ngoài (Redis/Varnish) | tách biệt | thêm dịch vụ trên máy chủ dùng chung, vượt cap D8 |

## Hệ quả

- Tốt: HIT p95 10,5 ms @10 đồng thời [đo]; web 155 MiB RSS [đo].
- Xấu: HTML thô khác static ở payload RSC nội tuyến (không nhìn thấy được); trang 404 động khác trang 404 tĩnh (cùng mã 404).
- Miss lạnh [đo]: ~63 ms CPU/render (gần như toàn bộ runtime React/Next) ⇒ 10 miss đồng thời trên 1 CPU p95 ≈ 0,7–0,85 s, không đạt < 300 ms (đạt ≤ ~3 đồng thời, p95 204 ms). Giảm thiểu: `soft` purge (STALE thay vì MISS, 0 MISS ở 10 đồng thời), warmer trước traffic, deploy song song rồi chuyển Caddy.
- Chaos (DB/api pause, khởi động không DB, hồi phục không restart) và soak 1 giờ (web ≤ 173 MiB/384, api ≤ 45/160, pg ≤ 67/256, không xu hướng tăng, 0 OOM) đạt [đo]; Lighthouse qua Caddy `encode` Perf 94–98, A11y/SEO 100. Chi tiết: backend-s-b.md.
- Tiến trình Next chết ⇒ edge thoát, Docker khởi động lại container, cache RAM mất (cold start).
- Hoàn tác: giữ image static cũ. Đổi ý khi nội dung lớn vượt vài chục MB hoặc cần cập nhật tức thì.
