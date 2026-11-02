# Trang chủ v2 — mockup (chỉ thiết kế, không đổi code production)

Mockup tĩnh, mở trực tiếp: `a-skill-first.html`, `b-grade-first.html` (sinh bằng `python3 build.py`).
Ảnh: `*-390.png` (mobile), `*-1440.png` (desktop), `a-skill-first-390-footer-open.png` (chân trang mở rộng).
Chữ/màu/mascot theo `docs/brand.md`; chỉ hiển thị lớp 6–9 đang có, không nhắc lớp 1–5, không "THCS".

## Hai phương án

- **A — kỹ năng trước:** hero + MỘT bộ chọn lớp (chip 6 7 8 9, tự xuống dòng khi có thêm lớp) → 4 ô kỹ năng trỏ thẳng `/lop-N/<kỹ năng>` của lớp đang chọn → 3 ô "Làm ngay" (Luyện nhanh 10 phút, Thi vào lớp 10, Luyện tập nhóm).
- **B — chọn lớp trước, tối giản:** hero chỉ có câu hỏi "Em học lớp mấy?" + chip lớn → 3 ô "Làm ngay". Kỹ năng nằm ở trang lớp.

Chung: header chỉ còn logo + nút "Chọn lớp ▾" + 2 liên kết (ẩn trên mobile). Trên trang chủ nút này cuộn tới bộ chọn lớp; ở trang con mở popover danh sách lớp (sinh từ `getGrades()`). Chân trang gọn: 6 liên kết thông tin + một khối `<details>` "Tất cả bài luyện theo lớp" (đóng mặc định, vẫn nằm trong DOM nên crawl được).

## So sánh

| Chỉ số | Hiện tại | A | B |
| --- | --- | --- | --- |
| Link `/lop-N` trên trang chủ (tổng, gồm cả `/lop-N/<kỹ năng>`) | 37 | 28 | 24 |
| Link tới lớp, **nhìn thấy ngay** (không mở rộng) | ~13, ước tính (header 4, hero 1, thẻ 4, footer 4) | 4 chip + 4 ô kỹ năng = 8 | 4 chip |
| Số chỗ chọn lớp | 5 (header, hero, thẻ, footer ×2) | 1 (chip) | 1 (chip) |
| Link kỹ năng nhìn thấy trong footer | 16 | 0 (16 trong `<details>`) | 0 (16 trong `<details>`) |
| Click từ trang chủ tới 1 bài kiểm tra (lớp → kỹ năng → chủ đề → đề) | 4 | 3 (ô kỹ năng bỏ qua trang lớp) | 4 |
| Click tới "Luyện nhanh 10 phút" / Thi lớp 10 / Luyện tập nhóm | 2 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 |
| Mở rộng lên 9 lớp | thêm pill/thẻ/link ở 5 nơi | thêm 1 chip (tự xuống dòng) | thêm 1 chip |

(Số link đếm bằng regex trên HTML mockup; "hiện tại" 37 theo số liệu chủ giao.)

## Bản đồ liên kết nội bộ (SEO)

| Trang | Đường đi từ trang chủ | Click |
| --- | --- | --- |
| 4 trang `/lop-N` | chip chọn lớp (A, B); `<details>` ở chân trang | 1 |
| 16 trang `/lop-N/<kỹ năng>` | A: ô kỹ năng (lớp đang chọn) hoặc `<details>` chân trang; B: chip → trang lớp → kỹ năng (và `<details>`) | 1–2 |
| `/thi-vao-lop-10`, `/luyen-tap-nhom` | ô "Làm ngay", header, footer | 1 |
| `/lop-N/<kỹ năng>/<chủ đề>/…` | không đổi: từ trang kỹ năng | 2–3 |

Không mất liên kết nội bộ nào; trang lớp và trang kỹ năng vẫn có breadcrumb và liên kết cấp dưới như hiện tại. Phương án khuyến nghị ghi chú: link ẩn trong `<details>` vẫn được Google lập chỉ mục (nội dung đã có trong HTML), nhưng nếu muốn chắc có thể trỏ thêm tới trang `/so-do-trang` (mới).

## Cần làm khi triển khai (chưa làm ở PR này)

- Route mới `/luyen-nhanh` (đề trộn ngẫu nhiên 10 phút); hiện chưa có trang riêng → ô này cần quyết định phạm vi.
- Bộ chọn lớp ghi nhớ lớp đã chọn (localStorage) để ô kỹ năng ở A đổi theo lớp; không có JS thì mặc định lớp thấp nhất.
- Popover "Chọn lớp" ở header: dùng `<details>`/Popover API, không thêm thư viện.
- Kiểm tra Lighthouse mobile (Perf ≥ 90, A11y ≥ 95, SEO 100, CLS 0) sau khi làm thật; mockup chỉ 2 ảnh nhỏ (mascot 44 KB) nên ngân sách dễ đạt.
- Ô kỹ năng/"Làm ngay" mockup chưa có biểu tượng (máy chụp không có font emoji); khi làm thật dùng lucide-react.

## Khuyến nghị: **A**

A giảm số chỗ chọn lớp từ 5 xuống 1, đưa kỹ năng và tác vụ nhanh lên màn hình đầu, bớt 1 click tới bài làm và giữ đủ liên kết nội bộ. B sạch hơn nhưng chỉ có một quyết định "chọn lớp" nên kỹ năng bị đẩy xuống trang lớp (4 click như cũ). Khi lên 9 lớp, cả hai chỉ thêm chip.
