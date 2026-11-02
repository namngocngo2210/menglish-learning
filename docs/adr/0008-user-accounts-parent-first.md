# ADR 0008: Tài khoản người dùng theo mô hình "phụ huynh + hồ sơ con", đăng nhập email+mật khẩu và Google

- Trạng thái: **đề xuất** (chờ chủ duyệt; pháp lý chờ luật sư)
- Ngày: 2026-11-02
- Người quyết định: owner (Babay1903)
- Liên quan: thẻ kanban t_02690829, [user-accounts.md](../user-accounts.md), [admin-auth.md](../admin-auth.md)

## Bối cảnh

Chủ muốn tài khoản (email+mật khẩu, Google; Facebook bị loại 2/11). Đối tượng là trẻ 6–15 tuổi. NĐ 13/2023 đã hết hiệu lực 01/01/2026, thay bằng Luật 91/2025/QH15 và NĐ 356/2025 (Điều 24 Luật nêu đồng ý của trẻ ≥7 tuổi + người đại diện khi công bố đời sống riêng tư; chưa thấy ngưỡng/cách xác minh tuổi cụ thể — cần luật sư). Google đặt tuổi tối thiểu **15 ở Việt Nam** ([nguồn](https://support.google.com/accounts/answer/1350409)), nên phần lớn học sinh không tự có Google Account.

## Quyết định

1. Chỉ **người lớn (phụ huynh/giám hộ, tự khai ≥18 + xác minh email)** đăng ký tài khoản, bằng email+mật khẩu (argon2id) hoặc Google (OIDC code + PKCE, scope `openid email profile`).
2. Trẻ chỉ tồn tại dưới dạng **hồ sơ con** (nickname + lớp, không email/họ tên/ngày sinh/ảnh) với đồng ý riêng của phụ huynh theo từng mục đích.
3. Luyện tập ẩn danh và Luyện tập nhóm giữ nguyên, không đăng nhập; `rooms/` không nhận danh tính tài khoản.
4. Tài khoản chạy trong `api` hiện có, bảng/cookie/route/secret **tách khỏi admin**, tái dùng nguyên thủy mật mã/phiên/CSRF/rate limit. Cờ `ACCOUNTS_ENABLED` mặc định tắt.
5. Không bật cho công chúng trước khi luật sư duyệt Chính sách và Google brand verification xong.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Học sinh tự đăng ký email | Dùng được ngay cho trẻ | Phải xác minh tuổi + đồng ý cha mẹ cho từng trẻ; rủi ro pháp lý cao |
| **B. Phụ huynh + hồ sơ con** | Đồng ý có sẵn; ít dữ liệu trẻ; hợp giới hạn Google 15+ | Thêm khái niệm hồ sơ; trẻ ≥16 chưa tự đăng ký |
| C. Chỉ Google | Không giữ mật khẩu | Loại gần hết đối tượng (<15) |
| D. Magic-link | Không mật khẩu | Cần email đáng tin; trẻ khó dùng; để sau |

## Hệ quả

- Tốt: bề mặt pháp lý nhỏ nhất, không thu dữ liệu định danh của trẻ, phù hợp ràng buộc Google.
- Xấu: phụ huynh phải làm thao tác; không xác minh được tuyệt đối người đăng ký là phụ huynh; thêm vận hành email và RAM argon2 (~+40–80 MB đỉnh [ước]).
- Phải làm tiếp: viết lại Chính sách/Điều khoản/`/xoa-du-lieu`; chủ làm Google Cloud (mục 5 tài liệu); luật sư; S-U1…S-U4.
- Hoàn tác: tắt cờ; xóa bảng bằng migration `down`.
- Đổi ý khi: luật sư kết luận phải xác minh mạnh hơn; muốn trẻ ≥16 tự đăng ký; cần MFA; quy mô đòi hỏi tách dịch vụ.
