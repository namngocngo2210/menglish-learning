# ADR 0010: Đăng nhập bằng username, email tùy chọn, mã khôi phục

- Trạng thái: **đề xuất** (chờ chủ duyệt qua PR #41; **rủi ro pháp lý chưa được luật sư xác nhận**)
- Ngày: 2026-11-02
- Người quyết định: owner (Babay1903)
- Liên quan: thẻ t_50c89837 (backend), t_3ab33a21 (UI), t_28db1ef0 (tài liệu); [ADR 0008](0008-user-accounts-parent-first.md), [ADR 0009](0009-smtp-mailer-nodemailer.md), [user-accounts.md](../user-accounts.md) mục 13

## Bối cảnh

ADR 0008 chọn "phụ huynh tạo tài khoản bằng email + mật khẩu". Chủ muốn giảm ma sát: đăng ký bằng **username** không cần hộp thư, email là tùy chọn. Hai điều làm email kém quan trọng: nhà gửi email chưa có (pentest F1 chặn bật cờ), và nhiều gia đình không muốn đưa email.

## Quyết định

1. Danh tính đăng nhập là **username** (citext, 3–20 ký tự, có danh sách tên dành riêng và từ cấm); **không đăng nhập bằng email**.
2. **Email tùy chọn**, chỉ được lưu vào `users.email` sau khi xác minh (địa chỉ chưa xác minh chỉ nằm ở `user_tokens.email`). Có email đã xác minh ⇒ có thêm đường đặt lại qua link.
3. **Mã khôi phục**: 10 mã dùng một lần, sinh lúc đăng ký (hiện một lần), chỉ lưu sha256, tạo lại được khi đã đăng nhập. Là đường lấy lại tài khoản khi không có email. **Không có câu hỏi bảo mật.**
4. Chống bot: đăng ký 3/giờ/IP + cooldown 60 giây; đăng nhập/khôi phục giới hạn theo username và theo IP; hook Cloudflare Turnstile (mặc định tắt).
5. Google: username sinh tự động, đổi được một lần; không tự gộp tài khoản theo email.
6. Migration `0039` kiểu expand/contract; `down` từ chối khi còn tài khoản không có email.

## Đánh đổi và rủi ro

**R1 — Pháp lý (CAO, chưa giải quyết): cần xác nhận với luật sư.** ADR 0008 dựa vào việc sự đồng ý của phụ huynh gắn với một email đã xác minh (người đồng ý là chủ hộp thư). Khi không có email:

- Bằng chứng đồng ý của phụ huynh **yếu hơn**: chỉ là ô tick "tôi là phụ huynh ≥18" gắn với một username; không có gì chứng minh người đăng ký là người lớn hay có quan hệ với trẻ, và trẻ có thể tự đăng ký.
- **Không có kênh liên lạc**: không gửi được thông báo vi phạm dữ liệu (runbook 10.1 bước 6), thông báo đổi chính sách cần đồng ý lại, nhắc xóa tài khoản nhàn rỗi 24 tháng, hay trả lời yêu cầu truy cập/xóa.
- Luật 91/2025 Điều 9 và 24 cùng mức "xác minh tuổi" chưa được xác nhận (user-accounts.md mục 9).

Điều kiện: giữ cờ TẮT và bản nháp Chính sách/Điều khoản; **không bật cho công chúng trước khi luật sư duyệt mô hình này** (chấp nhận tài khoản không email, hay bắt buộc email ít nhất khi tạo hồ sơ con).

**R2 — Chiếm đoạt tài khoản và khôi phục.** Username lộ công khai nên mật khẩu yếu bị tấn công; giảm bằng giới hạn theo username + IP và chặn mật khẩu phổ biến/chứa username. Mã khôi phục thay vai trò email: ai có mã là đặt lại được mật khẩu, nên mã bị lộ (chụp màn hình, chia sẻ) = bị chiếm tài khoản; giảm bằng dùng một lần, giới hạn brute force (không gian 31^20), hủy mọi phiên khi dùng. Ngược lại **mất mã + quên mật khẩu + không có email = mất tài khoản vĩnh viễn**: không có câu hỏi bảo mật và không ai xác minh được chủ sở hữu (khôi phục thủ công chính là đường chiếm đoạt). Chấp nhận có chủ ý; UI phải bắt người dùng xác nhận đã lưu mã và khuyến khích thêm email.

**R3 — Lạm dụng bot đăng ký.** Không cần hộp thư nên tạo tài khoản hàng loạt rất rẻ (chiếm username, tốn DB). Giảm: 3/giờ/IP, cooldown 60 giây, hook Turnstile (bật khi thấy lạm dụng; ngưỡng ở pentest F10), tên dành riêng. Còn lại: bot nhiều IP vượt được giới hạn IP; theo dõi khóa `reg-*` và số tài khoản mới (runbook 12.2).

**R4 — Dò username.** Đăng nhập và khôi phục trả cùng một phản hồi cho username có/không tồn tại; riêng `/register` báo `username_taken` (không tránh được), được bảo vệ bởi giới hạn đăng ký.

## Phương án đã loại

| Phương án | Lý do loại |
|---|---|
| Đăng nhập bằng email (ADR 0008) | Trái yêu cầu giảm ma sát của chủ; cần nhà gửi email ngay từ đầu (F1) |
| Câu hỏi bảo mật | Đáp án dễ đoán/tra được (ASVS 2.1 không khuyến khích), thêm dữ liệu cá nhân |
| Bắt buộc email cho mọi tài khoản | Giải quyết R1 tốt hơn; **giữ làm phương án dự phòng** nếu luật sư không chấp nhận R1 |
| Khôi phục thủ công qua admin | Không xác minh được chủ sở hữu; mở đường chiếm đoạt |

## Hệ quả

- `users.username` là khóa đăng nhập; `users.email` nullable và luôn đã xác minh.
- Chính sách/Điều khoản bản nháp đã đổi (username, mã khôi phục, hậu quả mất mã); vẫn chờ luật sư.
- Cờ giữ TẮT; thứ tự bật: [deploy-plan-accounts.md](../deploy-plan-accounts.md), runbook mục 12.
- Hoàn nguyên: `down` của 0039 bị từ chối khi còn tài khoản không email; cần quyết định xử lý các tài khoản đó trước.
