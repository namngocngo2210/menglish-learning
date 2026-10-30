# Nguồn nội dung và crawler

Nguyên tắc: **không dùng AI sinh câu hỏi**. Câu hỏi lấy từ nguồn được phép dùng lại, hoặc sinh tự động theo quy tắc từ dữ liệu có giấy phép mở. Mỗi câu lưu nguồn + giấy phép và hiển thị ghi nguồn trên trang.

## Nguồn được phép

| Nguồn | Dùng cho | Giấy phép | Cách lấy |
|-------|----------|-----------|----------|
| Website chính thức Bộ GD&ĐT, Sở GD&ĐT (`*.gov.vn`, `*.edu.vn` của Sở) | Đề chính thức lớp 6–9, đề tuyển sinh lớp 10 kèm đáp án | Văn bản chính thức (ghi rõ nguồn, năm, tỉnh) | Tải PDF/DOC, parse câu trắc nghiệm đọc/ngữ pháp/từ vựng/viết lại câu |
| Tatoeba | Câu tiếng Anh (có bản dịch Việt) → câu điền từ, sắp xếp từ, tìm lỗi sai | CC BY 2.0 FR | File export chính thức (không cào trang) |
| Wiktionary (bản trích xuất kaikki.org) | Từ vựng: nghĩa, từ loại, đồng/trái nghĩa, dạng từ, trọng âm, phiên âm | CC BY-SA | File JSON trích xuất |
| VOA Learning English | Bài đọc trình độ THCS → câu cloze/từ vựng theo quy tắc | Tài sản công (chính phủ Mỹ) — **loại bài của AP, Reuters, bên thứ ba** | Crawl bài, kiểm tra dòng credit |

## Nguồn bị cấm

VnDoc, Hoc247, Loigiaihay, Tuyensinh247, Thư viện học liệu, Study4, nội dung SGK và nhà xuất bản, Cambridge, OUP, các site tổng hợp đề. Lý do: bản quyền + Google coi là nội dung trùng lặp.

## Quy tắc crawl

- Tôn trọng `robots.txt`; tối đa 1 request/giây mỗi host; User-Agent ghi rõ tên dự án + liên hệ.
- Lưu file gốc vào volume (`raw_documents`), có `content_hash`; chạy lại không tải trùng.
- Parse lỗi → đánh dấu `failed`, không làm dừng cả job; báo cáo cuối job.

## Sinh câu theo quy tắc (không AI)

| Dạng | Cách sinh | Phương án nhiễu |
|------|-----------|-----------------|
| Điền từ (cloze) | Che 1 từ trong câu Tatoeba / bài VOA | Cùng từ loại, tần suất gần, cùng lớp |
| Chọn dạng từ | Che từ có họ từ trong Wiktionary | Các dạng khác của cùng gốc từ |
| Thì động từ | Câu chứa động từ chia thì, nhận diện bằng quy tắc | Các thì khác của cùng động từ |
| Sắp xếp câu | Đảo trật tự cụm từ | Các thứ tự sai hợp lệ về từ |
| Tìm lỗi sai | Thay 1 thành phần bằng dạng sai theo bảng lỗi phổ biến | Các phần đúng của câu |
| Đồng/trái nghĩa | Wiktionary | Từ cùng chủ đề, cùng từ loại |
| Trọng âm/phát âm (dạng viết) | Phiên âm IPA Wiktionary | Từ cùng số âm tiết |

## Phân loại

- Lớp và độ khó: danh sách từ vựng theo cấp độ (CEFR A1–B1), độ dài câu, tần suất từ.
- Chủ đề / điểm ngữ pháp: bảng từ khóa và mẫu câu (quy tắc), lưu trong `crawler/rules/`.
- Câu không đủ tự tin phân loại → `status = hidden`, chờ giáo viên duyệt.

## Kiểm soát chất lượng

- Chống trùng bằng `stem_hash` (chuẩn hóa chữ thường, bỏ dấu câu, khoảng trắng).
- Mỗi câu phải có đúng 1 đáp án đúng, 3–4 phương án, không phương án trùng.
- Nút "Báo câu sai" trên trang → `question_reports` → câu bị báo nhiều tự ẩn chờ duyệt.
- Mục tiêu giai đoạn 1: ≥ 2.000 câu hoạt động, rải đều lớp 6–9.
