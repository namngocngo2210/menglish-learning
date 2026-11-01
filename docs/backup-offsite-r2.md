# Sao lưu ngoài máy: Cloudflare R2 (D6, chủ quyết định 1/11)

Thiết kế cho S-F (biến môi trường giữ chỗ từ S-A/S-B). Đây là **thiết kế, chưa triển khai**: chưa có code, chưa tạo bucket, chưa đụng máy chủ. Quyết định: [ADR 0003](adr/0003-offsite-backup-r2.md). Backup tại chỗ (`pg_dump` 03:30, giữ 14 ngày + 8 tuần + 6 tháng) xem blueprint §3.2. **DB staging/prod của MEnglish không thuộc phạm vi.**

## 1. Nguyên tắc

| # | Quy tắc | Vì sao |
|---|---|---|
| 1 | Bucket **riêng tư, dành riêng** cho BeeJunior, ví dụ `beejunior-backups`; không dùng chung bucket của menglish-main; không public access, không CORS, không custom domain | xoá nhầm/lộ ở một bên không ảnh hưởng bên kia |
| 2 | Token R2 chỉ **Object Read & Write** trên đúng bucket đó | tối thiểu quyền; token không đổi được cấu hình bucket |
| 3 | **Mã hoá phía client trước khi tải lên**, khoá bất đối xứng: máy chủ chỉ giữ **khoá công khai**, khoá riêng nằm offline ở chủ | chiếm được máy chủ cũng không đọc được backup cũ |
| 4 | Kiểm chứng sau tải lên (kích thước + checksum) và **báo động** khi lỗi | backup im lặng hỏng là backup không có |
| 5 | Lưu giữ bằng lifecycle rule của R2 khớp 14 ngày / 8 tuần / 6 tháng | không cần tiến trình dọn dẹp thường trực |
| 6 | Script TS nhỏ dùng S3 client; **không** cài rclone/awscli trên máy chủ | apt chưa được duyệt; ít bề mặt |
| 7 | Giá trị bí mật chỉ do chủ đặt vào tệp env quyền 600 trên máy chủ; không vào repo, chat hay log | CLAUDE.md, standards §7 |

## 2. Biến môi trường (tên; `.env.example` chỉ liệt kê tên, không giá trị)

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=beejunior-backups
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
BACKUP_PUBLIC_KEY_FILE=/run/secrets/backup_public_key.pem   # chỉ KHOÁ CÔNG KHAI
```

`R2_SECRET_ACCESS_KEY` nạp qua `*_FILE` như các bí mật khác (blueprint §6.2). `zod` kiểm lúc khởi động; thiếu ⇒ thoát, không in giá trị. Agent không đọc tệp env thật.

## 3. Mã hoá phía client (không cần age/apt)

Chọn **phong bì X25519 + AES-256-GCM bằng `node:crypto`** (có sẵn trong Node 22, không dependency, không cần keyring trên máy chủ). Phương án thay thế: `gpg --encrypt -r <fingerprint>` (host có `/usr/bin/gpg`, chỉ import khoá công khai) — chấp nhận được, nhưng phải quản lý keyring và dễ cấu hình sai; chỉ dùng nếu chủ thích.

Quy trình mỗi bản backup (script `deploy/backup-offsite.ts`, chạy sau `pg_dump`):
1. Sinh khoá dữ liệu ngẫu nhiên 256-bit (DEK) và cặp X25519 **tạm thời**.
2. ECDH(khoá riêng tạm, khoá công khai của chủ) → HKDF-SHA256 → khoá bọc; bọc DEK bằng AES-256-GCM. Huỷ khoá riêng tạm ngay.
3. Mã hoá luồng dump bằng AES-256-GCM theo **khối 1 MiB**, nonce = bộ đếm khối (không bao giờ tái dùng), thẻ xác thực mỗi khối, khối cuối đánh dấu để chống cắt ngắn. Bộ nhớ không phụ thuộc cỡ tệp.
4. Tệp ra: `magic|version|khoá công khai tạm|DEK đã bọc|nonce gốc|khối…`. Tên đối tượng: `pg/YYYY/MM/DD/beejunior-YYYYMMDDTHHMMSSZ.dump.enc` (không lộ nội dung).

**Sinh khoá (chủ làm trên máy riêng, offline; không làm trên máy chủ):**
```bash
openssl genpkey -algorithm X25519 -out backup-private.pem
openssl pkey -in backup-private.pem -pubout -out backup-public.pem
```
Chủ cất `backup-private.pem` ở ≥ 2 nơi offline (vd. trình quản lý mật khẩu + USB); chép **chỉ** `backup-public.pem` lên máy chủ (quyền 600/644 đều được — công khai). Ghi lại vân tay: `openssl pkey -pubin -in backup-public.pem -outform DER | sha256sum`.

**Xoay khoá:** sinh cặp mới; đặt khoá công khai mới trên máy chủ; từ đó backup dùng khoá mới. Bản cũ vẫn cần khoá riêng cũ ⇒ **giữ khoá riêng cũ cho tới khi bản cũ nhất dùng nó hết hạn lưu giữ** (tối đa 6 tháng + 1 tuần). Tên đối tượng/header ghi vân tay khoá để biết dùng khoá nào. Xoay mỗi 12 tháng hoặc ngay khi nghi ngờ lộ khoá riêng.

**Diễn tập khôi phục (hằng tháng, và bắt buộc trước khi S-F kết thúc):** chủ tải đối tượng từ R2 về máy riêng → `bj-restore decrypt --key backup-private.pem` (lệnh CLI trong cùng package, chạy trên máy chủ) giải mã → `pg_restore` vào DB rỗng → đối chiếu số bản ghi bảng chính với bảng §3.6. Khoá riêng **không** được đưa lên máy chủ; nếu cần giải mã tại chỗ thì dùng máy chủ khác/tạm và xoá sau. Test tự động (vitest): mã hoá→giải mã khớp từng bit; sửa 1 bit ⇒ lỗi xác thực; cắt ngắn ⇒ lỗi; khoá sai ⇒ lỗi.

## 4. Tải lên và kiểm chứng

- `@aws-sdk/client-s3` (+ `@aws-sdk/lib-storage` cho multipart) cấu hình `endpoint=R2_ENDPOINT`, `region="auto"`, `forcePathStyle` theo tài liệu R2. Đây là dependency **nặng**: cần ADR (0003 đã nêu) và nằm trong package `worker`/`deploy`, không vào `api`.
- Sau tải: `HeadObject` so `ContentLength` với kích thước tệp mã hoá; tính SHA-256 của tệp mã hoá khi ghi, lưu vào **metadata đối tượng** (`x-amz-meta-sha256`) và vào bảng/ tệp nhật ký cục bộ; hằng tuần job `backup-verify` tải ngẫu nhiên 1 bản, băm lại, so khớp (vòng đi-về). Dùng checksum ở tầng ứng dụng như trên, không dựa vào checksum phía máy chủ R2 (mức hỗ trợ từng tiêu đề checksum của S3 API cần kiểm trước: https://developers.cloudflare.com/r2/api/s3/api/).
- **Báo động:** thất bại (mạng, 403, kích thước/băm lệch, quá 26 giờ chưa có bản mới) ⇒ thoát code ≠ 0, ghi log `event=backup_offsite_failed`, watchdog của ops (đã theo dõi "tuổi backup") báo Telegram. Không có thông báo = lỗi.

## 5. Lưu giữ và chống xoá bằng token bị đánh cắp

- **Lifecycle rule** (S3 API hoặc dashboard) theo tiền tố: `pg/daily/` xoá sau 14 ngày; `pg/weekly/` sau 56 ngày; `pg/monthly/` sau 183 ngày. Script ghi cùng một bản vào tiền tố đúng (hằng ngày; Chủ nhật → weekly; ngày 1 → monthly). R2 xoá "thường trong 24 giờ sau hạn" — chấp nhận. Quản lý lifecycle cần quyền cấp bucket (`Workers R2 Storage Write`), **không** nằm trong token Object R/W của script ⇒ đặt qua dashboard bởi chủ. Nguồn: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- **Bucket Locks** (https://developers.cloudflare.com/r2/buckets/bucket-locks/): theo tài liệu, rule khoá ngăn **xoá và ghi đè** đối tượng theo tiền tố trong thời hạn (hoặc vô hạn), đặt ở Settings → Bucket lock rules. Khuyến nghị: lock theo tuổi **14 ngày** trên cả ba tiền tố ⇒ kẻ có token Object R/W bị đánh cắp **không xoá/ghi đè được** bản mới trong 14 ngày; lifecycle chỉ xoá sau hạn lock. *Chưa kiểm chứng bằng thử nghiệm:* chủ chạy thử (ghi một đối tượng thử, thử `DeleteObject` bằng token script, kỳ vọng bị từ chối) trước khi tin; và quản lý lock cần quyền cấp bucket/tài khoản, vì vậy **bảo vệ token Cloudflare đó bằng 2FA và không đặt trên máy chủ**.
- **Versioning: không có.** Tài liệu tương thích S3 của R2 liệt kê `PutBucketVersioning` là chưa hỗ trợ (https://developers.cloudflare.com/r2/api/s3/api/) ⇒ không dựa vào versioning; bucket lock là biện pháp thay thế. Mỗi bản backup là một khoá đối tượng mới (không ghi đè) nên không cần versioning.

## 6. Runbook cho chủ (Cloudflare dashboard; làm theo thứ tự)

Theo thói quen ở `menglish-main/docs/chuyen-upload-sang-r2.md` (đã đọc, chỉ-đọc): bucket riêng mỗi môi trường, token Object R/W cho đúng bucket, bucket riêng tư.

1. **Tạo bucket:** R2 → *Create bucket* → tên `beejunior-backups` (không dùng lại bucket MEnglish). *Settings*: để **Public access = Disabled**; **không** thêm CORS, không gắn domain.
2. **Tạo token:** R2 → *Manage API tokens* → *Create API token* → quyền **Object Read & Write**, phạm vi **chỉ bucket `beejunior-backups`**, (tuỳ chọn) giới hạn IP của máy chủ. Ghi *Access Key ID*, *Secret Access Key* và endpoint `https://<account-id>.r2.cloudflarestorage.com`; Secret chỉ hiện một lần.
3. **Đặt khoá trên máy chủ:** tạo tệp env quyền 600 (vd. `~/beejunior-secrets/r2.env`, cùng thư mục `gen-secrets.sh`) với 5 biến `R2_*` ở mục 2; không gõ qua chat, không commit, agent không đọc.
4. **Sinh cặp khoá mã hoá** trên máy riêng (mục 3); chép khoá công khai lên máy chủ; cất khoá riêng offline ≥ 2 nơi.
5. **Lifecycle:** bucket → *Settings → Object lifecycle rules → Add rule*: ba rule theo tiền tố `pg/daily/` (xoá sau 14 ngày), `pg/weekly/` (56 ngày), `pg/monthly/` (183 ngày) → *Save*.
6. **Bucket lock:** *Settings → Bucket lock rules → Add rule*: tiền tố `pg/`, thời hạn 14 ngày (dài hơn rule daily thì daily sẽ không xoá sớm hơn lock — chấp nhận) → *Save*. Thử xoá một đối tượng thử bằng token script để chắc lock hoạt động.
7. **Chạy thử:** chạy `backup-offsite` một lần, kiểm tệp `.enc` xuất hiện, `HeadObject` khớp; làm **diễn tập khôi phục** đầu tiên bằng khoá riêng của bạn.
8. **Báo động:** nhờ ops thêm kiểm tra "tuổi đối tượng mới nhất trong R2 < 26 giờ" vào watchdog.
9. **Định kỳ:** hằng tháng diễn tập khôi phục; hằng 12 tháng xoay khoá; khi nghi lộ token → *Roll* token trong dashboard và cập nhật tệp env.

## 7. Còn mở

- Chi phí/giới hạn dung lượng R2 gói hiện tại — chủ kiểm tra khi tạo bucket (không đo được từ đây).
- Chọn gpg hay phong bì Node: khuyến nghị Node (mục 3).
- Hạn lock 14 ngày vs. nhu cầu xoá sớm dữ liệu cá nhân theo yêu cầu (backup không chứa PII học sinh theo thiết kế; báo cáo có `client_hash` xoá sau 180 ngày thì bản backup giữ tối đa 6 tháng — ghi trong chính sách quyền riêng tư).
