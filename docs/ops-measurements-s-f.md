# Số đo toàn stack (S-F)

Đo ngày 2026-11-01 trên máy dùng chung (3 core / 5,9 GB, có việc khác chạy song song), stack **thật** từ `deploy/compose.yml` (project tách riêng `bjsf`, mạng riêng, volume riêng, dữ liệu hạt giống 2.700 câu hỏi/316 đề, DB 16 MB), image dựng từ commit của PR này. Công cụ: `scripts/ops/fullstack.sh` (tải, soak, chaos, drill), `scripts/ops/pentest.mjs`; mọi lệnh nặng chạy qua `~/.local/bin/heavy`; container gắn nhãn `hermes.task` và đã dừng/xoá sau khi đo. Chạy lại: `BJ_FS_SECRETS=<thư mục gen-secrets> TAG=<tag> scripts/ops/fullstack.sh up|stats|load|soak|chaos|drill|down`.

## 1. RAM/CPU so với trần D8

| Dịch vụ | Trần (D8) | Nghỉ (sau khởi động) | Đỉnh trong soak 30 phút | Ghi chú |
|---|---|---|---|---|
| web (Next + edge) | 384 MB / 1 CPU | 131–169 MiB | **178,5 MiB** (46 %) | CPU 23–85 % của 1 lõi khi tải 4 kết nối + xoá cache mềm mỗi 5 phút |
| api | 160 MB / 0,5 CPU | 33–35 MiB | **65,4 MiB** (41 %) | tải chủ yếu là 429 (giới hạn tốc độ), CPU 37–51 % |
| postgres | 256 MB / 0,5 CPU | 23–85 MiB | **84,8 MiB** (33 %, đo ở bài tải 60 s) | trong soak ≈ 23–33 MiB vì vừa khởi động lại sau chaos; DB 16 MB |
| worker | 320 MB / 0,5 CPU | 28–46 MiB | **46 MiB** (14 %) | rảnh; đỉnh khi cào thật đã đo ở S-D: 263 MB |
| **Tổng đỉnh đo được** | 1.120 MB | ≈ 360 MiB | **≈ 345 MiB** (web 178 + api 65 + pg 33 + worker 46; khi pg 85: ≈ 395) | thấp hơn nhiều so với trần; `OOMKilled=false` mọi lúc, 0 khởi động lại do OOM |

Máy: `free` trước/sau: `available` 3,0 GB (khi stack chạy, cùng việc nền khác). Kết luận: trần D8 đủ rộng; web là dịch vụ duy nhất đáng theo dõi (đỉnh 178 MiB so với trần 384).

## 2. Tải và soak

| Phép đo | Kết quả |
|---|---|
| Tải 60 s, 20 kết nối vào web (80 URL) | **1.389 req/s**, 83.367 × 200, 0 lỗi, 100 % HIT, TTFB p50/p95/p99 = 12,1 / 26,5 / 40,3 ms |
| Soak 30 phút, 4 kết nối vào web + xoá cache mềm toàn bộ mỗi 5 phút | **1.508.935 yêu cầu, 0 lỗi, tất cả 200** (1.489.538 HIT + 19.397 STALE), 838 req/s, TTFB p50/p95/p99 = 3,1 / 11,3 / 19,9 ms |
| Soak song song vào api (2 kết nối, đường công khai) | 3.705 × 200 và 1.722.774 × 429 (giới hạn 120/phút/IP hoạt động đúng, p95 53 ms, 0 lỗi mạng/5xx) |
| Ngân sách DoD: p95 HIT < 100 ms | đạt (11–27 ms) |

Hạn chế: một lần đo 30 phút (blueprint dự kiến 1 giờ cho prototype); không có rò rỉ thấy được (web 169 → 178 → 151 MiB, api 51 → 65 → 47 MiB). Lighthouse không đo lại vì HTML không đổi (chỉ thêm header).

## 3. Chaos (script `chaos`, 12 kỳ vọng, 0 lỗi, chạy lại sau khi sửa F2)

| Sự cố | Hành vi đo được |
|---|---|
| `kill -9` init của api (giống OOM/crash) | web vẫn 200; restart policy đưa api healthy sau **6 s** |
| `docker kill` postgres rồi khởi động lại sau 8 s | trang hết hạn vẫn trả **200 HIT/STALE** cho Googlebot khi DB chết; `api /healthz` 200; postgres healthy sau **18 s**; `/readyz` api+web hồi phục sau **20 s** mà **không khởi động lại** dịch vụ nào; 2.700 câu hỏi nguyên vẹn |
| Sau sự cố postgres | web RestartCount = 0, api không crash thêm, worker RestartCount = 0 (trước khi sửa F2 worker thoát 2 lần) |

Lưu ý: ở Docker 29, `docker kill` được tính là dừng thủ công nên **không** kích hoạt `restart: unless-stopped`; sự cố thật (OOM, segfault) thì có. Postgres chạy uid 70 nên không giả lập crash từ máy chủ không có sudo; kiểm hồi phục WAL bằng kill + start.

## 4. Backup / restore (script `drill`)

| Mục | Kết quả |
|---|---|
| `backup.sh` | dump 401.537 byte (222 mục), ≈ 1 s; bảng đếm hàng cùng lúc |
| `restore-test.sh` | **PASS**, 10 s vào postgres tạm (không mạng, 256 MB): 8 bảng nội dung khớp từng hàng (questions 2.700, tests 316, test_items 4.590, topics 146, passages 50, sources 2, …), 0 dòng khác biệt ở bảng còn lại |
| Phủ định | dump bị cắt còn 200 KB ⇒ restore-test **FAIL** + cảnh báo; r2.env trỏ tới endpoint chết (nhánh container Node, không có node trên máy) ⇒ `backup_offsite_failed`, `backup.sh` thoát 1, ghi `last-failure` |
| Watchdog | 9/9 OK khi lành mạnh; "no local backup", "restore drill never succeeded" khi thiếu; cảnh báo chỉ gửi khi tập lỗi đổi hoặc sau 6 giờ |
| Uploader R2 (không có tài khoản thật) | test tự động: vector SigV4 của AWS (2) khớp từng bit; S3 giả: tải lên → HEAD → verify vòng đi-về → age-check → giải mã bằng khoá `openssl` thật khớp từng bit; cắt/sai bit/sai khoá bị từ chối. **Chưa thử với R2 thật** (cần chủ tạo bucket) |

## 5. Kiểm tra tĩnh
`npm run check`-tương đương: eslint 0 lỗi, prettier sạch, `tsc` 0 lỗi, `ops:test` 15/15, `@bj/edge` 35/35; `npm audit --audit-level=high`: 0; gitleaks: no leaks. Pen-test: [pentest-asvs-l1.md](pentest-asvs-l1.md).
