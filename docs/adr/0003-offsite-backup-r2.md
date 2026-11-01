# ADR 0003: Sao lưu ngoài máy lên Cloudflare R2, mã hoá phía client

- Trạng thái: **được chấp nhận** cho đích lưu (chủ quyết định D6 ngày 2026-11-01: Cloudflare R2). Chi tiết thiết kế (phong bì Node, lifecycle, bucket lock) là **đề xuất** cho S-F, chủ duyệt khi triển khai.
- Ngày: 2026-11-01
- Người quyết định: owner (Babay1903)
- Liên quan: [backup-offsite-r2.md](../backup-offsite-r2.md), blueprint §3.2, ADR 0002 (D6)

## Bối cảnh

D6 cần bản sao ngoài máy chủ. Máy chủ dùng chung, không có `age`, apt chưa được duyệt. Backup không được đọc được nếu máy chủ bị chiếm.

## Quyết định

Tải lên **bucket R2 riêng tư dành riêng** `beejunior-backups` bằng S3 API từ script TypeScript (`@aws-sdk/client-s3` tối thiểu), token Object R/W chỉ cho bucket đó. **Mã hoá phía client** bằng phong bì X25519 + AES-256-GCM (`node:crypto`); máy chủ chỉ giữ khoá công khai, khoá riêng ở chủ (offline). Lưu giữ 14 ngày/8 tuần/6 tháng bằng lifecycle rule; bucket lock 14 ngày chống xoá bằng token bị đánh cắp (cần chủ thử xác nhận). Không rclone/awscli.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| **R2 + phong bì Node** | không cài thêm gói hệ thống; khoá riêng không rời chủ | tự viết định dạng mã hoá (giảm rủi ro bằng test + tài liệu) |
| R2 + gpg | công cụ chuẩn | quản lý keyring trên máy chủ, dễ cấu hình sai |
| Dùng chung bucket MEnglish | ít việc | lộ/xoá chéo; vi phạm quy ước riêng bucket |
| Chỉ backup tại chỗ | đơn giản | mất máy = mất hết |

## Hệ quả

- Thêm dependency `@aws-sdk/client-s3` (+ `lib-storage`) — chấp thuận bởi ADR này theo [standards §10](../engineering-standards.md); chỉ trong `worker`/`deploy`.
- Mất khoá riêng = mất khả năng khôi phục: chủ giữ ≥ 2 bản offline, diễn tập khôi phục hằng tháng.
- Versioning R2 không có (S3 `PutBucketVersioning` chưa hỗ trợ theo tài liệu R2); bucket lock thay thế.
- Đổi ý khi: chi phí R2 vượt kế hoạch, hoặc yêu cầu DR cần vùng/nhà cung cấp thứ hai.
