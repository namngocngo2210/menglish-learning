# KẾ HOẠCH DEPLOY S-F (cần chủ duyệt từng bước)

Đây là danh sách **mọi thao tác chạm máy chủ**; agent không làm bước nào. Mỗi bước: lệnh chính xác, kiểm tra, và cách quay lại. Ý nghĩa nền: blueprint §6.6–6.7, quyết định D6–D10 (đã duyệt "theo khuyến nghị"), [runbook.md](runbook.md). Số liệu: [ops-measurements-s-f.md](ops-measurements-s-f.md).

## BƯỚC CỦA CHỦ (OWNER STEPS) — làm trước, theo thứ tự

Agent không bao giờ đọc bí mật, không chạy `admin:create`, không giữ khoá mã hoá. Bốn việc dưới đây chỉ chủ làm, trên máy chủ hoặc Cloudflare:

1. **Sinh bí mật DB/phiên, một lần** (không in giá trị, không ghi đè tệp đã có):
   ```bash
   cd ~/menglish-learning && bash deploy/gen-secrets.sh
   ```
   Kết quả: `~/beejunior-secrets/` (700, tệp 600) và mẫu `~/beejunior-offsite/r2.env.template`.
2. **Tạo tài khoản admin trên TTY của chủ** (sau H6; mật khẩu gõ tay, không echo, không qua agent/argv/env/tệp):
   ```bash
   dc run --rm -it api node dist/main.mjs admin:create <email>
   ```
3. **Cloudflare R2:** tạo bucket `beejunior-backups`, token **chỉ giới hạn trong bucket đó** (Object Read & Write), đặt lifecycle rules (và bucket lock) theo [backup-offsite-r2.md](backup-offsite-r2.md) §6; sau đó điền tệp env quyền 600:
   ```bash
   cp ~/beejunior-offsite/r2.env.template ~/beejunior-offsite/r2.env && chmod 600 ~/beejunior-offsite/r2.env && $EDITOR ~/beejunior-offsite/r2.env
   ```
4. **Khoá riêng mã hoá backup:** tạo offline (backup-offsite-r2.md §3), giữ **ngoài máy chủ** ở ≥ 2 nơi; không bao giờ đặt lên máy chủ hay đưa cho agent. Mất khoá riêng = không giải mã được bản ngoài máy.

**`BJ_ALERT_CMD` chưa được đặt** trong `deploy/ops/crontab.example` (chỉ có chú thích). Hệ quả: `watchdog.sh` vẫn in `FAIL` vào `watchdog.log` nhưng **không gửi cảnh báo nào** (cảnh báo tắt) cho tới khi chủ đặt `BJ_ALERT_CMD=<lệnh đọc nội dung từ stdin, vd. script gửi Telegram>` ở đầu crontab (H10). Trước đó chủ phải tự xem `watchdog.log`.

**Điều kiện trước (không chạm máy chủ):** PR S-A…S-F đã merge vào `main`; chủ đã duyệt PR này. `main` hiện có lỗi dựng image `api` (argon2 native) — sửa nằm trong PR này, nên **không deploy trước khi PR này merge**.

**Biến dùng chung** (mọi bước chạy trong `~/menglish-learning` ở đúng commit đã merge):
```bash
git fetch && git checkout <sha-main-sau-merge>
export SECRETS_DIR=$HOME/beejunior-secrets TAG=$(git rev-parse --short HEAD)
dc() { docker compose -p beejunior -f deploy/compose.yml "$@"; }
```

| # | Thao tác trên máy chủ | Lệnh | Hoàn tác |
|---|---|---|---|
| H1 | Secret DB/phiên (chủ chạy, không in giá trị) | `bash deploy/gen-secrets.sh` ⇒ `~/beejunior-secrets/` (700; tệp 600) và mẫu `~/beejunior-offsite/r2.env.template` | `rm -r ~/beejunior-secrets ~/beejunior-offsite` (chưa có dữ liệu nào phụ thuộc) |
| H2 | Thư mục backup | `mkdir -p ~/backups/beejunior && chmod 700 ~/backups/beejunior` | `rmdir` (rỗng) |
| H3 | Dựng 2 image (tạm ≈ 1,8 GB RAM, ≈ 570 MB đĩa) | `heavy -m 2500M -- dc build` | `docker rmi beejunior-api:$TAG beejunior-web:$TAG` |
| H4 | Container + volume + mạng mới | `dc up -d postgres` ⇒ tạo volume `beejunior_bj-pgdata`, mạng `beejunior_bj-internal`, `beejunior_bj-egress`; **dùng** mạng có sẵn `menglish-proxy` (không đổi) | `dc down` (giữ volume) / `dc down -v` (xoá cả DB — chỉ khi chủ duyệt đúng lệnh này) |
| H5 | Schema + vai trò + dữ liệu hạt giống | `dc run --rm migrate && dc run --rm db-init && dc run --rm import` | `dc down -v` rồi làm lại H4–H5 (DB chưa nhận lưu lượng thật) |
| H6 | Khởi động dịch vụ (tổng trần RAM 1.120 MB, CPU trần 2,5) | `dc up -d api web worker` | `dc stop api web worker` |
| H7 | Tài khoản admin đầu tiên (chính chủ gõ mật khẩu) | `dc run --rm -it api node dist/main.mjs admin:create <email>` | xoá hàng trong `admin_users` bằng psql (chủ duyệt) |
| H8 | **Kiểm song song, chưa đổi Caddy** | xem mục A | không có gì để hoàn tác |
| H9 | **Sửa Caddy dùng chung** (D10) | xem mục B; dùng `deploy/ops/caddy-apply.sh` (validate → backup → reload → thăm dò → **tự quay lại**) | script tự khôi phục; thủ công: chép `Caddyfile.bak-*` đè lên rồi `docker exec menglish-proxy-caddy-1 caddy reload …` |
| H10 | Cron backup / restore-test / watchdog | `crontab -e` rồi dán 3 dòng từ `deploy/ops/crontab.example` | xoá 3 dòng |
| H11 | Sao lưu ngoài máy R2 | chủ làm theo [backup-offsite-r2.md](backup-offsite-r2.md) §6 (bucket, token, lifecycle, bucket lock, khoá mã hoá), rồi điền `~/beejunior-offsite/r2.env` | xoá `r2.env` ⇒ backup chỉ còn tại chỗ (watchdog báo nếu thiếu bản ngoài) |
| H12 | Dừng container cũ `menglish-learning` | **bước riêng, sau ≥ 7 ngày ổn định**: `docker stop menglish-learning` | `docker start menglish-learning` + Caddy quay lại |

**Cổng S-B bắt buộc trước khi đổi Caddy (H9)** — thiếu một cổng thì không đổi:
- [ ] Warmer đã chạy xong.
- [ ] URL trong sitemap đạt tỉ lệ cache **HIT ≥ 99%** (đọc `cf-cache-status` / `X-Cache` của edge).
- [ ] Chỉ **soft purge** (không hard purge) trong suốt quá trình chuyển.
- [ ] Container tĩnh `menglish-learning` **vẫn chạy** để quay lại (giữ nguyên tới H12).

## A. Kiểm song song trước khi đổi Caddy (H8)

Không route công khai. Từ máy chủ, dùng mạng `menglish-proxy` để gọi trực tiếp (alias `bj-web`, `bj-api` là duy nhất, tránh trùng `web`/`api` của dịch vụ khác):
```bash
P='docker run --rm --network menglish-proxy --memory 64m curlimages/curl -sS'   # hoặc image curl/node có sẵn
$P -o /dev/null -w '%{http_code}\n' http://bj-web:3100/readyz            # 200
$P -o /dev/null -w '%{http_code}\n' http://bj-api:8080/readyz            # 200
$P http://bj-api:8080/api/v1/public/grades | head -c 200
bash deploy/ops/watchdog.sh                                              # toàn OK (trừ backup/restore chưa có bản)
bash deploy/ops/backup.sh && bash deploy/ops/restore-test.sh             # PASS
node scripts/ssr/parity.mjs …                                            # HTML SSR so với bản static hiện tại: 0 chênh (xem docs/backend-s-b.md)
```
Cần cùng lúc cả container cũ (512 MB) và mới (≤ 1.120 MB): `free -m` còn ≥ 1,4 GB `available` theo đo ở blueprint §6.4; nếu < 1 GB thì dừng, không tiếp tục.

## B. Khối Caddy (H9)

Khối cho tên miền đang phục vụ site (`beejunior.meducation.vn`; nếu vẫn dùng `beta.meducation.vn` thì cùng khối). Giữ nguyên `tls`/log hiện có; chỉ thay các `handle`:
```
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
    @internal path /api/v1/internal/* /_purge /healthz /readyz
    handle @internal { respond 404 }
    @admin path /admin /admin/* /api/v1/admin/*
    handle @admin {
        header Cache-Control "no-store"
        header X-Robots-Tag "noindex"
        reverse_proxy bj-api:8080
    }
    handle /api/* { reverse_proxy bj-api:8080 }
    handle { reverse_proxy bj-web:3100 }
```
(`/api/v1/public/*` đã tự đặt `Cache-Control` từ api; web edge tự đặt `Cache-Control`, `ETag`, `X-Frame-Options`, `nosniff`, `frame-ancestors`.)

Các bước (chủ/ops, sau khi H8 đạt):
```bash
docker inspect -f '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' menglish-proxy-caddy-1   # tìm Caddyfile thật (chỉ đọc)
cp <Caddyfile> /tmp/Caddyfile.candidate && $EDITOR /tmp/Caddyfile.candidate                                  # sửa khối trên
bash deploy/ops/caddy-apply.sh <Caddyfile> /tmp/Caddyfile.candidate \
  https://beejunior.meducation.vn/ https://beejunior.meducation.vn/api/v1/public/grades https://beejunior.meducation.vn/lop-6
```
Thất bại ở bất kỳ thăm dò nào ⇒ script tự trả cấu hình cũ và `reload` lại. Sau đó kiểm tay: `/admin` mở được; `/_purge` và `/api/v1/internal/snapshot` trả 404 từ ngoài; trang đề thi có `X-Cache: HIT` sau lần 2.

**`TRUST_PROXY` (bắt buộc cùng lúc):** nếu không, mọi người dùng chung một bộ đếm giới hạn tốc độ (120 req/phút theo IP = IP của Caddy). Đặt trong `deploy/.env` (cạnh compose; không chứa bí mật): `TRUST_PROXY=172.18.0.0/16` (mạng `menglish-proxy` hiện là `172.18.0.0/16`: kiểm lại bằng `docker network inspect menglish-proxy -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}'`) và `ADMIN_ORIGIN=https://beejunior.meducation.vn`, rồi `dc up -d api`.

## C. Thứ tự và cửa ngắt

1. H1–H7 và H8 không ảnh hưởng người dùng hiện tại. **Dừng nếu** `watchdog` đỏ, `restore-test` FAIL, RAM `available` < 1 GB, hoặc parity ≠ 0.
2. H9 là bước duy nhất đổi lưu lượng; chọn giờ thấp điểm; thời gian gián đoạn mong đợi 0 (reload Caddy không rớt kết nối), cửa sổ lỗi tối đa bằng thời gian thăm dò (≈ 15 s) trước khi tự quay lại.
3. Sau H9: 24 giờ theo dõi `watchdog.log`, `docker stats`, Search Console (độ phủ không đổi). Rollback toàn bộ = Caddy về khối cũ (container `menglish-learning` vẫn chạy cho tới H12).
4. H10 ngay sau H9 (để có backup đầu tiên trong đêm); H11 trong tuần đầu — **không bắt buộc cho H9**, nhưng cho tới khi có bản ngoài máy, mất máy = mất dữ liệu quản trị (nội dung gốc vẫn trong git).

## D. Việc chủ phải tự làm ngoài máy chủ
Tài khoản Cloudflare R2 (bucket `beejunior-backups`, token Object R/W, lifecycle, bucket lock) và cặp khoá mã hoá tạo **offline** (backup-offsite-r2.md §3, §6). Giữ khoá riêng ≥ 2 nơi; mất khoá riêng = không giải mã được bản ngoài máy.
