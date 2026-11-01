# Chuẩn kỹ thuật backend (TypeScript) — BeeJunior

Áp dụng cho `packages/*`, `api/`, `worker/`, `admin/`, `db/` và mọi code mới. `web/`, `rooms/`, `crawler/` hiện có tuân theo mục [Ratchet](#ratchet). Quyết định nền: [ADR 0001](adr/0001-stack-typescript.md), [blueprint](backend-blueprint.md). Checklist nghiệm thu: [definition-of-done.md](definition-of-done.md).

**Cách đọc.** Mỗi quy tắc có *vì sao* (ngắn) và nhãn thực thi:
**[E]** = máy chặn (CI/lint/script, nêu tên) · **[T]** = chặn bằng test bắt buộc trong PR · **[D]** = chỉ là tài liệu, reviewer kiểm tay. Quy tắc **[D]** là nợ: khi có thể, chuyển thành [E]/[T].

Lệnh gốc: `npm run check` = lint + format + typecheck + boundaries + licenses. Việc nặng chạy qua `~/.local/bin/heavy -m 1800M -- <lệnh>` (máy dùng chung, tuần tự theo khoá).

---

## 1. Bố cục monorepo, đặt tên, ranh giới module

```
packages/core/    zod schema, mixer, scoring, slug, topics — thuần, KHÔNG I/O
packages/<x>/     thư viện dùng chung khác (db-types, openapi, config)
api/              Fastify (public/admin/internal) + CLI (migrate, import, admin:create)
worker/           cùng image với api, entrypoint khác: crawl, outbox
admin/            SPA Vite+React (S-E)
web/              Next.js SSR — không import api/worker
rooms/            tiến trình thời gian thực (tạm dừng)
db/migrations/    SQL tuần tự NNNN_ten.sql (up+down)
deploy/           compose, Caddy snippet, .env.example
docs/ docs/adr/   tài liệu, ADR
scripts/          công cụ repo (kiểm tra commit, license, deps)
```

**Đặt tên** — *vì sao:* đoán được tên là đoán được chỗ; không tranh luận lặp lại.

| Thứ | Quy ước | Ví dụ |
|---|---|---|
| File/thư mục TS | `kebab-case` | `score-attempt.ts`, `crawl-runner/` |
| Package | `@bj/<kebab>` | `@bj/core` |
| Biến/hàm | `camelCase` | `buildTestSlug` |
| Type/class/component | `PascalCase` | `QuestionSet` |
| Hằng toàn cục | `UPPER_SNAKE` | `MAX_BODY_BYTES` |
| Bảng DB | số nhiều `snake_case` | `question_revisions` |
| Cột DB | `snake_case`; FK `<bảng_số_ít>_id`; thời điểm `*_at` | `reading_passage_id`, `created_at` |
| Route API | `kebab-case`, danh từ số nhiều | `/api/v1/admin/review-items` |
| Query/JSON field | `camelCase` trong JSON công khai | `questionId` |
| Test | `<tên>.test.ts` cạnh file hoặc trong `tests/` của package | `slug.test.ts` |

[E] `@typescript-eslint/naming-convention` (property được phép snake_case/header vì là tên dây nối/DB); tên bảng/cột ở §4 kiểm bằng migration test [T]; route kebab [T] (test liệt kê route, regex).

**Ranh giới module** — *vì sao:* giữ `core` kiểm thử được không cần DB, và để thay `api` sang Go sau này vẫn khả thi (hợp đồng = OpenAPI + SQL).

- `packages/core` không I/O: không `fs/net/http`, `pg`, `kysely`, `fastify`, `fetch`, `process`. [E] `eslint no-restricted-imports/globals` + `dependency-cruiser core-is-pure, core-no-io-libs`.
- `api` và `worker` chỉ chia sẻ code qua `packages/*`, không import nhau. [E] `api-worker-isolated`, `worker-not-api`.
- `web`/`admin` không import `api`/`worker` (nói chuyện bằng HTTP + type sinh từ OpenAPI). [E] `web-not-api-internals`.
- Chỉ import package qua entry công khai `packages/<x>/src/index.ts`; không `../../packages/x/src/deep`. [E] `no-deep-package-imports`.
- Không vòng phụ thuộc. [E] `no-circular`.

```ts
// ĐÚNG                              // SAI (CI đỏ)
import { mixTest } from "@bj/core";   import { mixTest } from "../../packages/core/src/mixer";
```

Cấu hình: `.dependency-cruiser.cjs`, chạy `npm run deps:check` (chỉ quét thư mục đang tồn tại).

## 2. TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`. *Vì sao:* bắt `undefined` do truy cập mảng/optional — nguồn lỗi runtime hàng đầu. [E] `tsconfig.base.json`; mỗi package **extends** nó, không tự nới (`{"extends": "../tsconfig.base.json", "include": ["src"]}`) ; `tsc --noEmit` trong CI.
- Cấm `any` (`no-explicit-any`, `no-unsafe-*`); dùng `unknown` + zod parse. [E] eslint `strictTypeChecked`. Ngoại lệ: `// eslint-disable-next-line <rule> -- <lý do>` một dòng, reviewer duyệt.
- Cấm `enum` thường; dùng union literal hoặc `as const`. [E] `no-restricted-syntax`.
- Cấm `console.*` trong code ứng dụng; dùng logger pino (§6). [E] `no-console`.
- ESM (`"type": "module"`), import có đuôi `.js` khi `NodeNext`; `import type` cho type. [E] `consistent-type-imports`, `verbatimModuleSyntax`.
- Node LTS ghim: `.nvmrc` = `22`, `engines.node: ">=22.12"` ở mỗi `package.json`, CI dùng `node-version-file: .nvmrc`. Nâng LTS = ADR. [E] CI + `engine-strict` khi bật `.npmrc` ở S-A.
- Không `!` (non-null) ngoài test; không `as` để thoát kiểm tra — parse bằng zod. [E] `no-non-null-assertion` (strict); `as` [D].

```ts
const Env = z.object({ PORT: z.coerce.number().int().default(3000) });
const row = rows[0];            // type: Row | undefined (noUncheckedIndexedAccess)
if (!row) throw new NotFoundError("test");
```

## 3. Quy ước API

- **REST:** danh từ số nhiều, kebab; `GET` an toàn & idempotent; `POST` tạo; `PUT/PATCH` cập nhật (`PATCH` + `If-Match: <version>` cho khoá lạc quan); `DELETE` idempotent. Không động từ trong path trừ hành động nghiệp vụ rõ (`POST /…/{id}/publish`). [T] test liệt kê route.
- **Phiên bản:** tiền tố `/api/v1`. Chỉ *cộng thêm* trường/route trong v1; đổi phá vỡ ⇒ `/api/v2` song song + header `Deprecation`/`Sunset` ≥ 90 ngày. *Vì sao:* client (web, admin) triển khai lệch pha. [T] contract diff OpenAPI với bản ở `main` (script thêm ở S-B: không xoá/đổi kiểu trường ⇒ đỏ).
- **Validation zod ở mọi biên** (body, query, params, headers dùng tới, env, file import, phản hồi nguồn crawl). `.strict()` để từ chối trường lạ; body ≤ 64 KB (1 MB cho import có chủ đích). *Vì sao:* dữ liệu từ ngoài là không tin cậy. [T] test tự duyệt mọi route khẳng định có schema (route không schema không đăng ký được).
- **Lỗi: RFC 9457** `application/problem+json`, mã ổn định (không đổi nghĩa):

```json
{ "type": "https://beejunior.meducation.vn/problems/validation-failed",
  "title": "Validation failed", "status": 422, "code": "validation_failed",
  "detail": "limit must be ≤ 100", "instance": "/api/v1/admin/review-items",
  "request_id": "01JABC…", "errors": [{ "path": "limit", "message": "…" }] }
```
  `code` ∈ danh mục đóng trong `packages/core/src/problems.ts` (`validation_failed`, `unauthenticated`, `forbidden`, `not_found`, `conflict`, `version_mismatch`, `rate_limited`, `payload_too_large`, `idempotency_key_reuse`, `internal`). Không lộ stack/SQL/đường dẫn. Blueprint §5 dùng dạng `{error:{…}}` cũ — **chuẩn này thay thế** nó; cập nhật blueprint ở S-B. [T] test mỗi nhánh lỗi trả problem+json hợp lệ.
- **Mã trạng thái:** 200/201(+`Location`)/204; 400 JSON hỏng; 401 chưa đăng nhập; 403 không quyền (CSRF fail); 404; 409 xung đột trạng thái; 412 `If-Match` sai; 413; 422 validation; 429 (+`Retry-After`); 5xx chỉ cho lỗi thật, 503 + `Retry-After` khi quá tải/DB chết. [T]
- **Phân trang cursor:** `?limit=50&cursor=<opaque>` (mặc định 50, tối đa 100), sắp xếp ổn định theo khoá duy nhất `(sort_col, id)`; phản hồi `{ "items": […], "nextCursor": "…" | null }`. Không dùng `OFFSET` cho bảng lớn. [T]
- **Idempotency:** mọi `POST` không an toàn có thể bị thử lại (publish, import, báo lỗi) nhận header `Idempotency-Key` (UUID); lưu `(key, hash(body), response)` 24 h; cùng key + body khác ⇒ 422 `idempotency_key_reuse`. [T] (S-C)
- **Rate-limit header:** mọi route có giới hạn trả `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (+ `Retry-After` khi 429). Giới hạn đăng nhập/báo lỗi chặt hơn. [T]
- **OpenAPI sinh từ zod** (không viết tay file song song); `docs/backend/openapi-sketch.yaml` chỉ là phác thảo, được thay bằng bản sinh. Contract test: mọi phản hồi trong test khớp schema. [T] (S-B)
- **Quyền deny-by-default:** plugin `adminGuard` ở prefix `/api/v1/admin`; test liệt kê mọi route và khẳng định 401 thiếu phiên. [T]

## 4. Cơ sở dữ liệu

- **Migration SQL thuần** bằng `node-pg-migrate`, file `db/migrations/NNNN_ten_snake.sql` (4 chữ số tuần tự), có **up và down**. *Vì sao:* SQL là nguồn sự thật, review được, không phụ thuộc ORM. [T] migration test: lên toàn bộ trên DB rỗng, xuống từng bước, lên lại; [E] script kiểm có `-- Down`.
- **Một mối quan tâm / migration** (một bảng hoặc một thay đổi cột). **Không bao giờ sửa migration đã áp dụng** (đã merge vào `main`); sửa = migration mới. [E] CI so băm các file migration đã có ở `origin/main` (script thêm ở S-A) / [D] cho tới đó.
- **Ràng buộc:** `PRIMARY KEY bigint GENERATED ALWAYS AS IDENTITY`; mã công khai ổn định `external_id`; mọi quan hệ có `FOREIGN KEY` (+ `ON DELETE` nêu rõ) **và chỉ mục trên cột FK**; `NOT NULL` mặc định, nullable phải có lý do; enum = `text` + `CHECK`; `UNIQUE` cho khoá nghiệp vụ. [T] test schema (information_schema) khẳng định FK có index.
- **Thời gian:** luôn `timestamptz`, lưu UTC; `created_at`/`updated_at` (trigger); khoá lạc quan `version int`. Cấm `timestamp without time zone`. [T]
- **Xoá:** mặc định *xoá thật*. Soft delete (`deleted_at`) chỉ cho nội dung biên tập cần khôi phục (câu hỏi, bài đọc, đề) và phải loại khỏi view công khai; lịch sử ở `*_revisions`/`audit_log`. Dữ liệu cá nhân/báo cáo có hạn lưu (180 ngày) xoá thật bằng job.
- **Giao dịch:** mỗi thao tác nghiệp vụ nhiều bước = 1 transaction (`db.transaction().execute(...)`); không I/O mạng (fetch) trong transaction; chỉ ghi `published` qua một hàm duy nhất của `api`. [T]
- **Không N+1:** không truy vấn trong vòng lặp; dùng `JOIN`/`WHERE id = ANY($1)`. [T] test đếm số truy vấn cho route nóng; `EXPLAIN` truy vấn nóng lưu trong PR ở S-A. Có `statement_timeout`.
- **Kiểu Kysely sinh từ DB** bằng `kysely-codegen` vào `packages/db-types/src/db.generated.ts` (không sửa tay, bị eslint bỏ qua); CI sinh lại và `git diff --exit-code`. [E] (S-A)
- **Quyền tối thiểu:** role riêng `bj_migrate` (DDL), `bj_api` (DML cần thiết), `bj_worker` (không ghi `published`), `bj_web` (chỉ `SELECT` view `v_public_*`). Mật khẩu từ Docker secrets (§8). [T] test quyền DB (worker không thể ghi `published`).
- **Expand → backfill → contract** cho không downtime: mỗi migration tương thích với image `api` *trước đó*. Đổi tên/xoá cột = 3 PR (thêm → dùng cả hai/backfill → bỏ). Cấm `ALTER … NOT NULL`/`CREATE INDEX` không `CONCURRENTLY` trên bảng lớn trong cùng deploy với code dùng nó. [D] reviewer, [T] migration test với dữ liệu mẫu.
- **Seed ≠ migration:** migration chỉ đổi *cấu trúc* (+ dữ liệu tham chiếu bất biến, vd. bảng khối lớp). Dữ liệu nội dung vào qua importer idempotent (`api import`), chạy lại không nhân đôi; fixture test nằm trong test, không trong `db/migrations`. [T] import-parity.

```sql
-- db/migrations/0007_add_reports_table.sql
-- Up
CREATE TABLE question_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('wrong_answer','typo','other')),
  client_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_reports_question_id_idx ON question_reports (question_id);
-- Down
DROP TABLE question_reports;
```

## 5. Bảo mật (OWASP ASVS L1 ánh xạ sang stack)

Dự án công khai, có học sinh (trẻ em), một admin. Chi tiết mô hình đe doạ: blueprint §6, [security.md](security.md) (nếu mâu thuẫn, mục này thắng cho phần Node; phần Go/Gin của security.md là cũ).

| ASVS | Yêu cầu | Cách làm trong stack | Thực thi |
|---|---|---|---|
| V2 Xác thực | một chủ, mật khẩu argon2id, khoá sau N lần sai, TOTP tuỳ chọn (D3) | `@node-rs/argon2`; rate-limit + khoá theo tài khoản | [T] brute-force |
| V3 Phiên | cookie `HttpOnly; Secure; SameSite=Lax`, id ngẫu nhiên ≥ 128 bit, xoay vòng khi đăng nhập, thu hồi khi đăng xuất, hết hạn tuyệt đối + nhàn rỗi | `@fastify/cookie` + bảng `sessions` (lưu băm) | [T] fixation, hết hạn |
| V4 Kiểm soát truy cập | deny-by-default, kiểm ở **server** cho mọi route admin | `adminGuard` | [T] liệt kê route |
| V5 Đầu vào | zod mọi biên; truy vấn tham số hoá (Kysely); không nối chuỗi SQL | §3, §4 | [E] eslint cấm `sql.raw` ngoài `db/`; [T] |
| V5 XSS | nội dung crawl là text thuần, render dạng text; cấm `dangerouslySetInnerHTML` với dữ liệu nguồn; CSP không script nội tuyến | `@fastify/helmet`, CSP ở web | [E] eslint `react/no-danger`(web); [T] XSS |
| V4/V13 CSRF | route thay đổi trạng thái dùng cookie ⇒ `SameSite` + token CSRF (double-submit) hoặc kiểm `Origin` | plugin CSRF | [T] |
| V14 Header | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`, `Permissions-Policy`; CORS chỉ domain site | helmet; Caddy | [T] test header |
| V12/V13 SSRF | fetch URL chỉ qua `safeFetch`: allowlist nguồn+giao thức, resolve DNS rồi kiểm IP (chặn loopback/private/link-local/metadata, IPv6), kiểm từng redirect, timeout/kích thước/kiểu nội dung | `packages`/`worker` | [T] unit SSRF (rebinding, redirect) ; [E] eslint cấm `fetch`/`undici` trực tiếp ngoài `safe-fetch.ts` |
| V6/V14 Bí mật | không trong repo/image; nạp qua `*_FILE`; gitleaks | §8 | [E] gitleaks CI |
| V7 Log | không bí mật/PII; redact (§6) | pino `redact` | [T] test log |
| V10 Mã độc/phụ thuộc | lockfile, audit chặn high+, allowlist giấy phép, ít dependency | §10 | [E] CI |
| V8 Dữ liệu | **không PII của học sinh**: không email/tên/IP thô; chỉ `device_hash`/`client_hash = HMAC(ip+ua, muối xoay tháng)`; báo cáo xoá sau 180 ngày | thiết kế schema | [T] test schema không có cột PII cấm; [D] reviewer |
| V11 Logic | chống lạm dụng: rate-limit theo route, honeypot, giới hạn kích thước | `@fastify/rate-limit` | [T] |

Mọi tính năng chạm auth/phiên/SSRF/quyền DB cần reviewer kiểm theo bảng này; chủ duyệt riêng trước khi thực hiện (security.md).

## 6. Log, quan sát, sức khoẻ

- **pino JSON ra stdout**, không file; mức: `error` (cần người xem), `warn` (bất thường tự phục hồi), `info` (sự kiện nghiệp vụ/khởi động), `debug` (tắt ở prod). Mỗi dòng có `request_id` (nhận `X-Request-Id` hợp lệ hoặc sinh ULID; trả lại trong header & problem+json). [T]
- **Redact bắt buộc:** `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `*.password*`, `*.token*`, `*.secret*`, `*.api_key`; không log body request, IP thô (chỉ hash), nội dung câu hỏi hàng loạt. *Vì sao:* log bị đọc rộng hơn DB. [T] test: log một request mang các trường đó ⇒ chuỗi không xuất hiện.
- **Sức khoẻ:** `GET /healthz` (tiến trình sống, không chạm DB) và `GET /readyz` (kiểm DB, timeout 1 s, 503 khi lỗi) cho `api`, `worker`, `web`. Compose `healthcheck` dùng chúng. [T]
- **Số liệu:** không Prometheus/Grafana (tốn RAM). `GET /api/v1/admin/stats` + watchdog của ops: 5xx, 429, tuổi backup, cỡ DB, job `failed`, tuổi `outbox` chưa giao. Mỗi service xuất log `event=…` có thể đếm.
- **Ngân sách lỗi (error budget):** mục tiêu khả dụng trang công khai 99,5%/tháng (≈ 3,6 giờ); 5xx < 0,5% request, p95 HIT < 100 ms, miss p95 < 300 ms ở 10 đồng thời (blueprint §7/S-B). Hết ngân sách ⇒ đóng băng tính năng mới tới khi sửa nguyên nhân (ghi vào ADR/PR). [D]

## 7. Cấu hình

- Env đọc **một lần** lúc khởi động qua `loadConfig()` dùng zod (`z.object({...}).strict()`); thiếu/sai ⇒ process thoát code 1 với thông báo tên biến (không in giá trị). Phần còn lại của code nhận config qua tham số, không đọc `process.env` rải rác. [E] eslint `no-restricted-properties process.env` ngoài `config.ts` (bật ở S-A) / [T] test config.
- Bí mật qua `*_FILE` (đọc file) — không qua biến môi trường in được. Mỗi service có `.env.example` (khoá, ví dụ giả, chú thích; **không giá trị thật**); `.env*` thật nằm trong `.gitignore`. [E] gitleaks + `.gitignore`.
- Cấm commit secret, kể cả "tạm thời" hay đã xoá ở commit sau (lịch sử còn). Lộ ⇒ xoay khoá ngay và báo chủ. [E] gitleaks (quét toàn lịch sử trong PR).

## 8. Kiểm thử

- **Kim tự tháp:** nhiều unit (core, nhanh, không I/O) → ít integration (api + Postgres thật qua container test, không mock DB) → rất ít e2e Playwright cho **đường găng**: làm bài đến điểm, xem đề công khai, đăng nhập admin→publish. Không mock thứ ta sở hữu (DB); mock biên ngoài (mạng crawl).
- **Công cụ:** `vitest`. Tên: `describe("<đơn vị>")` + `it("<hành vi> when <điều kiện>")`, tiếng Anh.
- **Dữ liệu/fixture:** factory nhỏ (`makeQuestion({...})`), seed cố định cho RNG; nội dung mẫu là **nội dung gốc của dự án**, không dán đề thật có bản quyền, không PII. Mỗi test tự dọn (transaction rollback hoặc schema riêng).
- **Contract test** với OpenAPI sinh (§3); **migration test** (up/down/up trên rỗng và có dữ liệu); **import-parity** (đếm 2.698/2/50/316/4.590 khớp, chạy lại idempotent, round-trip snapshot == JSON hiện tại) — blueprint §3.6/S-A.
- **Sàn coverage:** `packages/core` ≥ 90%, `api` ≥ 80% (dòng & nhánh), cấu hình `coverage.thresholds` trong `vitest.config.ts` của package ⇒ `npm test -- --coverage` đỏ nếu thấp hơn. Tăng sàn được, **hạ sàn cần ADR**. [E] khi package tồn tại (S-A) ; không đo coverage giả bằng test rỗng.
- **Không flaky:** cấm `setTimeout`/`sleep` chờ thật trong test, dùng fake timers hoặc chờ điều kiện có timeout; cấm phụ thuộc thứ tự, giờ hệ thống, mạng ngoài; test hỏng chập chờn bị **cách ly trong 1 ngày rồi sửa**, không `retry` che. [E] eslint `vitest/no-focused-tests` (bật cùng plugin ở S-A); [D] reviewer.
- **Ngân sách hiệu năng** (blueprint §4.5/§6.4) kiểm bằng test tải trước khi merge sprint S-B/S-F: p95 HIT < 100 ms, miss p95 < 300 ms @10 đồng thời; RSS: web ≤ 384 MB dưới 50 đồng thời, api ≤ 160 MB, worker ≤ 320 MB; Lighthouse CI: SEO 100, Perf ≥ 90, A11y ≥ 95, BP ≥ 95. [E] Lighthouse CI (ci.yml) ; còn lại [T] script tải.
- **Việc nặng** (vitest toàn bộ, build, Playwright, Lighthouse, docker) luôn qua `~/.local/bin/heavy -m 1800M -- …`; không chạy hai bộ đầy đủ song song. Dev chạy test liên quan; tester chạy bộ đầy đủ.

## 9. Git, PR, ADR

- **Nhánh:** từ `origin/main` mới nhất, worktree `../wt-<tên>`; tên `<type>/<kebab>`, `type` ∈ `feat|fix|docs|refactor|test|chore|perf|build|ci`. Không commit lên `main`. Một yêu cầu = một nhánh = một PR; lỗi tester/reviewer sửa **vào cùng nhánh**.
- **Commit:** một dòng tiếng Anh `type(scope)?: summary` ≤ 72 ký tự, ví dụ `feat(api): add cursor pagination to review items`. **Cấm** `Co-Authored-By`, "Generated by/with …", 🤖. [E] `scripts/check-commits.mjs` (CI `commits`); chạy cục bộ: `npm run commits:check`.
- **PR nhỏ:** một mục đích, mục tiêu < ~400 dòng đổi (không tính file sinh/lock); lớn hơn ⇒ tách hoặc giải thích. Mô tả bằng tiếng Việt theo [mẫu PR](../.github/pull_request_template.md). CODEOWNERS = owner. [E] template + CODEOWNERS; cỡ PR [D].
- **Definition of Ready** (trước khi dev bắt đầu): mục tiêu & tiêu chí nghiệm thu rõ; phụ thuộc/quyết định đã có (ADR); ghi chạm hạ tầng máy chủ hay không; test cần có đã nêu. **Definition of Done:** [definition-of-done.md](definition-of-done.md).
- **Checklist review (reviewer):** theo definition-of-done + mục 3/4/5; ưu tiên: đúng → an toàn → test → đơn giản → tên gọi. Phát hiện phải trích dòng; lỗi nền (có sẵn trên `main`, không do PR) báo riêng, không gộp vào PR.
- **ADR:** quyết định có hệ quả kiến trúc/hạ tầng/dependency nặng/hạ sàn chất lượng ⇒ `docs/adr/NNNN-ten.md` từ `0000-template.md`, trạng thái đề xuất → được chấp nhận (chủ duyệt). ADR **không sửa lịch sử**: thay thế bằng ADR mới. Hiện có: 0001 (D1), 0002 (R0, D2–D14), 0003 (sao lưu R2).
- **Changelog:** `CHANGELOG.md` (Keep a Changelog) ghi thay đổi nhìn thấy được/khác biệt vận hành ở mỗi PR đổi hành vi; chưa tạo tệp cho tới PR đầu tiên có code backend (S-A) [D].

## 10. Dependencies

- Lockfile `package-lock.json` bắt buộc, commit; CI dùng `npm ci` (lệch lockfile ⇒ đỏ). Khoảng phiên bản `^` chỉ trong cùng major; **nâng major = PR riêng** (có changelog nguồn). [E] `npm ci`.
- `npm audit --audit-level=high` chặn merge ở mọi package. [E] CI job `audit`. Lỗ hổng không có bản vá ⇒ ghi ngoại lệ có hạn trong PR + chủ biết.
- **Allowlist giấy phép:** MIT, MIT-0, ISC, BSD-2/3, 0BSD, Apache-2.0, BlueOak-1.0.0, CC0-1.0, CC-BY-4.0, Python-2.0, Unlicense, MPL-2.0, Zlib. Giấy phép khác (GPL/AGPL/LGPL/không rõ) ⇒ bị chặn trừ khi có mục trong `scripts/license-exceptions.json` kèm ADR. [E] `npm run licenses:check`.
- **Cadence cập nhật (thủ công, kiểu Renovate):** mỗi tháng một PR `chore(deps)` cho minor/patch của từng package; vá bảo mật ngay khi audit báo; major theo nhu cầu. Không bật bot tự merge. [D]
- **Thư viện nặng cần ADR:** ORM, framework mới, thư viện > ~1 MB cài hoặc kéo > 20 phụ thuộc gián tiếp, bất kỳ thứ gì chạy thêm tiến trình thường trực (cache, queue, Redis — xem D2). *Vì sao:* RAM/CPU chung cho cả máy; bề mặt tấn công. [D] reviewer.

## 11. Quy tắc cho agent AI (dev/Codex/tester/reviewer)

- **Prompt cho Codex/agent phải trích chuẩn này:** nêu "tuân thủ `docs/engineering-standards.md` mục X, Y" + tiêu chí nghiệm thu + tệp liên quan + "không commit/push/merge/deploy, không chạy docker hay bộ test đầy đủ, không đụng tệp ngoài worktree". Code & comment tiếng Anh.
- **Agent không được:** đọc/in/sửa secret (`.env*` thật, `~/beejunior-secrets/`, SSH key, `~/.hermes/**/.env`); đổi cấu hình máy chủ (Caddy, compose chạy thật, cron, apt, restart dịch vụ, `docker rm/prune`); ghi vào DB production; thêm dependency nặng/đổi stack không có ADR; mở PR thứ hai cho cùng yêu cầu; hạ sàn coverage/nới lint để "cho qua"; tắt kiểm tra bằng `eslint-disable`/`@ts-ignore` không lý do.
- **Dev:** chạy test liên quan + `npm run check` trước khi push; ghi trong thẻ phần nào do Codex viết, đã review diff.
- **Tester:** chạy bộ đầy đủ qua `heavy`, kiểm từng mục [T] của definition-of-done có test tương ứng và test thật sự chạm hành vi (không rỗng).
- **Reviewer:** duyệt theo definition-of-done + mục 3/4/5; kiểm các mục [D] bằng tay; bất kỳ [E] bị tắt/nới trong diff là *finding chặn*.

## 12. i18n và nội dung

- Mọi chuỗi hiển thị cho người dùng (UI, thông báo lỗi người dùng thấy, email) bằng **tiếng Việt có dấu**; `lang="vi"`; slug không dấu. Mã lỗi (`code`), log, tên biến, comment, commit: **tiếng Anh**. *Vì sao:* người dùng là học sinh Việt Nam; máy và đội đọc code bằng tiếng Anh.
- Problem+json: `title` tiếng Anh ổn định cho máy; thông điệp cho người dùng do client dịch theo `code` (bảng `code → tiếng Việt` nằm trong `web`/`admin`). [D]
- Nội dung câu hỏi: không do AI sinh, không sao chép; qua quy trình quarantine → chủ duyệt → publish ([content-sources.md](content-sources.md)). [T] test: không có đường tạo `published` ngoài `api`.

---

## Ratchet

Không format/lint hàng loạt mã cũ. Quy tắc áp dụng theo mức:

| Cây | ESLint gốc | Prettier | tsconfig | Ghi chú |
|---|---|---|---|---|
| `packages/ api/ worker/ admin/ db/` (mới) | `strictTypeChecked` — lỗi | bắt buộc | extends `tsconfig.base.json` | mọi quy tắc ở trên |
| `rooms/`, `crawler/` | baseline `recommended` — `any`/biến thừa là **cảnh báo** | không (bị `.prettierignore`) | tsconfig riêng (strict, chưa có `noUncheckedIndexedAccess`) | còn 6 cảnh báo; PR dọn dẹp riêng chuyển thành lỗi, xoá khỏi `LEGACY_FILES`, bỏ khỏi `.prettierignore` |
| `web/` | `eslint-config-next` riêng (`web/eslint.config.mjs`), bị bỏ qua ở gốc | không | tsconfig Next riêng | lint/typecheck/test/Lighthouse ở `ci.yml` |

Quy tắc ratchet: **số cảnh báo/ngoại lệ chỉ giảm**. Khi chạm một tệp cũ có thể sửa nhỏ cho tuân thủ (boy-scout) nhưng không format cả tệp trong PR chức năng. Tách `rooms`/`crawler`/`web` vào chuẩn đầy đủ là việc của PR riêng, mỗi cây một PR.

## Bảng thực thi tóm tắt

| Cơ chế | Chặn cái gì | Ở đâu |
|---|---|---|
| ESLint strict (gốc) | any, floating promise, naming, console, enum, I/O trong core | `eslint.config.js`, job `repo-checks` |
| Prettier + EditorConfig | định dạng mã mới | `.prettierrc.json`, `.editorconfig`, `format:check` |
| tsconfig.base | strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes | `tsconfig.base.json` |
| dependency-cruiser | vòng phụ thuộc, ranh giới core/api/worker/web, deep import | `.dependency-cruiser.cjs`, `deps:check` |
| check-commits | định dạng commit, Co-Authored-By/Generated by | `scripts/check-commits.mjs`, job `commits` |
| check-licenses | giấy phép ngoài allowlist | `scripts/check-licenses.mjs` |
| npm audit | lỗ hổng high+ | job `audit` |
| gitleaks | secret trong lịch sử | job `secrets` |
| typecheck/test rooms, crawler | hồi quy | job `tests` |
| PR template, CODEOWNERS | quy trình review | `.github/` |

Mọi mục [T] ở trên là **hợp đồng cho sprint**: PR nào giới thiệu tính năng tương ứng phải kèm test đó (reviewer chặn nếu thiếu). Mục [D] chưa có máy chặn.
