# Giao diện tài khoản (S-U2) — brief thiết kế

Ảnh chụp 390 px (mobile-first) và 1440 px từ bản build `ACCOUNTS_ENABLED=true`, API giả cục bộ (không phải API thật). Tham chiếu để review, không phải mockup phải khớp từng pixel.

- Thương hiệu BeeJunior: nút CTA vàng `#ffc001` chữ mực, xanh `#0a6590` cho liên kết, nền `#fffdf5`; thẻ bo góc, viền 2 px.
- Một cột `max-w-xl`, mỗi form là một thẻ. Mọi điều khiển cao ≥ 44 px (hộp đánh dấu 24 px nằm trong dòng cao ≥ 44 px), focus ring rõ, lỗi hiện dưới trường kèm `role="alert"`, trường lỗi được focus.
- Hộp đồng ý không bật sẵn, chữ đúng mục 7.4 của `docs/user-accounts.md`; hộp hồ sơ con có dòng gợi ý "Hãy giải thích cho con…".
- Xóa hồ sơ / xóa tài khoản dùng hộp thoại xác nhận (nút nguy hiểm đỏ, tách khỏi nút Hủy); xóa tài khoản yêu cầu nhập lại mật khẩu.
- Chữ pháp lý có khung đỏ "BẢN NHÁP"; mục chủ phải điền hiện dạng `[TÊN PHÁP NHÂN]`, `[EMAIL LIÊN HỆ]`.
- Không quảng cáo ở trang tài khoản; không thêm script bên thứ ba.

Ảnh: `dang-ky-*`, `dang-nhap-*`, `tai-khoan-*`, `ho-so-moi-390`, `xoa-du-lieu-*`, `chinh-sach-*`.
