# Lộ trình

Chú thích: **[Thiết kế]** = đã có tài liệu/bản xem trước, chưa triển khai; **[Chưa làm]** = chưa bắt đầu. Hiện chưa có hạng mục nào đã triển khai thành sản phẩm.

## Giai đoạn 0 — Thiết kế giao diện (PR #2)

1. **[Thiết kế] Hướng thị giác cam/navy** (họ màu MEnglish, Be Vietnam Pro) thay bản xanh da trời; 4 ảnh PNG tĩnh (home, admin × 1440/390). **Chờ chủ duyệt thẩm mỹ**; tên/logo chưa quyết định. Xem [ui-design.md](ui-design.md).
2. **[Chưa làm] Hoàn thiện các màn còn lại** sau khi chủ duyệt hướng.
3. Toolchain UI: Next.js + Tailwind + shadcn/ui + Lucide; giao diện do Claude thiết kế, Codex hiện thực.

## Giai đoạn 1 — Trắc nghiệm đọc + viết, miễn phí (≈ 4–5 tuần) — [Chưa làm]

1. **Nền tảng**: monorepo, Docker compose, Postgres + Redis, migration, khung Next.js + Gin, middleware bảo mật và rate limit, SEO nền (metadata, sitemap, robots, JSON-LD), CI (lint, test, govulncheck, npm audit, gitleaks, Lighthouse CI).
2. **Crawler + ngân hàng câu hỏi**: nguồn hợp pháp ([content-sources.md](content-sources.md)), chỉ VOA Learning English và PDF Bộ/Sở GD&ĐT đã xác minh; sinh câu theo quy tắc, phân loại, mục tiêu 2.000 câu best-effort, báo số thực.
3. **Trộn đề + trang đề**: mixer tất định, trang lớp/kỹ năng/chủ đề/đề, thi vào lớp 10, chấm điểm phía server, giải thích; metadata nguồn lưu trong dữ liệu, trang nguồn chung `/nguon-du-lieu` sẽ tạo sau; quảng cáo AdSense chế độ trẻ em.
4. **Admin một chủ** (sau khi chủ duyệt thiết kế và phê duyệt riêng): đăng nhập/session phía server, ủy quyền mọi API admin, CSRF + cookie an toàn, audit log, rate limit, cấu hình nguồn chống SSRF; module nguồn/giấy phép/crawl job, ngân hàng bài đọc–câu hỏi, hàng đợi duyệt, đề thi + preset trộn đề, báo cáo câu sai, thống kê cơ bản. Luồng crawl → quarantine/draft → chủ duyệt → publish, không auto-publish. Chi tiết: [security.md](security.md), [data-model.md](data-model.md). **[Thiết kế]**, chưa triển khai.
5. **Lên beejunior.meducation.vn**: Caddy trỏ về `web`/`api`, bỏ `noindex`, đăng ký Google Search Console, gửi sitemap.

Học sinh vẫn không cần tài khoản; admin một chủ có đăng nhập riêng phía server.

Tiêu chí xong: Lighthouse đạt ngưỡng, làm đề trọn vẹn trên mobile, sitemap được Google đọc.

## Giai đoạn 2 — Giữ chân và thu tiền

Tài khoản phụ huynh (đồng ý theo NĐ 13), theo dõi tiến độ, báo cáo tuần qua Zalo, điểm thưởng/chuỗi ngày học, luyện thi vào 10 theo tỉnh, gói trả phí qua VietQR, chế độ lớp học cho giáo viên.

## Giai đoạn 3 — Nghe + nói

Bài nghe (audio có giấy phép), luyện phát âm, chấm nói bằng API (trả theo lượt).

## Ngoài phạm vi giai đoạn 1

Đăng nhập của học sinh/phụ huynh, thanh toán, AI sinh hoặc chấm nội dung, ứng dụng di động.
