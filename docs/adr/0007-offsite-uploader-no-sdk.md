# ADR 0007: Uploader R2 tự viết bằng SigV4 (không `@aws-sdk`), api giữ argon2 làm native external

- Trạng thái: **được chấp nhận** (dev, S-F; chủ duyệt qua PR). Điều chỉnh phần "dependency" của [ADR 0003](0003-offsite-backup-r2.md).
- Ngày: 2026-11-01
- Liên quan: [backup-offsite-r2.md](../backup-offsite-r2.md), standards §10 (dependency)

## Bối cảnh

ADR 0003 cho phép `@aws-sdk/client-s3` cho script sao lưu. Thực tế script chỉ cần 4 thao tác trên một bucket (PUT, HEAD, GET, ListObjectsV2), chạy hằng đêm trên máy dùng chung có RAM hạn chế, trong một container `node:22-alpine` dùng một lần, không có `node_modules`.

## Quyết định

1. Viết client S3 tối thiểu (`scripts/ops/s3.mjs`, ≈100 dòng, chỉ `node:crypto` + `node:http(s)`) ký **SigV4**, kiểm bằng **hai vector kiểm thử đã công bố của AWS** (khớp chữ ký từng bit) cộng một S3 giả trong bộ test. Không thêm dependency nào vào repo; không tăng bề mặt `npm audit`; không cần `npm ci` trên máy chủ.
2. Phong bì mã hoá giữ nguyên thiết kế của ADR 0003 (X25519 + HKDF + AES-256-GCM theo khối, `node:crypto`).
3. Ngoài phạm vi: multipart upload (một lần PUT tới 5 GB; DB hiện cỡ vài MB–vài chục MB), retry nhiều tầng (cron chạy lại hằng đêm + watchdog báo động).
4. Cùng PR sửa lỗi dựng image `api` đã có trên `main` từ S-C: `@node-rs/argon2` là addon native (`.node`) nên esbuild không đóng gói được. Giữ `--external:@node-rs/argon2` và chép gói `@node-rs/*` (không có dependency con) từ stage `deps` vào image chạy. Cùng lỗi loại này từ S-E: `.dockerignore` còn dòng `admin` nên `COPY admin` trong Dockerfile api thất bại; đã xoá dòng đó. Đã kiểm sau khi rebase lên `main` có S-E: image dựng được, `hash/verify` argon2id chạy, `/app/admin/index.html` có trong image.
5. `scripts/ops/*.mjs` bị loại khỏi `checkJs` của `tsconfig.json` (như `scripts/ssr`, tiền lệ có sẵn): script vận hành ngắn, kiểm bằng test hành vi (vector AWS, S3 giả, openssl thật) thay vì ≈125 chú thích JSDoc. Lint và prettier vẫn áp dụng. Nâng lên TS khi script lớn thêm.

## Hệ quả

- Tự bảo trì ≈100 dòng ký yêu cầu; giảm rủi ro bằng vector AWS + test. Nếu cần multipart/IAM/STS thì chuyển sang SDK bằng một ADR mới.
- R2 chấp nhận `x-amz-content-sha256` là SHA-256 thật của thân (script luôn tính), `region=auto`, path-style.
- Đổi ý khi: cần tính năng S3 ngoài PUT/HEAD/GET/List, hoặc R2 đổi cách ký.
