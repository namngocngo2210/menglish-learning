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

Giới hạn trong `deploy/compose.yml`: web 384 MB/1 CPU, api 192 MB/0,5 (160 trước khi có tài khoản; đỉnh đo 157 MB khi bị dội đăng nhập, pentest-asvs-l2-accounts.md), postgres 256 MB/0,5, worker 320 MB/0,5 (+192 MB khi mở Rooms); `memswap_limit = mem_limit`, `pids_limit`, `read_only`, `cap_drop: ALL`. Số đo thật toàn stack: [ops-measurements-s-f.md](ops-measurements-s-f.md).

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
Đặt trong tệp env quyền **600** của host (kiểm `stat -c %a <tệp>` = 600) hoặc dùng `*_FILE` trỏ tới Docker secret, rồi truyền vào dịch vụ `api`. `deploy/compose.yml` đã chuyển các biến này vào `api` (S-U4); thứ tự và việc của chủ: [deploy-plan-accounts.md](deploy-plan-accounts.md).

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

## 10. Tài khoản phụ huynh: vi phạm dữ liệu, sao lưu và xóa

Chỉ áp dụng khi `ACCOUNTS_ENABLED=true`. Dữ liệu có trong DB: email phụ huynh, băm argon2id (không phải mật khẩu), nickname + lớp của hồ sơ con, tiến độ, bằng chứng đồng ý, `sub` Google, băm HMAC của IP, `sha256` của token phiên (vô dụng nếu không có token thô). **Không** có họ tên, ngày sinh, SĐT, địa chỉ, ảnh.

### 10.1 Nghi ngờ lộ/đánh cắp dữ liệu (checklist, làm theo thứ tự)
Ghi giờ từng bước vào nhật ký sự cố (tệp riêng của chủ, không chứa dữ liệu cá nhân).
1. **Chặn:** đặt `ACCOUNTS_ENABLED=false`, `dc up -d --force-recreate api web` (route về 404, luyện tập ẩn danh vẫn chạy). Nếu nghi lộ mã/secret: dừng `api` (`dc stop api`) cho tới khi rõ.
2. **Giữ bằng chứng:** `docker logs` của `api`/`web` (đang xoay `10m×3`: sao chép ngay), bản backup gần nhất, `audit_log` các dòng `user.*` (`psql … -c "SELECT action, count(*), min(created_at), max(created_at) FROM audit_log WHERE entity_type='user' GROUP BY 1"`). DB chỉ đọc.
3. **Xác định phạm vi:** nguồn (SQL injection? secret lộ? backup lộ? tài khoản chủ bị chiếm?), khoảng thời gian, bảng bị chạm, số tài khoản/hồ sơ (`SELECT count(*) FROM users`, `profiles`). Backup lộ ⇒ phạm vi = dữ liệu tại ngày bản đó.
4. **Làm mất tác dụng thông tin đã lộ:** `UPDATE user_sessions SET revoked_at = now() WHERE revoked_at IS NULL` (đăng xuất tất cả). Nghi băm mật khẩu lộ ⇒ buộc đặt lại: `UPDATE users SET password_hash = NULL` chỉ khi chủ duyệt (người dùng Google không bị ảnh hưởng; người dùng email phải dùng "Quên mật khẩu"). Secret nghi lộ: thu hồi/tạo lại (Google client secret trong Console; `internal_token`, `session_hmac_key`, DB password theo `gen-secrets.sh` — xóa tệp rồi chạy lại). **Không xoay `user_session_hmac_key` tùy tiện:** nó tạo các mã giả danh dùng để xóa lại sau khôi phục (10.3) và để ký cookie OAuth; xoay thì giữ khóa cũ ở nơi an toàn cho `accounts:reapply-deletions`.
5. **Sửa nguyên nhân** trước khi bật lại; chạy lại `api/tests/pentest-accounts.test.ts`.
6. **Thông báo (thời hạn pháp định cần xác nhận với luật sư — NĐ 13/2023 Điều 23 từng quy định báo Bộ Công an trong 72 giờ; Luật 91/2025 và NĐ 356/2025 có thể đổi):** chủ quyết định, trong vòng 72 giờ kể từ khi biết, (a) báo cơ quan có thẩm quyền theo hướng dẫn của luật sư, (b) báo người dùng bị ảnh hưởng qua email (cần nhà gửi email, deploy-plan-accounts A). Nội dung tối thiểu: chuyện gì xảy ra và khi nào, dữ liệu nào bị ảnh hưởng, đã làm gì, người dùng nên làm gì (đặt lại mật khẩu, cẩn trọng thư giả mạo), kênh liên hệ. Không gửi qua kênh chưa xác thực.
7. **Sau sự cố:** ghi nguyên nhân gốc, thay đổi đã làm, thêm test; cập nhật tài liệu này; chủ quyết định bật lại.

### 10.2 Dọn dữ liệu quá hạn (tự động)
`accounts:purge-expired` (cron hằng ngày, dịch vụ `accounts-maint`): `login_attempts` > 30 ngày; token email đã dùng/hết hạn > 30 ngày; phiên đã thu hồi/hết hạn tuyệt đối > 30 ngày; `audit_log` `user.*` > 12 tháng. In ra số dòng đã xóa. **Chưa có:** xóa tài khoản nhàn rỗi 24 tháng + email nhắc (thẻ riêng, hạn chót trước 11/2028).

### 10.3 Sao lưu có chứa dữ liệu tài khoản — lưu giữ và xóa
- **Lưu giữ backup** (đã có): local hằng ngày 14 ngày, hằng tuần 8 tuần, hằng tháng 6 tháng; R2 cùng nấc (+ khóa 14 ngày). ⇒ dữ liệu đã xóa khỏi DB sống **vẫn còn trong backup tối đa 183 ngày** (bản tháng) rồi tự hết; không có thao tác xóa tay trong từng bản (bản mã hóa/bất biến). Chính sách quyền riêng tư phải nói đúng điều này (O2 trong deploy-plan-accounts).
- **Nguyên tắc:** bản backup chỉ dùng để khôi phục thảm họa; **không** truy vấn nó cho mục đích khác. Sau khôi phục, mọi xóa đã thực hiện phải được áp lại **trước khi mở lại** `api`.
- **Quy trình khôi phục + xóa lại** (cần chủ duyệt, thêm vào bước 5.3 phía trên):
  1. *Trước khi bỏ DB hỏng*, nếu còn đọc được, xuất bằng chứng xóa (không chứa dữ liệu cá nhân): `docker exec beejunior-postgres-1 psql -U postgres -d beejunior -At -c "SELECT coalesce(json_agg(json_build_object('userRef',user_ref,'scope',scope,'targetRef',target_ref)),'[]') FROM deletion_requests" > ~/deletions.json` (quyền 600).
  2. Khôi phục bản backup như mục 5.3 (api đang dừng: `dc stop api`).
  3. Nếu DB cũ đã mất: lấy `deletions.json` từ **bản backup mới nhất** (cùng truy vấn trên, chạy trong DB vừa khôi phục) — chỉ phủ các lần xóa tới ngày bản đó.
  4. `dc run --rm -v ~/deletions.json:/in.json:ro accounts-maint accounts:reapply-deletions --file /in.json` ⇒ in `{"users":N,"profiles":M}` (số tài khoản/hồ sơ được xóa lại). Cần `user_session_hmac_key` **đúng bản đã dùng** khi xóa.
  5. `dc up -d api`; kiểm đăng nhập một tài khoản thử còn tồn tại.
  6. **Khoảng hở còn lại:** yêu cầu xóa xảy ra sau backup cuối mà không xuất được `deletions.json` sẽ không tự áp lại. Chủ đối chiếu các yêu cầu xóa nhận qua kênh liên hệ kể từ giờ bản backup và xóa tay bằng `psql`; ghi vào nhật ký.
- **Kiểm định kỳ:** mỗi quý chạy diễn tập trên DB tạm: khôi phục một bản, áp `deletions.json` từ DB sống, kiểm số tài khoản đã xóa không còn (đã có test tự động `api/tests/accounts-maintenance.test.ts`).

## 11. Gửi email tạm bằng Gmail

**Trạng thái:** mã đã có (ADR [0009](adr/0009-smtp-mailer-nodemailer.md)); mặc định `MAIL_TRANSPORT=none` ⇒ không gửi thư nào. Đây là giải pháp **tạm** cho tài khoản phụ huynh (`ACCOUNTS_ENABLED`, mục 9). Không dán mật khẩu vào chat, card, repo hay log.

### 11.1 Chuẩn bị Gmail (chủ)
1. Tạo một Gmail **riêng** cho BeeJunior (không dùng Gmail cá nhân: người dùng sẽ thấy địa chỉ này ở ô *Từ*).
2. Bật **Xác minh 2 bước** cho tài khoản đó.
3. Vào myaccount.google.com/apppasswords, tạo *Mật khẩu ứng dụng* (tên "BeeJunior api"); Google hiện 16 ký tự chia nhóm, khoảng trắng được bỏ tự động.

### 11.2 Cấu hình trên host
1. `bash deploy/gen-secrets.sh` (bổ sung tệp `smtp_pass` rỗng, không ghi đè tệp có sẵn).
2. Dán mật khẩu ứng dụng vào `~/beejunior-secrets/smtp_pass` bằng trình soạn thảo, rồi `chmod 600 ~/beejunior-secrets/smtp_pass`.
3. Trong `deploy/.env` đặt (chỉ tên/địa chỉ, không có mật khẩu):
   `MAIL_TRANSPORT=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587` (hoặc `465`), `SMTP_USER=<gmail đó>`, `MAIL_FROM=BeeJunior <gmail đó>` (**phải trùng** địa chỉ Gmail, nếu không Google ghi đè), `MAIL_REPLY_TO` tùy chọn.
4. `dc up -d --force-recreate api` (api được nối `bj-egress` để ra Internet; xem ADR 0009 về đánh đổi).

### 11.3 Kiểm tra
`dc run --rm api node dist/main.mjs mail:test <email-của-bạn>` ⇒ in `ok` (thư tới hộp thư, kiểm cả mục Spam) hoặc `fail <mã>`: `EAUTH` sai tài khoản/mật khẩu ứng dụng, `ETIMEDOUT`/`ECONNECTION` không ra được mạng/cổng, `ESOCKET` lỗi TLS/chứng chỉ. Log api chỉ có `mail_sent`, `mail_retry`, `mail_send_failed` kèm mã lỗi, không có địa chỉ hay nội dung.

### 11.4 Giới hạn của Gmail
- ~500 người nhận/ngày (tài khoản thường); vượt hạn mức thì gửi lỗi tới hôm sau.
- Thư có thể vào Spam (không có SPF/DKIM của tên miền riêng).
- Ô *Từ* luôn là địa chỉ Gmail.
- Google có thể chặn truy cập tự động hoặc thu hồi mật khẩu ứng dụng (đổi mật khẩu Google cũng thu hồi); khi đó `mail:test` báo `EAUTH`.

### 11.5 Chuyển sang Resend/Brevo (không đổi mã)
Tạo tài khoản + xác minh tên miền (SPF/DKIM), lấy thông tin SMTP của nhà cung cấp; thay `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `MAIL_FROM` (địa chỉ trên tên miền đã xác minh) trong `deploy/.env`, ghi khóa SMTP vào `smtp_pass`, `dc up -d --force-recreate api`, chạy lại `mail:test`. Xóa mật khẩu ứng dụng Gmail trong tài khoản Google.

### 11.6 Rollback
Đặt `MAIL_TRANSPORT=none` (hoặc xóa dòng) ⇒ `dc up -d --force-recreate api`: không gửi thư. Nghi lộ mật khẩu: xóa mật khẩu ứng dụng trong Google, tạo lại, ghi đè `smtp_pass`.
