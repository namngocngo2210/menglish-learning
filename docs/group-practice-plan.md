# Luyện tập nhóm — kế hoạch triển khai

> **THIẾT KẾ, chưa triển khai.** Chỉ bắt đầu sau khi chủ sở hữu duyệt thiết kế và trả lời mục 6. Tài liệu: [group-practice.md](group-practice.md) · [kỹ thuật](group-practice-tech.md) · [API](group-practice-api.md).

## 1. Phương án đã khuyến nghị

Container `rooms` riêng (Node/TS, 1 tiến trình, trạng thái trong RAM, SSE + POST), dùng lại `mixer`/`scoring` của `web/lib`; trang `/luyen-tap-nhom` (SSG, index) + `/luyen-tap-nhom/phong/[ma]` (vỏ client, noindex). Không DB, không Redis, không tài khoản.

## 2. Các giai đoạn (sprint)

Ước tính cho 1 dev (agent) + review/test độc lập; đơn vị = ngày làm việc tập trung. Mỗi sprint = 1 nhánh = 1 PR.

| Sprint | Nội dung | Ước tính | Kết quả kiểm chứng được |
|--------|----------|----------|--------------------------|
| **S0** | Chủ duyệt thiết kế + trả lời quyết định D1–D10; xác nhận pháp lý NĐ 13 | (chủ) | Ghi quyết định vào docs |
| **S1 — Lõi phòng** | Package `rooms/` (HTTP server, `RoomStore` RAM, máy trạng thái, mã phòng, token, snapshot), xuất `bank-rooms.json` có đáp án (script build), tạo phòng cố định + trộn, join/leave/kick/start/answers/submit/finish/results/review, chấm server-side, xếp hạng + hòa | 6–8 | Test đơn vị + test API (không UI): không rò đáp án, máy trạng thái, tie-break, hoán vị theo người, đủ/đầy/khóa |
| **S2 — Thời gian thực + độ bền + an toàn** | SSE + snapshot + polling dự phòng, vào lại bằng token, mất kết nối/chuyển chủ phòng, hẹn giờ/tự nộp, dọn dẹp/hết hạn, rate limit, lọc tên + blocklist, giới hạn phòng/IP, drain/SIGTERM, healthz, header/CSP, test tải | 5–7 | Test tải 300 phòng × 6 người (RSS, p95), test 429, chaos (ngắt kết nối, restart) |
| **S3 — Giao diện** | Landing `/luyen-tap-nhom` (SEO đầy đủ), tạo/vào phòng, phòng chờ, làm bài (không phản hồi, chỉ số đã nộp), chờ, kết quả + rematch, màn lỗi; theo thiết kế đã duyệt, a11y/responsive 390–1440; không `AdSlot` trong phòng | 7–9 | vitest + Playwright (2–3 trình duyệt giả lập), Lighthouse CI (SEO 100, A11y ≥ 95) trên landing |
| **S4 — Triển khai (do chủ/ops)** | Dockerfile + compose + Caddy route `/rt/*` (`flush_interval -1`), cập nhật sitemap/robots, Chính sách quyền riêng tư, tài liệu vận hành, công tắc `ROOMS_ENABLED` | 2–3 (dev) + ops | Chủ duyệt; deploy do chủ |
| **S5 — Hoàn thiện** | Chỉ số ẩn danh cho chủ, tinh chỉnh theo phản hồi, bộ câu hỏi 1v1 "câu khác nhau" | 2–3 | — |

Tổng dev ≈ **22–30 ngày công** (≈ 5–6 tuần lịch có review/test). Lõi chơi được (S1+S2 + UI tối thiểu) khoảng 3–4 tuần.

## 3. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|-----------|
| Đáp án đề công khai (pool JSON/`correctKey` ở trang đề hiện có) → tra tay | TB | Chấp nhận (luyện tập không giải thưởng) hoặc quyết định D5 (chuyển chấm điểm server-side cho toàn site, tốn công, tách PR) |
| Restart/deploy `rooms` làm mất phòng đang chơi | TB | drain + cảnh báo UI + `healthz` số phòng đang chơi; ops tránh deploy giờ cao điểm |
| RAM máy chung 5,9 GB | TB | trần 192 MB, trần phòng/kết nối, tắt tính năng bằng cờ, test tải |
| Proxy trường chặn SSE | Thấp–TB | polling 3 s tự động |
| Lạm dụng tên/bắt nạt | TB | không chat, blocklist chủ duyệt, đuổi/khóa phòng, báo cáo ẩn danh |
| Trẻ em/NĐ 13 | TB | không lưu bền vững, không tài khoản, tối thiểu hóa; xác nhận pháp lý (D10) |
| Học sinh dùng chung IP trường làm dính rate limit | TB | ngưỡng rộng, tính theo IP + token, cấu hình bằng env |
| Hai bản mixer (nếu sau này port Go) lệch | Thấp | golden-vector theo seed; hiện tại dùng chung mã TS |
| Đồng hồ/bị ngắt khi đang làm bài | Thấp | giờ server là nguồn chân lý, lưu đáp án liên tục |
| Ngân hàng không đủ câu cho bộ lọc (lớp/kỹ năng/chủ đề/độ khó) | Thấp | `preview` kiểm số câu khả dụng và báo trước khi tạo |
| Phạm vi trượt (chat, bảng điểm trực tiếp) | TB | ngoài phạm vi, đưa vào pha sau khi chủ duyệt riêng |

## 4. Kế hoạch kiểm thử

- **Đơn vị:** máy trạng thái phòng; mã phòng (alphabet, va chạm, tombstone); xếp hạng + hòa; chấm điểm với hoán vị phương án theo người (`applyOptionOrder` ngược); lọc tên (dấu, leetspeak, số điện thoại, link); tính hạn/hết giờ bằng đồng hồ giả.
- **Bảo mật/hợp đồng:** quét mọi phản hồi/sự kiện SSE trước `results` — **không có** `correctKey`/`explanation`/điểm/đáp án người khác (test quét chuỗi trên fixture); từ chối thao tác sai vai trò/trạng thái; token sai/đã đuổi; đầu vào sai schema; rate limit 429 + `Retry-After`; CSRF/Origin; không có outbound request (chặn mạng trong test).
- **Tích hợp:** nhiều client giả (30) qua SSE: vào/ra, bắt đầu, nộp, mất kết nối + vào lại, chủ phòng mất kết nối → chuyển quyền, hết giờ tự nộp, kết thúc sớm, rematch, phòng nhàn rỗi bị đóng, SIGTERM.
- **Tải:** 300 phòng × 6 người + 20 phòng × 30; đo RSS, CPU, p95 phản hồi; 2.000 kết nối; kiểm chứng trần.
- **UI:** vitest component; Playwright luồng 1v1 và 3 người (2 trình duyệt), 390 và 1440; kiểm tra a11y (axe), focus, mục tiêu chạm 44px; `AdSlot` không xuất hiện trong `/phong/*`.
- **SEO:** `/luyen-tap-nhom` có metadata/JSON-LD/sitemap; `/phong/*` có `noindex,nofollow` (meta + header), không trong sitemap; Lighthouse CI.
- Tuân thủ quy tắc repo: tester chạy full suite; dev chỉ chạy test liên quan.

## 5. Phụ thuộc và ngoài phạm vi

- Phụ thuộc: PR #6/#8 (mixer, chủ đề) đã/đang vào `main`; hạ tầng Caddy; cập nhật thương hiệu BeeJunior (card riêng) — thiết kế đã dùng thương hiệu BeeJunior.
- Ngoài phạm vi: tài khoản, chat/emoji, bảng điểm trực tiếp từng câu, đua tốc độ, lưu lịch sử bền vững, giải/phần thưởng, nghe/nói, ứng dụng di động.

## 6. Quyết định cần chủ sở hữu

| # | Câu hỏi | Khuyến nghị |
|---|---------|-------------|
| D1 | Duyệt thẩm mỹ 10 màn × 2 kích thước (BeeJunior)? | Duyệt/ghi chú chỉnh |
| D2 | Kiến trúc: container `rooms` Node/TS, RAM, SSE + POST (thay vì chờ Go `api`+Redis)? | **Có** |
| D3 | Hẹn giờ: mặc định "Không giới hạn" (trần 60 phút), tùy chọn 15/30 phút? | Có |
| D4 | Xử lý hòa điểm: cùng hạng, thứ tự trong hạng theo thứ tự vào phòng (không theo tốc độ)? Hay hòa thì xét thời gian nộp? | Cùng hạng (đúng yêu cầu "không đua tốc độ") |
| D5 | Đáp án đề công khai hiện nằm trong dữ liệu trang (tra tay được): chấp nhận cho luyện tập, hay làm PR riêng chuyển chấm điểm server-side toàn site? | Chấp nhận pha 1 |
| D6 | Thứ tự phương án: hoán vị riêng từng người (chống chép khi ngồi cạnh nhau) hay chung cả phòng? | Riêng từng người |
| D7 | 1v1: người rời trước khi nộp → đối thủ thắng hay "Hủy ván"? | Hủy ván nếu rời ở phòng chờ; thắng nếu rời khi đang làm |
| D8 | Nút "Báo cáo" (chỉ lý do chọn sẵn, ẩn danh) có làm ở pha 1 không? | Có, tối giản |
| D9 | Quảng cáo: chỉ landing, hay cả màn kết quả (ngoài lúc làm bài)? | Chỉ landing ở pha 1 |
| D10 | Xác nhận pháp lý NĐ 13: "tên hiển thị tạm trong RAM" + cookie token chức năng có cần cơ chế đồng ý của phụ huynh không? Ai soạn Chính sách? | Cần chủ xác nhận trước khi mở |
| D11 | Số người tối đa 30 và trần mặc định 10 có phù hợp lớp học (40 học sinh)? | Cho phép tăng lên 45 nếu dùng ở lớp (RAM vẫn nhỏ) |
| D12 | Blocklist từ cấm: chủ cung cấp/duyệt danh sách? | Dev dựng bản đầu, chủ duyệt |
| D13 | Tên miền/đường dẫn: `/luyen-tap-nhom` và mã 6 ký tự; chủ có muốn mã 4–5 ký tự dễ đọc hơn? | 6 ký tự (an toàn hơn) |
| D14 | Cho phép chủ phòng chọn đề từ trang chủ đề (nút "Tạo phòng từ đề này" trên trang đề) ở pha 1? | Có, ở S3 nếu đủ thời gian |
