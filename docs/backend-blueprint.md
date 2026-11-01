# Backend + Database Blueprint (BeeJunior)

> **Trạng thái: ĐỀ XUẤT để chủ duyệt — chưa có mã nguồn, chưa tạo DB/container trên máy chủ.** Tài liệu này thay thế các phần "Go + Gin / Redis / goose / sqlc" trong [architecture.md](architecture.md) và [data-model.md](data-model.md) *nếu được duyệt* (xem §2). Quyết định cần chủ chốt: [backend-decisions.md](backend-decisions.md).
>
> **Quyết định chủ 1/11: trang công khai render SSR theo từng request từ DB (không static/ISR làm kế hoạch chính)** — xem §4; static/ISR chỉ là phương án dự phòng.
>
> Quy ước số liệu: **[đo]** = đo thật trong bài thử dưới đây; **[ước]** = ước tính, chưa đo. Không có con số nào khác được coi là đã kiểm chứng.

Bài thử đo (throwaway, đã dừng): (1) DB/importer: container `postgres:16-alpine`, `--memory 512m --cpus=1`, mạng Docker `--internal` riêng (không nối mạng proxy), nhãn `hermes.task`, nạp **dữ liệu thật** của repo bằng chính schema/importer trong [`docs/backend/`](backend/README.md). (2) SSR: bản build Next thật của repo (trang đề đọc từ DB) + Postgres + Fastify prototype, mỗi cái có cap RAM/CPU, mạng `--internal`, tải 1/10/50/200 đồng thời (§4.5). Mã/tập lệnh: [`backend/ssr-bench/`](backend/ssr-bench/RESULTS.md). Một container đo (`bj-m-api`, ≈ 22 MB, nhãn `hermes.task`) không dừng được từ phiên agent (lệnh `docker stop/kill` bị chặn) — ops sẽ tự dừng theo nhãn khi thẻ đóng.

## 0. Hiện trạng (đã đọc từ code)

| Thành phần | Thực tế hôm nay |
|---|---|
| `web/` | Next.js SSG/ISR (`revalidate = 3600`, `dynamicParams = false`, `generateStaticParams`), đọc `web/content/tests/*.json` lúc build; chấm điểm **ở trình duyệt** (đáp án nằm trong HTML/JSON tĩnh `/pool/...`). `web/lib` ≈ 1.030 dòng (mixer, scoring, classifier, registry chủ đề, zod schema). Container hiện dùng ≈ 72 MB [đo `docker stats`], giới hạn 512 MB. |
| Nội dung | 4 file `bank-grade-{6..9}.json` + `bank-entrance.json` (≈ 3,9 MB) + 8 file `quarantine/*.json` (≈ 3,3 MB). **Đã xuất bản: 2.698 câu (2.587 VOA + 111 đề chính thức Hà Nội), 50 bài đọc, 316 đề (238 mixed, 57 topic, 21 entrance), 4.590 dòng đề–câu.** Quarantine: 2.700 câu (2.589 VOA + 111 gov); 2 câu VOA bị guard loại (trùng phương án) nên vẫn ở quarantine. |
| `crawler/` | Node/TS ≈ 650 dòng + `ocr/` (JSON hai lượt OCR + khoá đáp án), ghi JSON quarantine; cache thô ở `data/raw`. |
| `rooms/` | Node/TS ≈ 890 dòng, state trong RAM, **tạm dừng** (PR #17 draft). |
| Hạ tầng | Caddy dùng chung; máy 3 core / 5,9 GB RAM, **đang dùng ≈ 2,9 GB + swap 1,6 GB** [đo `free`], chạy production MEnglish; chưa có API/DB/Redis. Ổ `/home` còn ≈ 32 GB. |

**Hai sự thật quan trọng cho thiết kế:** (1) hôm nay trang công khai là tĩnh (SSG/ISR 1 h) và không cần DB lúc chạy — chủ đã quyết định chuyển sang **SSR từ DB** (§4), nên web trở thành thành phần tốn CPU/RAM nhất của stack; (2) kiến trúc cũ ghi "server chấm điểm, không lộ đáp án" nhưng sản phẩm thật chấm ở client — xem quyết định D9.

## 1. Mục tiêu / không-mục tiêu

**Backend phải làm (giai đoạn này):**
1. Lưu ngân hàng câu hỏi trong **Postgres** (nguồn sự thật thay cho JSON trong git), nhập lại 100% dữ liệu hiện có, kiểm đếm khớp.
2. **CMS một chủ**: đăng nhập, hàng đợi duyệt `quarantine → draft → in_review → published` (+ `rejected`, `archived`), cấu hình nguồn/giấy phép, crawl job, sửa bài đọc/câu hỏi (có lịch sử bản sửa), preset trộn đề, tạo/xuất bản đề, báo cáo câu sai, audit log.
3. **API đọc công khai** (nhỏ): phục vụ dự phòng static/snapshot và nhận **báo câu sai** (trang công khai do `web` SSR đọc DB trực tiếp bằng role chỉ-đọc).
4. **Trang công khai SSR theo request từ DB**, qua cache HTML ngắn hạn + stale-while-revalidate + purge khi xuất bản (§4); lỗi DB không bao giờ làm hỏng trang hay trả 404 giả.
5. Sau đó (không làm ngay): tiến độ/tài khoản (giai đoạn 2), lưu bền cho phòng luyện tập nhóm, thống kê.

**Không-mục tiêu:** học sinh đăng nhập (giai đoạn 1 vẫn không), nhiều admin/vai trò, thanh toán, AI sinh/chấm nội dung, microservice, Kubernetes, nhiều replica, CDN/WAF (có thể thêm Cloudflare sau), thay đổi giao diện công khai.

**Ràng buộc cứng:** SEO (HTML đầy đủ không cần JS, Lighthouse SEO 100/Perf ≥ 90, LCP < 2,5 s, Googlebot không bao giờ gặp timeout), máy chủ dùng chung với production (stack mới tổng giới hạn ≲ 1 GB), không auto-publish, không lộ bí mật, agent không deploy.

## 2. Quyết định stack

### 2.1 Phương án

- **A. Go + Gin** (theo docs cũ): `api/`, `crawler/` viết lại bằng Go, `pgx` + `sqlc` + `goose`.
- **B. TypeScript backend** (Node 22): **Fastify 5 + Kysely + `pg`**, zod dùng chung với `web`, migration SQL thuần. Mixer/scoring/classifier/registry/crawler/OCR-merge/rooms **tái dùng** qua package workspace chung.
- **C. Chỉ Next.js** (route handlers + server actions trong chính `web`).

### 2.2 Ma trận (1 = kém, 5 = tốt; điểm là đánh giá của dev, không phải số đo)

| Tiêu chí | A. Go+Gin | B. TS (Fastify) | C. Next-only |
|---|---|---|---|
| RAM api khi rảnh | **5** — [ước] 15–30 MB | 4 — prototype Fastify+pg+helmet đo **22 MB rảnh / 35 MB dưới tải** [đo `docker stats`]; app đầy đủ [ước] 60–100 MB | 2 — dồn vào tiến trình `web` [ước] +80–150 MB, dùng chung heap với trang công khai |
| Tái dùng code đã test | 1 — viết lại mixer (96 dòng, RNG tất định), scoring, classifier + registry (≈ 350 dòng), crawler (≈ 650), OCR merge, zod schema → cần *golden-vector* để chứng minh trùng từng bit | **5** — dùng nguyên package, cùng schema, cùng test (≈ 44 file test hiện có) | 4 — tái dùng web/lib, nhưng crawler/worker vẫn phải ở ngoài |
| Tác động SEO | 5 — không ảnh hưởng (web tách riêng) | 5 — không ảnh hưởng | 3 — SSR + admin + DB chung một process: trang công khai và admin/DB chung một process: lỗi/CPU admin hay crawl có thể làm chậm TTFB trang công khai; rủi ro dùng nhầm `dynamic` |
| Bảo mật | 4 — kiểu mạnh, ít phụ thuộc | 4 — bề mặt npm lớn hơn (giảm bằng lockfile, `npm audit`, ít dependency) | 2 — session/CSRF của server actions, admin nằm cùng ranh giới với site công khai; khó cô lập quyền DB |
| Tốc độ làm việc với Claude/Codex | 3 — 2 ngôn ngữ, 2 toolchain CI, mất thêm ≈ 2–3 tuần port | **5** — một ngôn ngữ, một bộ lint/test | 4 |
| Vận hành đơn giản | 3 — thêm toolchain/CVE feed (govulncheck) | **4** — cùng Node/Docker như `web`, `rooms` | 5 — ít container nhất |
| Bảo trì dài hạn | 4 — nhưng đội phải giữ hai ngôn ngữ đồng bộ hợp đồng dữ liệu | 4 — một hợp đồng (zod) cho web/api/crawler/rooms | 2 — monolith khó tách khi lớn |
| Chạy crawl/job nặng ngoài request | 4 | 4 (worker riêng cùng image) | 1 — không phù hợp, vẫn cần worker riêng |

### 2.3 Khuyến nghị: **B — TypeScript (Fastify + Kysely), một monorepo npm workspaces**

Lý do thực chất: quy mô (23 MB dữ liệu, một chủ, traffic công khai gần như tĩnh) không cần hiệu năng của Go; thứ đắt nhất là **độ đúng** của logic đã có test (mixer tất định theo seed, URL đề cố định cho SEO, OCR merge). B giữ nguyên các bất biến đó và cho một hợp đồng zod duy nhất.

**Đánh đổi thật:** tốn thêm ≈ 30–70 MB RAM so với Go [ước] (≈ 1 % RAM máy); bề mặt dependency npm lớn hơn; Node đơn luồng — an toàn vì mọi việc nặng (crawl, OCR merge, sinh đề hàng loạt) chạy ở *worker*, không trong request.

**Phương án C bị loại** vì gộp admin + DB + session vào cùng tiến trình với trang công khai (blast radius, SEO), và không giải quyết được crawler.

**Cái gì sẽ đổi khuyến nghị:** (a) cần ≥ 2 replica / hàng trăm req/s dữ liệu động (hiện không); (b) ngân sách RAM bị ép dưới ≈ 700 MB tổng; (c) chủ có sẵn người/đội chỉ viết Go; (d) đo thực tế Fastify api > 160 MB sau S-B. Lưu ý SSR (§4) làm RAM/CPU nằm chủ yếu ở `web` (Next), không phụ thuộc lựa chọn A/B/C. Khi đó chuyển *chỉ lớp api* sang Go vẫn khả thi vì hợp đồng là OpenAPI + schema SQL, không phải code TS.

**Chi tiết lựa chọn B:** Fastify 5 (+ `@fastify/helmet`, `cookie`, `rate-limit`, `static`; log `pino` có `redact`), Kysely + `kysely-codegen` (kiểu sinh từ DB; SQL là nguồn sự thật), `node-pg-migrate` với file SQL (up/down), zod (đã dùng) + sinh OpenAPI. Không dùng ORM nặng.

**Cấu trúc repo đề xuất** (chuyển dần ở S-B, không đập lại `web/`):

```
packages/core/    zod schema, mixer, scoring, topics registry/classifier, slug — dùng chung (trích từ web/lib, giữ test)
api/              Fastify (public + admin + internal), cũng chứa lệnh CLI: migrate, import, export-snapshot, admin:create
worker/           cùng image với api, entrypoint khác: crawl runner, outbox dispatcher, backup-verify hooks
admin/            SPA (Vite + React + Tailwind/shadcn) build tĩnh, api phục vụ ở /admin   (S-E)
web/              Next.js — không đổi hành vi
rooms/            tạm dừng; sau này dùng packages/core + API
deploy/           compose, Caddy snippet, scripts backup/restore, .env.example
db/migrations/    SQL
```

## 3. Cơ sở dữ liệu

### 3.1 Postgres 16 — kích thước cho máy này

Đo với dữ liệu thật [đo]: DB **23 MB** (questions 12 MB gồm TOAST, chỉ mục trigram 5 MB, test_items 1,3 MB); nạp 13 file ≈ **2,4 s** lần đầu, **1,3 s** lần chạy lại; `pg_dump -Fc` **0,33 s / 386 KB**; restore sang DB mới **0,7 s**, đếm lại 2.698 câu published = khớp; RSS container sau nạp ≈ **87 MB**, sau tải 8 kết nối song song ≈ **117 MB** (`shared_buffers=128MB`). Tải thử `pgbench` 8 client, câu truy vấn nóng nhất (lấy 1 đề + câu theo thứ tự): **≈ 580 tps, trễ TB 13,8 ms** trên 1 CPU bị giới hạn [đo; đây là truy vấn mô phỏng, chưa phải API thật].

Cấu hình đề xuất [ước theo số đo trên]:

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| Giới hạn container | `mem_limit 256m`, `memswap_limit 256m`, `cpus 0.5` | không cho swap (máy đã swap 1,6 GB) |
| `shared_buffers` | 96MB | cả DB (23 MB) nằm gọn |
| `effective_cache_size` | 192MB | |
| `work_mem` / `maintenance_work_mem` | 4MB / 32MB | |
| `max_connections` | 30 | api pool 10, worker 3, còn lại cho psql/backup/migrate |
| `max_wal_size` / `checkpoint_timeout` | 512MB / 15min | `wal_compression=on` |
| `jit` | off | truy vấn ngắn |
| `log_min_duration_statement` | 500ms | |
| Phiên bản | `postgres:16-alpine` ghim theo digest | image 418 MB trên đĩa [đo] |

Dưới tải SSR (§4.5, 50–200 đồng thời) RSS Postgres đạt đỉnh **97 MiB** trong cap 256 MB và CPU trung bình ≤ 5 %: DB không phải điểm nghẽn.

Dự báo tăng trưởng [ước]: 10× dữ liệu (≈ 27.000 câu) ≈ 250 MB — vẫn gọn trong `shared_buffers=256MB` nếu cần nâng.

### 3.2 Sao lưu và khôi phục

- **Hằng ngày 03:30** (cron máy chủ, ops sở hữu): `docker exec … pg_dump -Fc` → `~/backups/beejunior/db-YYYYmmdd-HHMM.dump`, quyền 600, ghi sha256.
- **Giữ:** 14 bản ngày + 8 bản tuần + 6 bản tháng (kích thước hiện ≈ 0,4 MB/bản [đo] → vài chục MB tổng; quan sát lại khi audit_log lớn).
- **Kiểm khôi phục hằng tuần (tự động):** script dựng container throwaway (`--rm`, nhãn, mạng nội bộ, 256m), `pg_restore`, chạy bộ đếm bất biến (số câu published, số đề, FK) rồi dừng; ops cảnh báo nếu lỗi hoặc bản mới nhất > 26 h.
- **Cùng một ổ đĩa ≠ DR.** Khuyến nghị sao chép mã hoá (age/gpg) sang nơi ngoài máy (D6). RPO = 24 h; không cần WAL/PITR ở quy mô này (nếu chủ cần RPO nhỏ hơn: `pg_basebackup` + archive, thêm vài giờ công).
- **Bản chụp nội dung dự phòng:** mỗi lần xuất bản, `export-snapshot` ghi `snapshot-<sha>.tar.zst` (đúng định dạng `ContentBundle` hiện tại) vào `~/backups/beejunior/snapshots/` — nội dung luôn khôi phục/dựng lại được kể cả khi DB mất, và là đầu vào của phương án dự phòng static (§4.7).

### 3.3 Migration và quy ước

- Công cụ: `node-pg-migrate`, file SQL tuần tự `NNNN_ten.sql` (up + down), chạy bằng service `migrate` một lần (không chiếm RAM thường trực), role riêng `bj_migrate`.
- **Expand → backfill → contract**: mỗi migration tương thích với image api *trước đó* (xem §6.6).
- Đặt tên: bảng số nhiều `snake_case`; khoá chính `bigint GENERATED ALWAYS AS IDENTITY`; mã công khai ổn định `external_id` (id JSON hiện tại: `voa-xxxxxxxx`, `gov-xxxxxxxx`, `voa-p-…`) để URL/seed/tham chiếu cũ không đổi; `*_id` cho FK; `timestamptz`; enum dùng `text + CHECK` (đổi dễ hơn kiểu `ENUM`); `created_at/updated_at` + trigger; khoá lạc quan `version`.
- Chỉ mục: xem schema; nguyên tắc: *partial index* `WHERE review_status='published'` cho đường đọc công khai; FK nào cũng có chỉ mục; kiểm bằng `EXPLAIN` ở S-A.

### 3.4 Schema đã chỉnh theo dữ liệu thật

Bản chạy được (đã nạp thành công): [`backend/schema.sql`](backend/schema.sql). Khác `data-model.md` cũ:

| Thay đổi | Lý do (từ dữ liệu thật) |
|---|---|
| `external_id` unique ở `questions`/`passages` | JSON dùng id chuỗi; seed đề, tham chiếu `questionIds`, `optionOrder` dựa vào id này |
| `options jsonb` (4 phần tử, `{key,text}`) + `correct_key char(1)` + CHECK, **không** bảng `options` | Luôn 4 lựa chọn A–D, luôn đọc cùng câu, một loại `mcq`; bỏ JOIN; loại mới (word_order…) sẽ nới CHECK. Phương án chuẩn hoá vẫn là lối thoát nếu cần thống kê theo phương án (đã cân nhắc, chưa cần) |
| `review_status` + `review_note/reviewed_at/published_at` ở `questions`, `passages`, `tests` | khớp zod `ReviewStatusSchema`, `reviewNote`, `reviewedAt` |
| `source_ref` (nguyên văn) **và** `provenance jsonb` | `sourceRef` là chuỗi `2026 \| Hà Nội \| tuyen-sinh-10-… \| Mã đề 001 \| Question 22 \| ocr-transcribed`; importer tách sẵn `year/province/examKind/examCode/itemRef/method` (đã chạy, 111/111 câu). Số liệu OCR thô hai lượt (`crawler/ocr/*.json`) **không** nạp vào DB; giữ trong git + `raw_documents` khi cần |
| `passages.source_url`, `crawled_at` | **chỉ có ở lớp quarantine** — bản published không mang các trường này; importer lấy từ quarantine |
| `tests` + `test_items(position, question_id, option_order char(4))` | `questionIds` có thứ tự và `optionOrder` ABCD; "đề bị ẩn nếu có câu chưa published" thành truy vấn |
| `topics.sort_order`, topic "ẩn" | 31 topic chỉ tồn tại qua phân loại câu (xem 3.6) |
| `question_revisions` | CMS cần lịch sử/rollback bản sửa |
| `stem_norm` (cột sinh, `unaccent` bọc IMMUTABLE) + GIN trigram | tìm kiếm không dấu cho CMS; đã kiểm `bj_unaccent('Thì hiện tại đơn — Đề số 1')` → `Thi hien tai don - De so 1` [đo] |
| `admin_users` đúng 1 dòng (`UNIQUE ((true))`), `admin_sessions`, `login_attempts`, `audit_log`, `outbox_events`, `crawl_jobs` (cũng là hàng đợi), `mixer_presets`, `sources.allowed_hosts/enabled` | §5 |
| Bỏ `attempts` khỏi giai đoạn 1 | chấm ở client; không có gì để lưu (D9). Giữ chỗ trong giai đoạn 2 |

**JSONB chỉ dùng cho:** `options`, `provenance`, `mixer_presets.config`, `crawl_jobs.params`, `audit_log.details`, snapshot bản sửa. Quan hệ lõi (đề–câu–chủ đề–nguồn) luôn là cột/FK.

**Slug / tiếng Việt:** slug vẫn không dấu, sinh ở lớp ứng dụng bằng hàm `slugify` trong `packages/core` (một nơi duy nhất, có test), ràng buộc DB `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` + UNIQUE. `unaccent` chỉ dùng cho tìm kiếm CMS, không dùng để sinh URL. Full-text `to_tsvector('simple', stem_norm)` chỉ thêm nếu tìm trigram chậm (2.700 hàng: truy vấn 3,8 ms [đo], chưa cần).

**Quyền DB:** 3 role — `bj_migrate` (sở hữu schema), `bj_api` (CRUD các bảng cần, **chỉ INSERT** `audit_log`), `bj_worker` (chỉ INSERT dòng `quarantine` + cập nhật `crawl_jobs`). Trigger chặn mọi ghi `review_status='published'` từ role khác `bj_api` — nên *ngay cả khi crawler bị khai thác* cũng không tự xuất bản được.

### 3.5 Redis — **không dùng** (khuyến nghị D2)

| Nhu cầu | Thay bằng | Vì sao đủ |
|---|---|---|
| Rate limit công khai (báo câu sai, v.v.) | token-bucket trong bộ nhớ tiến trình api (`@fastify/rate-limit` store memory) | một replica; mất bộ đếm khi restart chấp nhận được |
| Rate limit đăng nhập admin | bảng `login_attempts` (Postgres) | cần bền và hiếm (1 chủ) |
| Cache đọc (HTML SSR) | edge-cache trong RAM của container `web` (§4.3) + header `s-maxage`/SWR | một replica `web`; mất cache khi restart được bù bằng warmer |
| Hàng đợi | `crawl_jobs` + `FOR UPDATE SKIP LOCKED` | vài job/tuần |
| Phiên | `admin_sessions` | một người dùng |
| Phòng luyện tập nhóm | vẫn state trong RAM của `rooms` | đã thiết kế vậy |

Chi phí tránh được [ước]: Redis idle ≈ 8–15 MB RSS (ngân sách cũ giữ 96 MB), thêm một dịch vụ cần mật khẩu, vá lỗi và theo dõi. **Đổi ý khi:** chạy ≥ 2 replica api, hoặc rooms cần scale ngang. Thêm Redis lúc đó là việc nhỏ vì rate-limit đã nằm sau một interface.

### 3.6 Importer từ JSON hiện có

Bản chạy được: [`backend/import.sql`](backend/import.sql) + [`backend/prep.py`](backend/prep.py) (prototype; bản thật là lệnh `api import` bằng TS dùng lại zod `ContentBundleSchema`). Nguyên tắc: một transaction, upsert theo `external_id`/`slug`, **chạy lại không đổi gì** (đã kiểm: lần 2 cho cùng số liệu), kèm báo cáo đối chiếu và thoát mã ≠ 0 nếu lệch.

Phát hiện khi thử với dữ liệu thật (đã xử lý trong prototype, **phải có test ở S-A**):
1. **100 câu published tham chiếu chủ đề không có trong danh sách `topics` của bất kỳ file bundle nào** (câu chỉ dùng trong đề mixed/entrance giữ phân loại gốc; loader hiện tại cho phép ngoại lệ này). Importer phải suy ra topic từ phân loại câu → tổng **146 topic** (115 khai báo + 31 "ẩn"). Tên hiển thị của 31 topic ấy lấy từ `web/lib/topics/registry.ts` (prototype tạm dùng slug).
2. **Lớp published ghi đè lớp quarantine**: cùng câu có `topicSlug` khác nhau giữa hai lớp (phân loại lại sau guard); lời giải của 111 câu gov cũng khác. Thứ tự áp: quarantine trước, published sau.
3. `passages.sourceUrl/crawledAt` chỉ ở quarantine (xem 3.4).
4. `reviewedAt` của published được dùng làm `published_at`; 50/50 bài đọc published vì có câu published.

**Bảng đối chiếu bắt buộc (kết quả đo, phải khớp đúng):**

| Mục | Kỳ vọng | Đo ở prototype |
|---|---|---|
| Câu `published` | 2.698 (VOA 2.587 + gov 111) | 2.698 ✔ |
| Câu `quarantine` | 2 (VOA, guard trùng phương án) | 2 ✔ |
| Tổng câu quarantine layer | 2.700 (2.589 VOA + 111 gov) | 2.700 ✔ |
| Bài đọc | 50 (đều published) | 50 ✔ |
| Đề | 316 (238 mixed + 57 topic + 21 entrance10) | 316 ✔ |
| Dòng `test_items` | 4.590 | 4.590 ✔ |
| Nguồn / topic | 2 / 146 | 2 / 146 ✔ |

Kiểm tương đương nội dung (S-A/S-B): `export-snapshot` từ DB → `ContentBundle` → **so sánh sâu** với `web/content/tests/*.json` (id, thứ tự `questionIds`, `optionOrder`, đáp án sau remap, `topicSlug`, hash nội dung từng câu) và so sánh danh sách route `next build` + `sitemap.xml` trước/sau: **chênh lệch = 0**.

## 4. Render công khai: SSR là mô hình chính (chủ quyết định 1/11)

> **Quyết định của chủ (1/11):** trang công khai render **SSR theo từng request, dữ liệu lấy từ DB** — không còn static/ISR làm kế hoạch chính. Static/ISR giữ lại ở §4.7 chỉ như phương án dự phòng, kèm số đo. Toàn bộ số liệu trong mục này là **[đo]** trên máy này (xem §4.5 và [`backend/ssr-bench/RESULTS.md`](backend/ssr-bench/RESULTS.md)), trừ khi ghi [ước].

### 4.1 Kiến trúc

```
Googlebot/Học sinh ─► Caddy ─► web container ─┬─► edge-cache (Node, cổng 3100)  ── HIT: trả HTML từ RAM
                                              │        │ MISS/STALE-refresh (timeout 3 s, single-flight)
                                              │        ▼
                                              └─► Next.js SSR standalone (cổng 3000) ──► Postgres (role bj_web chỉ-đọc, pool ≤ 5)
api (Fastify) ─► Postgres ... ; publish ─► api gọi POST /_purge (token nội bộ) trên edge-cache
```

- **Next.js SSR (standalone)** render mỗi request chưa có trong cache: truy vấn DB (2–4 truy vấn nhỏ/trang), render React Server Components thành HTML đầy đủ. Không cần JS để đọc nội dung (đã kiểm: trang đề mẫu 117 KB HTML có `<h1>`, canonical, 4 khối JSON-LD và đủ 20 câu hỏi trong HTML gốc).
- **Truy cập dữ liệu:** `web` đọc DB trực tiếp bằng role `bj_web` (chỉ `SELECT` trên các **view công khai** `v_public_*`, chỉ thấy bản `published`) qua package dữ liệu dùng chung; **mọi ghi và admin chỉ qua `api`**. Lý do: bớt một chặng HTTP/serialization trên đường găng, ít RAM hơn; rủi ro (web giữ mật khẩu DB) được giới hạn bởi quyền chỉ-đọc + mạng nội bộ. Phương án thay thế (web gọi `api` nội bộ) an toàn hơn về phân tách nhưng thêm một chặng — xem D13.
- **Edge-cache trong container `web`** (một tiến trình Node nhỏ phía trước Next; thay cho module cache của Caddy vì Caddy dùng chung với MEnglish không nên đổi bản build): cache HTML trong RAM, TTL theo route, stale-while-revalidate, single-flight, **trả bản cũ khi Next/DB lỗi**, nếu không có bản cũ thì **503 + `Retry-After`** (không bao giờ trả trang hỏng, không bao giờ 404 giả).

### 4.2 Vì sao *bắt buộc* có cache HTML (số đo, không phải phỏng đoán)

Render React là điểm nghẽn, **không phải DB**: một tiến trình Next bão hoà ở **≈ 28 req/s** (1 CPU) dù có cache dữ liệu. Với 50 request đồng thời không cache HTML, p50 TTFB = 1,7 s, p95 = 2,5 s (không lỗi, nhưng không đạt "Googlebot không bao giờ timeout"/LCP). Cache dữ liệu trong tiến trình **không cải thiện** (p50 1,73 s @50) vì chi phí chính là render. Cache HTML đưa p95 về 5 ms (10 đồng thời) / 50 ms (50 đồng thời) / 96 ms (200 đồng thời). Kết luận thiết kế: **SSR đúng nghĩa ở lần miss; còn lại phục vụ từ cache HTML ngắn hạn**.

### 4.3 Chính sách cache theo route

| Route | TTL (fresh) | Stale được phục vụ tối đa | Ghi chú |
|---|---|---|---|
| `/`, `/lop-N`, `/lop-N/<kỹ năng>`, chủ đề | 60 s | 24 h | danh sách đổi khi publish → purge |
| Trang đề `/lop-N/.../de-K`, `/thi-vao-lop-10/de-K` | 300 s | 24 h | nội dung ổn định theo seed |
| `/pool/...` (JSON cho "đề ngẫu nhiên") | 300 s | 24 h | |
| `sitemap.xml` | 300 s | 24 h | sinh động từ DB, `lastmod` = `published_at`/`updated_at` |
| `robots.txt`, `manifest` | 3600 s | 24 h | |
| 404 hợp lệ (slug không tồn tại) | 30 s (negative cache) | — | |
| 5xx/timeout | **không bao giờ cache** | — | trả stale hoặc 503 |
| `/admin*`, `/api/*`, POST | bỏ qua cache | — | `no-store` |

- **Khoá cache:** đường dẫn + chuỗi truy vấn đã chuẩn hoá (bỏ `utm_*`, `fbclid`, `gclid`; sắp xếp). **Không** phụ thuộc cookie (cookie bị gỡ trước khi chuyển cho Next ở route công khai) nên không bao giờ cache nhầm nội dung theo người dùng.
- **Header phát ra:** `Cache-Control: public, max-age=0, s-maxage=<TTL>, stale-while-revalidate=<stale>`, `ETag` + `Last-Modified` (trả `304` từ cache cho Googlebot), `X-Cache: HIT|MISS|STALE`. Nén gzip/zstd do Caddy `encode` đảm nhiệm.
- **Giới hạn bộ nhớ:** LRU tối đa 64 MB (toàn bộ site ≈ 400 trang × ≈ 120 KB ≈ 48 MB [ước]).
- **Làm mới khi publish:** `api` ghi `outbox_events`; dispatcher gọi `POST /_purge {paths|prefixes}` (token nội bộ, chỉ mạng nội bộ) — xoá mục liên quan (đề, chủ đề cha, danh sách, sitemap) rồi **warmer** tải lại tuần tự (1 luồng) các mục đó. Cache nằm trong RAM nên khởi động lại là cache lạnh: warmer chạy nền theo `sitemap` (≈ 400 trang × ≈ 25 ms p50 [đo, miss c=1] ≈ 10–15 s [ước]).
- **Googlebot không bao giờ gặp timeout:** timeout upstream 3 s → ưu tiên bản stale; chỉ khi chưa từng có bản nào (trang chưa warm *và* DB chết) mới 503 `Retry-After: 30` (Google coi 503 là tạm thời, không gỡ chỉ mục). Quy tắc SEO cứng: **lỗi DB không bao giờ biến thành 404 hay 200 rỗng.**

### 4.4 Giới hạn cứng và chịu lỗi

| Cơ chế | Giá trị | Trạng thái |
|---|---|---|
| Pool DB của web | `max 5`, `connectionTimeout 1,5 s`, `statement_timeout 2 s`, `query_timeout 2,5 s` | dùng trong bài đo |
| Tổng kết nối Postgres | web 5 + api 10 + worker 3 + dự phòng 12 ≤ `max_connections=30`; **không cần PgBouncer** | [ước theo số kết nối thực dùng] |
| Số render đồng thời | giới hạn 16 đang render + hàng đợi 64; vượt → `503 Retry-After: 5` (load-shedding) | **thiết kế, chưa đo** (S-B) |
| Timeout upstream của edge-cache | 3 s → stale hoặc 503 | dùng trong bài đo |
| `mem_limit` web | 384 MB, `--max-old-space-size=256` | §6.4 |

**Kịch bản DB chết** (mô phỏng bằng `docker pause` DB = treo, xấu hơn từ chối kết nối), TTL cache = 2 s [đo]:

| Bước | Kết quả |
|---|---|
| Trang A đã warm, DB treo, hết TTL | `200`, `X-Cache: STALE`, **5 ms**; lần sau vẫn STALE |
| Trang B chưa warm, DB treo | `503`, `Retry-After: 30`, trang HTML sạch "bảo trì ngắn", sau **3,08 s** |
| (đối chứng) gọi thẳng Next không cache khi DB treo | `500` sau 3,04 s — *chính là lý do không được để Next đối mặt trực tiếp với Caddy* |
| DB trở lại | B: `200` (MISS, 129 ms); A tự làm mới |

### 4.5 Kết quả đo trên máy này

Điều kiện: máy dùng chung (3 core, đang chạy production), bài đo chạy từ host vào container qua mạng Docker `--internal` riêng; công cụ tải tự viết (Node, keep-alive, round-robin **80 URL đề khác nhau**, `accept-encoding: identity`, trang trung bình 118 KB) — nó cũng ăn CPU của máy nên số liệu **thiên về bi quan**. Container: Postgres `256m/0,5 CPU`; web `384m/1 CPU`; web chạy bản Next build thật của repo, chỉ trang đề được chuyển sang đọc DB (prototype vứt đi). Chi tiết lệnh/tập lệnh: `docs/backend/ssr-bench/`.

TTFB (ms) và thông lượng:

| Kịch bản | Đồng thời | req/s | TTFB p50 | p95 | p99 | RSS đỉnh web (MiB) | RSS đỉnh PG (MiB) |
|---|---|---|---|---|---|---|---|
| SSR, không cache | 1 | 30,7 | 25,6 | 69,3 | 120,7 | 183 | 89 |
| SSR, không cache | 10 | 27,7 | 348 | 527 | 713 | 132 | 97 |
| **SSR, không cache** | **50** | 27,7 | **1.706** | **2.492** | 2.602 | 149 | 97 |
| SSR + cache dữ liệu 60 s | 10 | 21,6 | 414 | 643 | 2.105 | 87 | 97 |
| SSR + cache dữ liệu 60 s | 50 | 26,5 | 1.727 | 2.358 | 3.292 | 114 | 86 |
| **SSR + cache HTML (warm)** | 1 | 1.392 | 0,3 | 0,9 | 2,4 | 104 | 89 |
| SSR + cache HTML (warm) | 10 | 3.886 | 1,9 | 5,0 | 7,8 | 90 | 89 |
| **SSR + cache HTML (warm)** | **50** | 2.334 | **15,9** | **49,8** | 84,7 | 146 | 97 |
| SSR + cache HTML (warm) | 200 | 3.472 | 51,8 | 96,3 | 155 | 131 | 97 |
| (so sánh) Static hiện tại (image Next hôm nay) | 50 | 254 | 167 | 327 | 473 | 166 | — |

Không lỗi nào (mã khác 200) ở bất kỳ kịch bản nào. Lần render đầu tiên sau khi tiến trình khởi động mất 0,78–0,93 s (khởi động nguội) [đo].

API prototype (Fastify + helmet + cookie + rate-limit + pino + `pg`, 1 truy vấn/đề, cap 160 MB/0,5 CPU): RSS khi rảnh **22 MiB**, sau tải 50 đồng thời **35 MiB**, 282 req/s, p50 153 ms [đo] — **thấp hơn nhiều so với ước tính 80–120 MB ở §2** (đã chỉnh; ứng dụng đầy đủ sẽ lớn hơn prototype, ước 60–100 MB [ước]).

**Lighthouse mobile** (1 lần chạy/chế độ, trang đề, `http://` nội bộ, máy đang tải, giả lập throttling): SEO **100** và A11y **100** ở cả 3; Performance **87** (SSR+cache) / 78 (SSR không cache) / 77 (static hôm nay); LCP 3,3 / 3,0 / 3,0 s; server response 10 / 40 / 20 ms; Best-Practices 79 ở cả ba (do `http://`, không phải lỗi SSR). **Đọc đúng:** (1) SSR không làm xấu chỉ số phía client — chênh lệch nằm trong nhiễu; (2) độ trễ server (10–40 ms) không phải thành phần của LCP 3 s, LCP do JS/hydrate/phông trên máy đang tải; (3) các số tuyệt đối này **không đạt ngưỡng CI ngay cả với bản static hôm nay**, nên **không được dùng để kết luận đạt/không đạt Perf ≥ 90** — cổng thật là Lighthouse CI trong S-B chạy trên môi trường sạch, so SSR với static theo cùng điều kiện, và là điều kiện chặn merge.

### 4.6 Ngân sách RAM khi gộp SSR web + api + Postgres

Đo đỉnh (prototype, cùng lúc): Postgres **≤ 97 MiB**, web + edge-cache **≤ 183 MiB** (đỉnh nguội, 1 CPU) / 146 MiB dưới tải cache, api **≤ 35 MiB** ⇒ **≈ 300–320 MiB đo được** cho ba dịch vụ. Đề xuất giới hạn (§6.4): web 384, api 160, postgres 256, worker 320 ⇒ **cap 1.120 MB**; thường trực dự kiến ≈ 400–500 MB [ước]. Máy hiện còn `available` ≈ 2,5–3,1 GB [đo `free`]; khi *mọi* container chạm cap cùng lúc, tổng tăng thêm ≲ 1,05 GB (đã trừ ≈ 72 MB `web` hiện có) nên vẫn còn ≥ 1,4 GB cho production — nhưng máy từng đứng hình do thiếu RAM, nên S-F bắt buộc có soak-test dưới `heavy` và `memswap_limit = mem_limit`. Lợi ích phụ của SSR: **publish không còn cần rebuild Next (≈ 1,8 GB tạm)**; chỉ purge cache.

### 4.7 Phương án dự phòng: static/ISR (không phải kế hoạch)

Giữ làm đường lui nếu SSR hoặc đo S-B thất bại. Cơ chế: `export-snapshot` → `ContentBundle` (đúng định dạng hiện tại) → `next build` (không cần mạng, ≈ 12 s biên dịch + 4 s sinh trang cho 120 trang [đo]) hoặc ISR (`dynamicParams=true`, `revalidatePath` khi publish). Số đo của bản static hôm nay: 254 req/s, p50 167 ms @50 đồng thời, RSS ≈ 166 MiB [đo]; cache HTML ở §4 nhanh hơn do trả buffer trong RAM. Ưu: không phụ thuộc DB lúc chạy; nhược: mỗi lần publish phải rebuild/ISR, build nặng trên máy dùng chung. Có thể bật bất kỳ lúc nào vì snapshot vẫn được xuất ở mỗi lần publish (cũng là bản sao lưu nội dung, §3.2).

### 4.8 Header qua Caddy

Caddy chỉ cấp header và nén (`encode zstd gzip`); cache nằm trong container `web`. `handle /api/*` và `handle /admin*` → `api:8080`; còn lại → `web:3100` (edge-cache). `/_next/static/*`: `public, max-age=31536000, immutable`; `/api/v1/public/*` GET: `public, max-age=60`; `/api/v1/admin/*`, `/admin/*`: `no-store` + `X-Robots-Tag: noindex`; `/api/v1/internal/*` và `/_purge` không route ra Caddy.

## 5. Hợp đồng API

Phác thảo OpenAPI: [`backend/openapi-sketch.yaml`](backend/openapi-sketch.yaml). Quy ước chung:

- **Phiên bản:** `/api/v1`, thay đổi chỉ cộng thêm; phá vỡ → `/v2` song song, có `Deprecation`/`Sunset` header. Hợp đồng sinh từ zod → OpenAPI, test hợp đồng ở CI.
- **Lỗi thống nhất:** `{ "error": { "code": "validation_failed", "message": "…", "details": [...], "request_id": "…" } }`; không lộ stack/SQL.
- **Phân trang:** keyset `?limit=50&cursor=…` (tối đa 100) cho danh sách admin; danh sách công khai nhỏ, không phân trang.
- **Validation:** zod ở mọi route (body ≤ 64 KB, 1 MB cho import có chủ đích), từ chối trường lạ (`strict`).
- **Quyền:** *deny-by-default* — plugin `adminGuard` gắn ở prefix `/api/v1/admin`; route mới không có guard không đăng ký được (test tự động liệt kê mọi route và khẳng định guard).

### 5.1 Công khai (không đăng nhập)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/v1/public/grades`, `/topics?grade=&skill=` | danh mục |
| GET | `/api/v1/public/tests/{slug…}` | đề + câu *đã* remap `optionOrder`; (đáp án có/không tuỳ D9) |
| POST | `/api/v1/public/reports` | báo câu sai: `{questionId, reason, note≤500}`; rate-limit theo IP+UA hash; honeypot; không PII; `client_hash = HMAC(ip+ua, muối xoay hằng tháng)`; xoá sau 180 ngày |
| GET | `/healthz`, `/readyz` | readyz kiểm tra DB |
| GET | `/api/v1/internal/snapshot` | **chỉ mạng nội bộ + token**, không qua Caddy (dự phòng static, sao lưu nội dung) |
| POST | `web:/_purge` | gọi bởi dispatcher outbox khi publish; token nội bộ, không qua Caddy |

Trang công khai (HTML, `sitemap.xml`, `robots.txt`, `/pool/*`) **do `web` SSR đọc DB** (§4), không đi qua API này.

### 5.2 Admin (một chủ) — mọi route yêu cầu phiên hợp lệ

- Auth: `POST /admin/auth/login | logout`, `GET /admin/auth/me`, `POST /admin/auth/totp/{enroll,verify,disable}`.
- Nguồn: `GET/POST/PATCH /admin/sources`, `POST /admin/sources/{id}/crawl` (tạo job).
- Crawl: `GET /admin/crawl-jobs`, `GET …/{id}`, `POST …/{id}/cancel`, `GET …/{id}/errors`.
- Hàng đợi duyệt: `GET /admin/questions?status=&grade=&skill=&topic=&source=&q=`, `GET/PATCH /admin/questions/{id}` (bắt buộc `If-Match: version`), `POST …/{id}/transition {to,note}`, `POST /admin/questions/bulk-transition` (≤ 200 id *hoặc* bộ lọc + `expected_count`, phải khớp mới chạy — chống bấm nhầm hàng loạt). Tương tự `passages`.
- Đề: `GET/POST/PATCH /admin/tests`, `POST /admin/tests/generate {preset_id, seed}` (dùng mixer của `packages/core`), `POST …/{id}/transition`.
- Preset trộn đề: CRUD `/admin/mixer-presets`.
- Báo cáo: `GET /admin/reports`, `PATCH …/{id}`.
- Khác: `GET /admin/audit`, `GET /admin/stats`, `POST /admin/publish-site` (xả outbox → purge + warm cache web, ghi snapshot).

**Phiên & xác thực:**
- Mật khẩu **argon2id** (`@node-rs/argon2`, m=19 MiB, t=2, p=1 — mức tối thiểu OWASP; tốn ≈ 19 MB tạm thời mỗi lần đăng nhập, chấp nhận được), so sánh thời gian hằng, thông báo lỗi chung.
- Phiên phía server: token ngẫu nhiên 32 byte; DB chỉ lưu `sha256(token)`. Cookie `__Host-bj_admin` (`HttpOnly; Secure; SameSite=Strict; Path=/`), idle 8 h, tuyệt đối 7 ngày, xoay vòng sau đăng nhập, thu hồi khi đổi mật khẩu.
- CSRF: kiểm `Origin`/`Sec-Fetch-Site` + token double-submit trong header `X-CSRF-Token` cho mọi method ghi.
- Giới hạn đăng nhập: 5 lần sai/15 phút/IP và 10/giờ/tài khoản, độ trễ luỹ tiến; ghi `login_attempts` và `audit_log` (không ghi mật khẩu).
- TOTP tuỳ chọn (RFC 6238) + 8 mã khôi phục băm; bí mật TOTP mã hoá bằng khoá ứng dụng (không nằm trong DB).
- Tài khoản chủ tạo bằng lệnh `api admin:create` chạy tay trên máy (nhập mật khẩu qua TTY) — **mật khẩu không đi qua chat, env hay file**.
- `audit_log` chỉ INSERT (quyền DB), ghi: login/logout, transition, publish, sửa câu (diff), cấu hình nguồn, crawl start/cancel, publish-site.

### 5.3 Chống SSRF cho cấu hình nguồn và crawl

- Cấu hình nguồn lưu `allowed_hosts` (host chính xác hoặc `*.suffix`); khi lưu, **giao** với danh sách cứng trong code (`crawler/config/gov-hosts.json` + VOA) và với denylist (`vndoc`, `hoc247`, …) — admin không thể thêm host ngoài danh sách cứng.
- Mỗi lần fetch: chỉ `https`; phân giải DNS **trong worker**, từ chối loopback, private (RFC 1918), link-local (169.254.0.0/16 gồm metadata), CGNAT, ULA/IPv6 nội bộ; **kết nối thẳng tới IP đã kiểm** (ghim, chống DNS rebinding); `redirect: manual` — không theo redirect (đã là chính sách của crawler); timeout 20 s; giới hạn 25 MB/phản hồi, kiểm `Content-Type`; tôn trọng robots; 1 req/s/host.
- Tuyến phòng thủ thứ hai (ops, tuỳ chọn): luật `DOCKER-USER`/egress cho container worker.

### 5.4 Crawl job runner

- `POST /admin/sources/{id}/crawl` chỉ **INSERT** một dòng `crawl_jobs(status='queued')` — không bao giờ crawl trong request công khai hay request admin.
- `worker` (container riêng, cùng image) vòng lặp: `SELECT … FOR UPDATE SKIP LOCKED` lấy 1 job, `heartbeat_at` mỗi 30 s; job im > 5 phút bị "reaper" đặt lại (tối đa 3 lần); **một job một lúc**; `node --max-old-space-size=256`, stream PDF, cap container 320 MB; kết quả chỉ ghi dòng `quarantine` (quyền `bj_worker`), thống kê vào `crawl_jobs`, lỗi vào `crawl_errors`.
- Lịch hằng tuần: admin bật tay hoặc một dòng cron gọi lệnh enqueue; không có lịch tự chạy ngầm khi chủ chưa bật nguồn (`sources.enabled=false` mặc định).
- OCR bản scan **không** nằm trong worker: là quy trình một-lần thủ công như đã duyệt 31/10 (file `crawler/ocr/*.json` tiếp tục là đầu vào), lệnh `api import-ocr` đưa kết quả vào quarantine.

## 6. Bảo mật, riêng tư, vận hành

### 6.1 Tóm tắt mô hình đe doạ

| Mối đe doạ | Biện pháp |
|---|---|
| Chiếm tài khoản chủ (brute force, đánh cắp phiên, CSRF) | argon2id, giới hạn đăng nhập, cookie `__Host-`, CSRF, TOTP (D3), phiên ngắn, audit |
| XSS qua nội dung cào (stored XSS vào CMS/trang) | lưu văn bản thuần; render dạng text; CSP chặt cho `/admin`; không `dangerouslySetInnerHTML` |
| SSRF qua cấu hình nguồn | §5.3 |
| Crawler bị khai thác để tự xuất bản | quyền DB + trigger (§3.4) |
| SQL injection | Kysely tham số hoá; không nối chuỗi SQL; test |
| DoS công khai | trang tĩnh; rate-limit; body ≤ 64 KB; giới hạn pool/CPU container |
| Rò rỉ sao lưu | quyền 600, mã hoá bản ngoài máy, không chứa bí mật (DB không giữ bí mật ứng dụng) |
| Chuỗi cung ứng npm | lockfile, `npm ci`, `npm audit` (high chặn), image ghim digest, Dependabot, gitleaks |
| Ảnh hưởng chéo lên production MEnglish | cgroup cap từng container, mạng nội bộ riêng, không publish cổng, không dùng chung volume/mạng DB |
| Dữ liệu trẻ em | không PII học sinh; `client_hash` HMAC xoay muối, giữ 180 ngày; không log IP thô |

### 6.2 Bí mật

Không nằm trong repo hay image. Chủ chạy `deploy/gen-secrets.sh` **một lần trên máy chủ** (sinh ngẫu nhiên bằng `openssl rand`) → thư mục `~/beejunior-secrets/` (700; file 600), nạp vào container qua `*_FILE` (Docker secrets dạng file), không qua biến môi trường in được. Gồm: 3 mật khẩu role DB, `SESSION_HMAC_KEY`, `TOTP_ENC_KEY`, `REVALIDATE_TOKEN`/token nội bộ, (tuỳ chọn) khoá mã hoá backup. Agent không bao giờ đọc thư mục này. `pino` bật `redact` cho `authorization`, `cookie`, `password*`, `token*`; test chứng minh log không chứa chúng. Mật khẩu admin: chỉ nhập qua TTY khi `admin:create`.

### 6.3 Giám sát, log

`/healthz` (sống) và `/readyz` (DB ok) cho từng service; compose `healthcheck`; ops thêm vào watchdog hiện có (HTTP 5xx, 429, tuổi backup, kích thước DB, số job `failed`, tuổi `outbox` chưa giao). Log JSON ra stdout (`json-file`, xoay `10m × 3`), có `request_id`. Không có Prometheus/Grafana (tốn RAM); số liệu qua `/admin/stats` và watchdog.

### 6.4 Giới hạn tài nguyên (SSR; ngân sách mục tiêu ≈ 1 GB cap — vượt nhẹ, xin chủ duyệt D8)

| Service | RAM cap | CPU | Đo được (prototype, đỉnh) | Thường trực [ước] | Ghi chú |
|---|---|---|---|---|---|
| `web` (Next SSR + edge-cache) | **384 MB** (hạ từ 512), `--max-old-space-size=256` | **1,0** (render là CPU-bound, ≈ 28 render/s/lõi) | 183 MiB nguội, 146 MiB dưới tải cache | ≈ 120–180 MB | cache HTML ≤ 64 MB nằm trong cap này |
| `api` (Fastify + admin tĩnh) | 160 MB, `--max-old-space-size=128` | 0,5 | 35 MiB (prototype) | ≈ 60–100 MB | |
| `postgres` | 256 MB | 0,5 | 97 MiB | ≈ 90–120 MB | §3.1 |
| `worker` (crawl/outbox) | 320 MB | 0,5 | chưa đo | ≈ 60 MB nghỉ, ≤ 300 MB khi crawl | một job một lúc |
| **Tổng cap** | **1.120 MB** | 2,5 | **≈ 300–320 MiB (ba dịch vụ)** | **≈ 400–500 MB** | |
| `migrate` (một lần) | 128 MB | — | | chỉ khi deploy | |
| `rooms` (khi mở lại) | 192 MB | 0,5 | 151 MB đỉnh khi tải 300×6 (PR #14) | | tổng cap ≈ 1,31 GB: cần chủ chấp thuận (D8) |

Redis: 0 MB (đã bỏ). Phù hợp máy dùng chung: `free` hiện `available` ≈ 2,5–3,1 GB [đo]; kể cả khi mọi container chạm cap đồng thời, phần tăng thêm ≲ 1,05 GB (đã trừ web hiện có ≈ 72 MB) — còn ≥ 1,4 GB cho production, nhưng vì máy từng đứng hình, mọi container đặt `memswap_limit = mem_limit` và S-F bắt buộc soak-test. CPU: 3 core dùng chung; tổng cap CPU 2,5 là *trần*, không phải mức dùng (steady ≪ 1 core với cache HTML). Việc `heavy` (build/test) vẫn tuần tự qua khoá `flock`; SSR còn **bỏ** được lần rebuild Next khi publish.

### 6.5 Bố cục Docker Compose

Phác thảo: [`backend/compose.sketch.yml`](backend/compose.sketch.yml). Project `beejunior`; mạng `bj-internal` (`internal: true`: web/api/worker/postgres), mạng `menglish-proxy` (external, **chỉ `web` và `api`**), mạng `bj-egress` (chỉ `worker`, ra Internet để crawl). `postgres` chỉ ở `bj-internal`, **không publish cổng**. `web` nối thêm `bj-internal` để đến Postgres (role `bj_web` chỉ-đọc). Mọi container: user không root, `read_only: true` (+ tmpfs), `cap_drop: [ALL]`, `no-new-privileges`, `mem_limit` + `memswap_limit`, `pids_limit`, healthcheck, `restart: unless-stopped`. Volume: `bj-pgdata` (Postgres), `bj-raw` (cache thô của worker, tối đa vài trăm MB).

### 6.6 Deploy, rollback, migration không downtime

1. CI build image gắn tag theo git SHA (`api`, `web`); chủ/ops deploy bằng `docker compose up -d` — **agent không deploy**.
2. Thứ tự: backup trước → `migrate` (expand, tương thích ngược) → `api`/`worker` (rolling: khởi động bản mới, chờ `/readyz`, tắt bản cũ) → `web` nếu có bản build mới (rolling: bản mới khởi động và warm cache từ sitemap trước khi nhận lưu lượng; bản cũ giữ cache cho tới lúc đó). `web` không phụ thuộc `api` lúc chạy (chỉ cần Postgres), nên site không gián đoạn khi api khởi động lại; nếu Postgres khởi động lại, edge-cache phục vụ bản stale (§4.4).
3. **Expand/contract:** release N thêm cột/bảng nullable + dual-write; release N+1 chuyển đọc; release N+2 mới xoá cột cũ. Migration phá vỡ không bao giờ đi cùng bản code đầu tiên cần nó.
4. **Rollback:** đổi tag image về SHA trước (migration của release hiện tại luôn tương thích bản trước); chỉ khi dữ liệu hỏng mới khôi phục từ `pg_dump` (RPO ≤ 24 h) — thao tác này cần chủ duyệt.
5. Cut-over nội dung (S-B): chạy song song một giai đoạn — `web` SSR từ DB trên một cổng/host thử, so sánh HTML với bản static hiện tại (diff chuẩn hoá) và JSON trong git vẫn là nguồn cho đến khi bảng đối chiếu bằng 0; rollback = trỏ Caddy về image static cũ (giữ nguyên cho đến hết S-B); sau đó DB là nguồn sự thật và JSON trong repo thành "seed đóng băng" (đọc khi dev/CI, không sửa tay).

### 6.7 Cần chủ duyệt trên máy chủ (agent không tự làm)

1. Tạo các container mới (`postgres`, `api`, `worker`); đổi `web` sang SSR (384 MB / 1 CPU, có đường tới Postgres).
2. Volume `bj-pgdata`, `bj-raw`, thư mục `~/backups/beejunior/`, `~/beejunior-secrets/`.
3. Sửa **Caddy dùng chung với MEnglish**: thêm `/api/*` và `/admin*` → `api` (cấu hình ảnh hưởng production — cần thận trọng, reload có kiểm tra `caddy validate`).
4. Cron backup + kiểm khôi phục (ops) và mục watchdog mới.
5. Tạo secret và tài khoản admin đầu tiên (chính chủ nhập).
6. Mở lại Rooms trên API: tổng RAM vượt 1 GB.

## 7. Kế hoạch di chuyển theo sprint

Ước lượng là **ngày làm việc của agent** (dev + codex), chưa gồm thời gian chủ duyệt/tester/reviewer; tổng xem dưới bảng. Mọi sprint = một nhánh = một PR, tester chạy bộ đầy đủ. Quy tắc chung: **Site không đổi với người dùng** (HTML tương đương) khi chuyển sang SSR ở S-B, và admin chưa xuất hiện cho tới S-C; Lighthouse CI giữ ngưỡng (SEO 100, Perf ≥ 90, A11y ≥ 95, BP ≥ 95).

| Sprint | Nội dung | Ước | Kiểm thử | Tiêu chí hoàn thành |
|---|---|---|---|---|
| **S-0** (chủ) | Duyệt blueprint + trả lời D1–D12 | — | — | quyết định ghi vào repo |
| **S-A** DB + migration + importer | `db/migrations`, `api import`, `export-snapshot` (bản đầu), compose dev (không động host), trích `packages/core` từ `web/lib` (giữ test xanh) | 5–6 | unit (importer, slug); **migration** up/down trên DB rỗng và có dữ liệu; **import parity** (bảng §3.6 = 0 chênh, chạy lại idempotent); `EXPLAIN` các truy vấn nóng | 2.698/2/50/316/4.590 khớp; round-trip snapshot == JSON hiện tại; `vitest` web không đổi kết quả |
| **S-B** SSR từ DB + edge-cache + API đọc | package dữ liệu + role `bj_web`/view `v_public_*`; chuyển **toàn bộ** route công khai sang SSR (`dynamic`), sitemap/robots động, JSON-LD từ DB; edge-cache (TTL theo route, SWR, single-flight, stale-on-error, 503+Retry-After, load-shedding, `_purge`, warmer); Fastify khung (helmet, rate-limit, pino redact, errors, OpenAPI), `internal/snapshot` | 7–9 | **parity**: HTML chuẩn hoá của mọi route (canonical, title, meta, JSON-LD, số câu, thứ tự `questionIds`) và `sitemap.xml` so với bản static hiện tại = 0 chênh; **load** lặp lại §4.5 trên bản thật (1/10/50/200; p95 HIT < 100 ms, miss p95 < 300 ms ở 10 đồng thời); **chaos**: pause/kill Postgres → stale/503, không 404/500, Googlebot-UA; **memory soak** 1 h dưới cap; **Lighthouse CI** SSR vs static cùng điều kiện (chặn merge nếu SEO < 100 hoặc Perf < 90); contract (OpenAPI), security (headers, validation, rate-limit) | route + sitemap giống hệt; Lighthouse đạt ngưỡng CI; DB/API chết → trang đã warm vẫn 200 (stale), trang chưa warm 503 sạch; RSS web ≤ 384 MB dưới tải 50 đồng thời |
| **S-C** Auth admin + CMS lõi | argon2id, phiên, CSRF, TOTP (nếu D3), khoá đăng nhập, `admin:create`, CRUD nguồn/câu/bài/đề, transition, bulk có `expected_count`, `question_revisions`, `audit_log`, báo câu sai công khai, outbox | 6–7 | unit; contract; **security** (guard mọi route, brute-force, CSRF, session fixation, IDOR không có vì một chủ nhưng test thiếu cookie → 401), property test transition hợp lệ, race (If-Match) | mọi route admin 401 khi thiếu phiên (test tự liệt kê); không đường nào tạo `published` ngoài `bj_api`; audit đủ sự kiện |
| **S-D** Crawl runner + quy trình duyệt | `worker`, hàng đợi, reaper, SSRF guard, crawl VOA/gov vào quarantine qua DB, `import-ocr`, publish → outbox → `_purge` + warm (4.3) | 5–6 | unit SSRF (IP private/redirect/DNS rebinding/IPv6), integration với server giả, kill-worker/reaper, **memory** (job trong cap 320 MB), idempotent crawl | crawl lại không nhân đôi; worker không thể ghi `published` (test quyền DB); job chết được thu hồi |
| **S-E** Admin UI | SPA theo mockup đã duyệt + brand BeeJunior (Claude thiết kế brief, Codex hiện thực — theo CLAUDE.md repo), màn hình: đăng nhập, hàng đợi duyệt, sửa câu/bài, nguồn/crawl, đề + preset, báo cáo, audit | 6–8 | component + e2e Playwright (390 & 1440), a11y, CSP, test không có XSS với nội dung độc | thao tác chủ đủ vòng quarantine→published trong UI; không script nội tuyến; Lighthouse admin không bắt buộc nhưng a11y ≥ 95 |
| **S-F** Hardening + backup + quan sát | cron backup + restore-test, watchdog, giới hạn tài nguyên, đo RAM thật toàn stack, tài liệu runbook, pen-test checklist, soak-test RAM/CPU toàn stack dưới `heavy` | 3–4 | restore drill, **load** toàn stack dưới `heavy`, chaos (kill postgres/api), `npm audit`/gitleaks, rà soát reviewer | bảng RAM §6.4 được thay bằng số đo; restore-test xanh; runbook được chủ đọc |
| **Rooms** (sau S-F) | mở lại PR #17 trên `packages/core`; quyết định gộp vào `api` hay giữ `rooms` riêng (D14); ngân hàng cho rooms từ snapshot | 4–6 | giữ nguyên bộ test rooms + tải 300×6 | RSS đỉnh trong cap; không ảnh hưởng SEO |

Tổng ước tính đã cập nhật theo SSR (S-B tăng 2–3 ngày): **≈ 31–40 ngày** ≈ 7–9 tuần lịch.

Phụ thuộc: S-A → S-B → S-C → (S-D, S-E song song được sau S-C) → S-F → Rooms.

**Rủi ro chính & cách giảm:** (1) lệch dữ liệu import → bảng đối chiếu + round-trip bắt buộc; (2) RAM Node cao hơn ước → đo ở S-B, ngưỡng đổi hướng 160 MB; (3) SSR làm web tốn CPU: render bão hoà ≈ 28 req/s/lõi → bắt buộc cache HTML + load-shedding + 1 CPU cho web, kiểm bằng load test ở S-B; nếu thất bại quay về phương án static (§4.7) — bản static cũ giữ nguyên đến hết S-B; (4) sửa Caddy dùng chung → duyệt riêng, `caddy validate`, rollback file cũ; (5) mở rộng phạm vi CMS → sprint khoá phạm vi theo §5.2.

## 8. Quyết định cần chủ

Xem bản gọn kèm khuyến nghị: [backend-decisions.md](backend-decisions.md).
