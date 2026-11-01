# ADR 0006: worker dùng lại mã crawler qua facade có kiểu; hai thư viện nặng đi kèm

- Trạng thái: **đề xuất** (chủ duyệt khi duyệt PR S-D)
- Ngày: 2026-11-01
- Người quyết định: owner (Babay1903)
- Liên quan: thẻ t_84a4ba94, [engineering-standards](../engineering-standards.md) mục 1, 5 (SSRF), 10 (thư viện nặng)

## Bối cảnh

S-D cần một tiến trình `worker` (cùng image với `api`) chạy hàng đợi crawl VOA/gov vào quarantine. Logic phân tích/sinh câu hỏi đã được kiểm chứng nằm trong `crawler/` (dự án riêng, lockfile riêng, tsconfig lỏng hơn chuẩn backend, parser VOA, builder ngữ pháp/từ vựng, OCR merge). Viết lại sẽ nhân đôi ~650 dòng đã có test và làm lệch kết quả với 2.700 câu đã nhập.

## Quyết định

1. `worker/` (`@bj/worker`) **import trực tiếp mã `crawler/src`** qua alias `@crawler` → `crawler/src/lib.ts` (vitest/esbuild). Kiểu cho worker lấy từ **facade** `worker/src/crawler-facade.d.ts` (tsconfig `paths`), nên `tsc` strict của worker không phải quét mã crawler. Mọi thay đổi bề mặt `lib.ts` phải cập nhật facade (test tích hợp bắt lệch).
2. Mọi lần tải URL từ worker đi qua `safeFetch` (allowlist → DNS → kiểm IP → kết nối **ghim vào IP đã kiểm** → kiểm từng redirect). `HttpClient` của crawler được nhận `fetcher` là `guardedFetch`, giữ nguyên robots.txt và giới hạn 1 req/s/host. Chỉ một thay đổi nhỏ ở crawler: `HttpClient` nhận tham số `gapMs` tuỳ chọn (mặc định 1000 như cũ) để test không phải chờ.
3. Hai phụ thuộc của crawler được thêm vào `worker/package.json` đúng phiên bản đã ghim: `cheerio@1.0.0` (MIT) và `pdfjs-dist@4.10.38` (Apache-2.0). `pdfjs-dist` chỉ được nạp động khi gặp PDF gov có lớp chữ.
4. Worker **không bao giờ ghi `published`**: role `bj_worker` chỉ INSERT hàng `quarantine` (trigger `bj_guard_publish`, test quyền DB); không UPDATE/DELETE nội dung; chỉ SELECT/UPDATE `outbox_events` (migration 0026) để đánh dấu đã giao.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| **Import `crawler/src` + facade** | không nhân đôi logic, một nguồn sự thật | image phải copy `crawler/src`; facade phải đồng bộ |
| Chuyển crawler thành workspace | một lockfile | đổi cấu trúc ngoài phạm vi S-D; crawler dùng tsconfig lỏng, sẽ phải sửa cả mã |
| Viết lại trong `worker/` | sạch kiểu | nhân đôi ~650 dòng, rủi ro lệch kết quả crawl |

## Hệ quả

- Tốt: crawl lại không nhân đôi (khoá `external_id`); job nằm trong cap 320 MB [đo: xem PR].
- Xấu: image tăng ~4 MB bundle (cheerio + pdfjs); crawler và worker gắn chặt đến khi crawler thành workspace (làm sau nếu cần).
