# Sprint S-D: worker, hàng đợi crawl và quy trình duyệt

Phạm vi: `worker/` (cùng image với `api`, entrypoint `dist/worker/main.mjs`), hàng đợi `crawl_jobs` trên Postgres, reaper, `safeFetch` (SSRF), crawl VOA/gov vào quarantine, `import-ocr`, outbox → `_purge` + warm. ADR: [0006](adr/0006-worker-reuses-crawler-via-facade.md).

## Luồng

```
Admin ──POST /api/v1/admin/crawl-jobs {sourceCode, params}──► crawl_jobs (queued)
worker (bj_worker): reaper → claim (FOR UPDATE SKIP LOCKED) → crawl (safeFetch) → quarantine rows
Owner (api, bj_api): quarantine → draft → in_review → published  (+ revisions, audit, outbox_events)
worker: dispatchOutbox → POST edge /_purge {paths|prefixes} → edge re-warms
```

Không có đường tự xuất bản: `published` chỉ đạt được từ `in_review` qua `POST /api/v1/admin/<questions|passages|tests>/{id}/transition` (phiên admin + CSRF); role `bj_worker` bị trigger `bj_guard_publish` chặn mọi thứ khác `quarantine` và không có UPDATE/DELETE trên nội dung.

## Vận hành

| Việc | Lệnh / API |
|---|---|
| Xếp job crawl | `POST /api/v1/admin/crawl-jobs` `{ "sourceCode": "voa-learning-english", "params": { "limit": 20 } }` (nguồn phải `enabled`); `GET` liệt kê; `POST …/{id}/cancel` chỉ với job `queued` |
| Tham số VOA | `limit` 1–100 (mặc định 20) |
| Tham số gov | `seeds: [{url, year, province, grade, kind, answerKeyUrl?}]` (URL phải thuộc host trong `sources.allowed_hosts` và `crawler/config/gov-hosts.json`); PDF scan không có lớp chữ được báo lỗi → dùng `import-ocr` |
| Nhập OCR đã duyệt | `node dist/worker/main.mjs import-ocr [--dir crawler/ocr]` (cần nguồn gov đã tồn tại **và bật**; thiếu thì không chèn gì) |
| Biến môi trường | `DATABASE_URL_FILE`, `EDGE_PURGE_URL`, `EDGE_PURGE_TOKEN_FILE`, `CRAWL_DATA_DIR`, `POLL_INTERVAL_MS`, `HEARTBEAT_MS`, `JOB_STALE_SECONDS` (300), `MAX_ATTEMPTS` (3), `HEALTH_PORT` (8081) |
| Sức khoẻ | `127.0.0.1:8081/healthz`, `/readyz` (DB, 1 s) |

Job chết (worker sập) mất heartbeat > `JOB_STALE_SECONDS` → reaper đưa về `queued` (hoặc `failed` khi hết `MAX_ATTEMPTS`), kèm dòng `crawl_errors.kind='reaped'`; kết quả muộn của worker cũ bị bỏ qua (`locked_by`). Lỗi thử lại được có backoff 30·2^n giây; nguồn tắt/tham số sai thất bại ngay không thử lại.

## SSRF guard (`worker/src/ssrf.ts`)

Chỉ `https`, không userinfo/cổng/IP-literal; host phải khớp allowlist của nguồn (đúng host hoặc `*.hậu-tố`, không khớp host na ná); phân giải DNS **một lần**, từ chối nếu **bất kỳ** địa chỉ nào private/loopback/link-local/CGNAT/multicast/reserved/metadata (IPv4 và IPv6 gồm `::ffff:`, NAT64, 6to4, Teredo, `fc00::/7`, `fe80::/10`); kết nối được **ghim vào IP đã kiểm** (chống DNS rebinding); redirect theo dõi tối đa 3 lần, mỗi bước kiểm lại; giới hạn kích thước, thời gian và kiểu nội dung.

## Số đo (máy dev, dưới `heavy`, `--max-old-space-size=224`)

Job 100 bài VOA × ~40 KB (102 request, 712 câu vào quarantine): **peak RSS ≈ 263 MB < 320 MB** (cap D8). Test: `worker/tests/memory.test.ts`.

## Giới hạn đã biết

- Sinh câu hỏi dùng đúng mã `crawler/src` (quy tắc, không AI); chỉ nguồn VOA và gov có sẵn trong CMS.
- `raw_documents.storage_path` ghi `ephemeral:job-<id>` vì thư mục tải về bị xoá sau job (không có volume crawl).
- Chưa có UI quản lý job (S-E dùng các endpoint trên).
