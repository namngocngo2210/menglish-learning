# Runbook vận hành BeeJunior (S-F)

Dành cho chủ/ops. Mọi lệnh chạm máy chủ cần chủ duyệt từng bước theo [deploy-plan-s-f.md](deploy-plan-s-f.md); agent không tự deploy. Kiến trúc: [backend-blueprint.md](backend-blueprint.md) §6. Sao lưu ngoài máy: [backup-offsite-r2.md](backup-offsite-r2.md).

Tên dùng chung (compose project `beejunior`): container `beejunior-{postgres,api,web,worker}-1`, volume `beejunior_bj-pgdata`, secret `~/beejunior-secrets/`, cấu hình R2 `~/beejunior-offsite/`, backup `~/backups/beejunior/`.

```bash
cd ~/menglish-learning            # bản checkout ở đúng commit/tag cần chạy
export SECRETS_DIR=$HOME/beejunior-secrets TAG=<git-sha>
dc() { docker compose -p beejunior -f deploy/compose.yml "$@"; }
```

## 1. Deploy lần đầu (một lần)

1. `bash deploy/gen-secrets.sh` (chủ tự chạy; không in giá trị). Điền `~/beejunior-offsite/r2.env` khi sẵn sàng sao lưu ngoài máy (backup-offsite-r2.md §6).
2. Dựng image: `heavy -m 2500M -- dc build` (web ≈ 1,8 GB RAM khi build; chỉ một việc nặng một lúc).
3. `dc up -d postgres` → `dc run --rm migrate` → `dc run --rm db-init` → `dc run --rm import` (nạp dữ liệu hạt giống, chỉ lần đầu) → `dc up -d api web worker`.
4. Tạo admin: `dc run --rm -it api node dist/main.mjs admin:create <email>` (dùng image `api`, kết nối bằng role superuser qua `db_url_superuser`: nếu lệnh báo thiếu `DATABASE_URL`, thêm `-e DATABASE_URL_FILE=/run/secrets/db_url_superuser`); mật khẩu gõ tại TTY.
5. Kiểm: `bash deploy/ops/watchdog.sh` toàn OK trừ các dòng backup (chưa có bản). Chạy `bash deploy/ops/backup.sh` và `bash deploy/ops/restore-test.sh` một lần. Cài cron từ `deploy/ops/crontab.example`.
6. Cắt traffic bằng Caddy (deploy-plan-s-f.md, bước Caddy). Chỉ sau khi 1–5 xanh.

## 2. Deploy bản mới (không gián đoạn)

Thứ tự bắt buộc; dừng ở bước nào đỏ thì rollback (mục 3).

1. `bash deploy/ops/backup.sh` (có bản mới ngay trước khi đổi). Ghi lại tag đang chạy: `docker inspect -f '{{.Config.Image}}' beejunior-api-1 beejunior-web-1`.
2. `export TAG=<sha mới>; heavy -m 2500M -- dc build`.
3. **Migration trước, tương thích ngược** (mục 4): `dc run --rm migrate`. Bản api/web cũ vẫn chạy được với schema mới.
4. `api` và `worker`: `dc up -d --no-deps api worker` (recreate; api khởi động lại trong vài giây, web không phụ thuộc api). Chờ `docker inspect -f '{{.State.Health.Status}}' beejunior-api-1` = healthy.
5. `web`: `dc up -d --no-deps web`. Trong lúc đổi, Caddy nhận vài giây 502; chấp nhận được khi trang chủ có cache ở Cloudflare/trình duyệt — hiện chưa có CF (D12), nên làm vào giờ thấp điểm. Bộ đệm tự làm ấm từ sitemap sau khi khởi động.
6. Kiểm: `bash deploy/ops/watchdog.sh`; mở `/`, một đề thi, `/admin`; `curl -sI https://beejunior.meducation.vn/ | grep -i x-cache`.

## 3. Rollback

- **Code:** đặt lại `TAG=<sha cũ>` rồi `dc up -d --no-deps api worker web`. Migration của bản hiện tại luôn tương thích bản trước (expand/contract) nên không cần đảo schema.
- **Caddy:** khôi phục tệp cấu hình đã lưu trước khi sửa (`caddy validate` rồi reload); route về container `menglish-learning` cũ nếu còn chạy.
- **Dữ liệu hỏng (hiếm):** khôi phục từ backup, mục 5.3. Mất tối đa 24 giờ (RPO). Cần chủ duyệt.

## 4. Migration không downtime

Quy tắc (blueprint §6.6): **expand → backfill → contract** qua ba bản phát hành, migration phá vỡ không bao giờ đi cùng bản code đầu tiên cần nó.

1. Release N: thêm cột/bảng nullable hoặc có default, code ghi cả hai chỗ. Migration có `down` và test up→down→up (`scripts/check-migrations.mjs`).
2. Release N+1: chuyển đọc sang cột mới; backfill nhỏ theo lô nếu cần.
3. Release N+2: xoá cột cũ.
Trước migration lớn: `deploy/ops/backup.sh`. Không `ALTER TABLE` kéo dài khoá bảng lớn giờ cao điểm (bảng hiện cỡ nghìn dòng, vài mili-giây). Đảo ngược: `dc run --rm migrate node dist/main.mjs migrate --down --count 1` chỉ khi bản trước không dùng schema mới.

## 5. Sao lưu và khôi phục

### 5.1 Lịch (cron, `deploy/ops/crontab.example`)
03:30 hằng ngày `backup.sh` (dump → kiểm → bảng đếm → giữ 14 ngày/8 tuần/6 tháng → mã hoá và tải lên R2 nếu đã cấu hình); Chủ nhật 04:30 `restore-test.sh` (khôi phục vào container tạm không mạng, so số bản ghi với lúc dump, ghi `~/backups/beejunior/restore-reports/`); mỗi 5 phút `watchdog.sh`. Đặt `BJ_ALERT_CMD` (lệnh đọc thông điệp từ stdin) để nhận cảnh báo; không đặt = chỉ ghi log.

### 5.2 Kiểm tra hằng tháng (chủ)
Diễn tập khôi phục từ bản R2 bằng khoá riêng: backup-offsite-r2.md §3. Ghi ngày vào nhật ký.

### 5.3 Khôi phục thật (thảm hoạ)
1. Dừng ghi: `dc stop api worker web`.
2. Giữ bản hỏng: `docker run --rm -v beejunior_bj-pgdata:/d -v $HOME/backups/beejunior:/b alpine tar czf /b/pgdata-broken.tgz -C /d .` (nếu còn đọc được).
3. Tạo DB trống: `dc down` rồi xoá volume (**cần chủ duyệt đúng lệnh**: `docker volume rm beejunior_bj-pgdata`), `dc up -d postgres`.
4. Role nhóm cần có trước khi nạp: `dc run --rm migrate` (tạo schema và role nhóm), sau đó `docker exec -i beejunior-postgres-1 psql -U postgres -c 'DROP DATABASE beejunior' -c 'CREATE DATABASE beejunior'` và `docker exec -i beejunior-postgres-1 pg_restore -U postgres -d beejunior --no-owner < ~/backups/beejunior/daily/<tệp>.dump`; hoặc giải mã bản R2 trước (backup-offsite-r2.md §3).
5. `dc run --rm db-init` (đặt lại mật khẩu role đăng nhập), `dc up -d api worker web`, kiểm mục 2.6.
6. Đối chiếu `<tệp>.dump.counts` với `select count(*)` các bảng nội dung.

## 6. Sự cố

| Triệu chứng | Kiểm | Xử lý |
|---|---|---|
| Watchdog: `<svc> container unhealthy/missing` | `docker logs --tail 50 beejunior-<svc>-1` | `dc up -d <svc>`; nếu lặp lại, xem OOM: `docker inspect -f '{{.State.OOMKilled}}' …` |
| Site 503 "bảo trì" | `docker exec beejunior-web-1 wget -qO- http://127.0.0.1:3100/readyz`; postgres healthy? | Postgres chết ⇒ `dc up -d postgres`; trang đã có cache vẫn phục vụ (stale-on-error), web tự hồi phục khi DB lại sẵn sàng, **không cần khởi động lại web** (đã đo: chaos) |
| `/admin` không vào được, API 5xx | `/readyz` của api | api tự khởi động lại (restart policy); đo: 6 s sau crash |
| Admin bị khoá (nhập sai) | log đăng nhập (không chứa mật khẩu) | chờ hết hạn khoá; quên mật khẩu/TOTP: `admin:create`/mã khôi phục (docs/admin-auth.md) |
| Backup không mới (`local backup … old`) | `tail ~/backups/beejunior/backup.log`, `last-failure` | chạy tay `deploy/ops/backup.sh`; xem đĩa (`df -h ~`) |
| `off-host copy … old` | `node scripts/ops/offsite.mjs --env-file ~/beejunior-offsite/r2.env age-check` | 403 ⇒ token hết hạn/đổi; mạng ⇒ chạy lại; xem R2 dashboard |
| Restore-test FAIL | `~/backups/beejunior/restore-reports/*.txt` | KHÔNG bỏ qua: backup có thể hỏng; chạy lại với bản khác, báo dev |
| Nghi lộ secret | — | tạo lại tệp tương ứng (xoá tệp rồi `gen-secrets.sh` — chỉ tệp thiếu được tạo), đổi mật khẩu role: `dc run --rm db-init`, `dc up -d --force-recreate api web worker`; xoay `session_hmac_key` làm mọi phiên admin hết hạn; token R2: roll trong dashboard |
| Bị tấn công/giả mạo nội dung | bảng `audit_log`, `question_revisions` | dừng `worker`; khôi phục bản trước của nội dung qua admin (revision) hoặc backup |
| Đĩa đầy | `df -h`, `docker system df` | dọn log/bản backup cũ ngoài chính sách chỉ khi chủ duyệt |

## 7. Giới hạn tài nguyên (D8) và số đo

Giới hạn trong `deploy/compose.yml`: web 384 MB/1 CPU, api 160 MB/0,5, postgres 256 MB/0,5, worker 320 MB/0,5 (+192 MB khi mở Rooms); `memswap_limit = mem_limit`, `pids_limit`, `read_only`, `cap_drop: ALL`. Số đo thật toàn stack: [ops-measurements-s-f.md](ops-measurements-s-f.md).

## 8. Quan sát

Log JSON một dòng/sự kiện (pino; không PII, đã redact), xoay `json-file 10m×3`. `GET /healthz` (sống) và `/readyz` (sẵn sàng, phụ thuộc DB) trên api:8080 và web:3100 (không route ra Caddy). Watchdog là điểm báo động duy nhất; chưa có Prometheus (chưa cần ở quy mô này, thêm bằng ADR nếu cần).

## 9. Bật đăng nhập Google (tài khoản phụ huynh) — mặc định TẮT

**Trạng thái:** mã đã có (PR #38) nhưng tính năng giữ **TẮT** (`ACCOUNTS_ENABLED` không đặt/`false` ⇒ route tài khoản và Google trả 404) cho đến khi **chủ** cung cấp client ID/secret. Mục 5 trong [user-accounts.md](user-accounts.md) (tạo project, màn hình đồng ý, brand verification) là **việc của chủ**, dev/ops không làm thay. Tài liệu này chỉ ghi **tên** biến; không ghi giá trị nào ở repo, chat, card hay log.

### 9.1 Tạo OAuth client (chủ, Google Cloud Console)
1. Project `beejunior-prod` (staging dùng project riêng) → *Google Auth Platform → Clients → Create client* → loại **Web application**.
2. Authorized JavaScript origin: `https://beejunior.meducation.vn`.
3. Authorized redirect URI, **khớp từng ký tự**: `https://beejunior.meducation.vn/api/v1/account/oauth/google/callback`.
4. Scope duy nhất: `openid email profile` (không thêm scope khác; app chỉ lưu `sub` + email).
5. Tải client ID/secret và đặt vào tệp env/secret trên host (9.2) bằng tay, không dán vào chat/card.

### 9.2 Biến môi trường (tên; mẫu ở `deploy/example.env`)
Đặt trong tệp env quyền **600** của host (kiểm `stat -c %a <tệp>` = 600) hoặc dùng `*_FILE` trỏ tới Docker secret, rồi truyền vào dịch vụ `api`. Hiện `deploy/compose.yml` chưa chuyển các biến `ACCOUNTS_*`/`GOOGLE_*` vào `api`; đó là một thay đổi compose riêng cần làm trước khi bật.

| Biến | Ghi chú |
|---|---|
| `ACCOUNTS_ENABLED` | `true` để bật; thiếu/`false` = tắt |
| `ACCOUNTS_ORIGIN` | `https://beejunior.meducation.vn` |
| `USER_SESSION_HMAC_KEY` hoặc `_FILE` | ≥32 ký tự, **khác** `SESSION_HMAC_KEY` của admin |
| `GOOGLE_CLIENT_ID` | từ Console |
| `GOOGLE_CLIENT_SECRET` hoặc `GOOGLE_CLIENT_SECRET_FILE` | từ Console; ưu tiên `_FILE` |
| `GOOGLE_REDIRECT_URI` | đúng `ACCOUNTS_ORIGIN` + `/api/v1/account/oauth/google/callback` |

Đặt đủ cả ba biến `GOOGLE_*` hoặc không đặt biến nào; thiếu một biến, api **không khởi động** (lỗi `Missing environment` nêu tên biến, không in giá trị). `GOOGLE_AUTH_URL/TOKEN_URL/JWKS_URL/ISSUER` chỉ dùng cho test, không đặt ở prod.

### 9.3 Bật
1. Chỉ khi Chính sách/Điều khoản mới đã lên và chủ đã duyệt; làm ngoài giờ học.
2. `dc up -d --force-recreate api` (không build lại web nếu không đổi mã).
3. Kiểm `dc logs --tail 30 api`: không có `Missing environment`; `GET /readyz` OK.

### 9.4 Smoke test
1. `curl -sI` tới `/api/v1/account/oauth/google/start?policyVersion=<ver>&textHash=<hash>` ⇒ `302`, `Location` bắt đầu bằng `https://accounts.google.com/` và chứa `code_challenge_method=S256`, `scope=openid+email+profile`, `redirect_uri` đúng mục 9.1; có `Set-Cookie: __Host-bj_oauth` (HttpOnly; Secure).
2. Trình duyệt, tài khoản Google thử (nếu app còn *Testing*, dùng tài khoản trong danh sách thử): `start` ⇒ Google ⇒ callback ⇒ `/tai-khoan`. Lỗi ⇒ `/dang-nhap?loi=google_*`.
3. Email trùng một tài khoản mật khẩu đã có ⇒ `loi=google_email_exists` (đúng thiết kế, không tự gộp).
4. Luyện tập ẩn danh (`/lop-6/...`) vẫn chạy bình thường.
5. Log api không chứa `code`, `id_token`, secret.

### 9.5 Rollback
Đặt `ACCOUNTS_ENABLED=false` (hoặc xóa dòng) trong tệp env ⇒ `dc up -d --force-recreate api`. Route tài khoản/Google về 404; dữ liệu đã tạo giữ nguyên (migration chỉ thêm bảng). Chỉ tắt Google, giữ email+mật khẩu: bỏ cả ba biến `GOOGLE_*`. Nghi lộ secret: thu hồi/tạo lại secret trong Console, cập nhật tệp, tạo lại `api`.
