# Sprint S-B — SSR từ DB + edge cache + API đọc

Trạng thái: **một phần** (xem "Chưa làm"). Code do dev viết trực tiếp vì Codex hết hạn mức tới 4/11 (đã ghi ở thẻ). Mọi số đo dưới đây là [đo] trên máy dùng chung, container throwaway (mạng `--internal`, cap D8: web 384 MB/1 CPU, api 160 MB, postgres 256 MB/0,5 CPU), không phải số ước tính.

## Đã có

| Phần | Vị trí |
|---|---|
| `@bj/data`: đọc nội dung công khai qua view `v_public_*` (1 giao dịch REPEATABLE READ, 6 truy vấn), `grades/topics/test` cho api | `packages/data` |
| Migration `0022`: cột `sort_key` (thứ tự chèn) cho các view + `GRANT SELECT` cho `bj_api` | `db/migrations/0022_*` |
| Importer xếp **lớp published trước, đúng thứ tự file seed** để danh sách/pool giống JSON | `api/src/import/plan.ts` |
| Web SSR toàn bộ route công khai (`force-dynamic`), đọc DB qua snapshot trong tiến trình (TTL 30 s, single-flight, stale-on-error), sitemap/robots/JSON-LD sinh từ cùng dữ liệu; `/readyz`, hook nội bộ `/internal/refresh` | `web/lib/content/{store,source,params}.ts`, `web/app/**` |
| Edge cache (TTL theo route, SWR, single-flight, stale-on-error, 503+Retry-After, load shedding 16/64, `/_purge`, warmer, ETag/304, LRU 64 MB, log JSON không lộ token/cookie) | `packages/edge` (33 test, ~93% dòng) |
| Fastify api: `/healthz`, `/readyz`, `/api/v1/public/{grades,topics,tests/*}`, `/api/v1/internal/snapshot` (token), `/api/v1/openapi.json`, helmet, rate-limit có header `RateLimit-*`, pino redact, lỗi `problem+json`, OpenAPI sinh từ zod + kiểm tương thích v1 | `api/src/server`, `api/openapi.v1.json` |
| Image `web` (có `edge/edge.mjs`) và `api` (esbuild một file), compose `web+api+postgres` (cap D8, secrets dạng file), `db-init.sh`, `gen-secrets.sh` (chủ chạy một lần) | `web/Dockerfile`, `api/Dockerfile`, `deploy/` |
| Công cụ đo: so khớp HTML hai site, tải | `scripts/ssr/parity.mjs`, `scripts/ssr/load.mjs` |

## Số đo

**So khớp với bản static của `main` trước S-B** (373 URL trong sitemap + 5 URL phụ, `scripts/ssr/parity.mjs`):
- sitemap: 373 URL, `lastmod`/`changefreq`/`priority` **giống hệt**.
- 374 trang HTML: tiêu đề, mô tả, canonical, robots, Open Graph, **JSON-LD**, tiêu đề mục, danh sách liên kết, số câu hỏi, văn bản hiển thị **giống hệt** (chỉ lệch 4 trang 404 của URL không tồn tại: HTML 404 động khác trang 404 tĩnh, cùng mã 404).
- 55 JSON `/pool/*`: **giống từng byte**.
- HTML thô vẫn khác ở phần payload RSC nội tuyến của React (cờ prerender, id module, `OutletBoundary`) — đây là serialisation nội bộ của framework giữa render tĩnh và động, không nhìn thấy được; không thể bằng từng byte nếu chuyển từ tĩnh sang SSR.

**Tải (edge cache nóng, 49 trang đề, `scripts/ssr/load.mjs`, load generator chạy cùng máy nên số liệu bi quan):**

| Đồng thời | req/s | TTFB p50 | p95 | p99 |
|---|---|---|---|---|
| 1 | 1.333 | 0,4 ms | 1,1 | 2,6 |
| 10 | 2.183 | 3,1 | **10,5** | 15,8 |
| 50 | 1.824 | 22,8 | 53,5 | 82,6 |
| 200 | 2.211 | 83,9 | 131,6 | 203,7 |

Không lỗi nào (0 mã khác 200). Mục tiêu p95 HIT < 100 ms đạt ở 1/10/50; ở 200 đồng thời p95 = 131,6 ms (vượt, do load generator cùng máy).

**RSS (docker stats):** web (Next + edge) 155 MiB sau tải 200 đồng thời (cap 384 MB); api: xem mục "RSS api trong container thật" bên dưới (cgroup anon ≈ 31 MiB ≠ RSS tiến trình); postgres 98 MiB (cap 256 MB).

## RSS api trong container thật (cap 160 MB, 0,5 CPU, memswap = mem)

[đo] Ảnh `api/Dockerfile`, tải 50 đồng thời, 321 URL (grades/topics/316 đề), 0 non-200, Postgres throwaway cùng mạng `--internal`. RSS = `VmRSS` của tiến trình (gồm trang file-backed); cgroup `anon` ghi kèm.

| Cấu hình | idle RSS | đỉnh RSS | cgroup anon sau tải | OOM |
|---|---|---|---|---|
| Trước: `--max-old-space-size=128`, chạy trên host không cap | 84,7 MB | 170,3 MB | n/a | n/a |
| Trước: cùng cờ, container cap 160m (30 s) | 78,7 MB | 102 MB | 44 MB | 0 |
| Sau: `--max-old-space-size=96 --max-semi-space-size=2`, container cap 160m (30 s) | 80,3 MB | 105 MB | 47 MB | 0 |

Số 170 MB đo trên host không cap (V8 không bị áp lực bộ nhớ, load generator chung máy). Trong container đúng cap, đỉnh ≈ 105 MB < 160 MB ⇒ **giữ cap 160 MB**, không nâng. Cờ heap 96 + semi-space 2 để GC sớm, chừa dư địa. Soak 10 phút (cờ "Sau", 50 đồng thời, 65.457 request, 0 non-200, ~109 req/s): idle 80,1 MB → đỉnh `VmHWM` 107,3 MB, cgroup anon 49 MB, `oom_kill` 0, `OOMKilled=false`.

## Kiểm chứng lại (1/11, stack throwaway từ HEAD, mạng `--internal`, qua `heavy`)

- **Parity** (`scripts/ssr/parity.mjs`, static build của `main` 6c908df vs SSR): sitemap 373 URL giống hệt; 378 trang so sánh, digest (title/mô tả/canonical/robots/OG/JSON-LD/heading/liên kết/văn bản/số câu) giống hệt trừ 4 URL 404 (`/lop-5`, `/lop-6/khong-co`, …: cùng mã 404, HTML 404 động khác trang 404 tĩnh); 32 pool JSON giống từng byte. HTML thô chỉ khác payload RSC nội tuyến của React.
- **Tải, miss**: sau `/_purge all`, 10 đồng thời trên 316 đề: 316 MISS đầu tiên (cả warmer chạy song song) p50 ≈ 950 ms, p99 toàn phiên 540 ms; sau đó HIT p95 9,4 ms. **Mục tiêu miss p95 < 300 ms @10 chưa đạt** với render lạnh trên 1 CPU (không chặn người dùng vì stale-while-revalidate và warmer, nhưng là rủi ro Googlebot khi cache trống).
- **Tải, HIT** (49 trang, cùng máy): p95 1,0 / 11,3 / 39,4 / 128,7 ms ở 1/10/50/200 đồng thời (1.425 / 2.051 / 2.293 / 2.342 req/s), 0 lỗi.
- **RSS**: api VmRSS 100,6 MB (VmHWM 104,9 MB) sau tải, cap 160 MB; web cgroup 149 MiB / 384 MiB (edge node 134 MB + next-server 138 MB RSS, trang chia sẻ); postgres 61 MiB / 256 MiB.
- **Lighthouse mobile, median của 3 lần**, 6 URL của `web/lighthouserc.json`, Chromium 1208: trực tiếp từ edge (không nén) Perf 77–89 (LCP 3,6–5,5 s) vì edge không nén (nén là việc của Caddy `encode`, ADR 0005); static của `main` cùng điều kiện Perf 86–95. **Phía sau Caddy `encode zstd gzip`** (đúng topo production): Perf 94–98, A11y 100, SEO 100 ở cả 6 URL. Best-practices 79 chỉ vì đo qua HTTP thường (không HTTPS) trong mạng nội bộ. CI Lighthouse trên PR cũng xanh.
- **Memory soak 1 giờ và chaos Postgres** vẫn chưa chạy.

## Chưa làm (cần phiên tiếp theo)

- Cải thiện **miss lạnh** (p95 < 300 ms @10) hoặc chủ chấp nhận rủi ro; chaos (pause/kill Postgres → STALE/503 với UA Googlebot) trên stack thật; soak RAM 1 giờ.
- Chuẩn hoá lại thứ tự trang 404 nếu cần byte-equal; ghi ADR 0005 (snapshot nội dung trong tiến trình thay vì 2–4 truy vấn/trang; edge là package riêng bundle bằng esbuild).

## Triển khai (boss, theo gói được chủ duyệt — agent không chạy trên máy chủ)

`deploy/compose.yml` (thứ tự: `up postgres` → `run migrate` → `run db-init` → `run import` lần đầu → `up api web`), Caddy: `/api/*` → `api:8080`, còn lại → `web:3100`. Rollback: giữ image static cũ.
