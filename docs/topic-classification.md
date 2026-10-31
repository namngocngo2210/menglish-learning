# Báo cáo phân loại chủ đề

Báo cáo được sinh tự động bởi `npm run build:tests`; không sửa bằng tay.

## Phương pháp

Phân loại bằng luật cố định, không dùng LLM. Chạy sau bộ lọc chất lượng và trước khi chia đề; bỏ qua nhãn chủ đề của trình thu thập. Ngữ pháp dùng luật có thứ tự, luật đầu tiên khớp được chọn. Đọc hiểu và viết câu giữ nguyên nhãn.

Từ vựng dùng từ điển chủ đề và dạng biến đổi thông dụng. Các gốc từ chồng lặp được gộp (ví dụ teach/teacher/teaching); mỗi gốc từ chỉ được tính một lần trong mỗi phần: câu dẫn ×1, các lựa chọn ×1, đáp án đúng ×3, tiêu đề bài đọc ×3 (tối đa 4 từ khóa), thân bài ×1 (tối đa 8 từ khóa mỗi chủ đề). Chọn chủ đề điểm cao nhất khi: tổng điểm từ 5 trở lên, hơn chủ đề thứ hai ít nhất 2 điểm, và chính câu hỏi (câu dẫn/lựa chọn) phải có bằng chứng (tối thiểu 2 điểm riêng, hoặc 1 điểm riêng kèm tổng từ 9). Bài đọc chỉ củng cố, không tự quyết định. Bài tập họ từ không được phân loại. Phần lớn câu từ vựng là điền từ phổ thông (động từ, giới từ…) không thuộc chủ đề nào nên tỷ lệ chưa phân loại cao; các câu này chỉ nằm ở Tổng hợp.

Chỉ mở trang và đề chủ đề cụ thể khi có ít nhất 10 câu sau lọc và chia được đề tối thiểu 10 câu. Ô ghi số câu và có/không có trang. Câu chưa phân loại chỉ thuộc Tổng hợp; đề Tổng hợp vẫn lấy toàn bộ câu của kỹ năng. Số liệu gồm cả câu chưa được đưa vào đề do giới hạn nhóm bài đọc.

Tổng sau lọc: **2587 câu**, trong đó **1674 câu** ngữ pháp và từ vựng.

## Ngữ pháp

Tổng: 421 câu.

| Chủ đề | Lớp 6 | Lớp 7 | Lớp 8 | Lớp 9 |
| --- | ---: | ---: | ---: | ---: |
| Thì hiện tại đơn | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Thì hiện tại tiếp diễn | 2 (không trang) | 9 (không trang) | 2 (không trang) | 2 (không trang) |
| Thì quá khứ đơn | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Thì quá khứ tiếp diễn | 0 (không trang) | 5 (không trang) | 4 (không trang) | 1 (không trang) |
| Thì tương lai đơn | 7 (không trang) | 4 (không trang) | 3 (không trang) | 0 (không trang) |
| Thì hiện tại hoàn thành | 1 (không trang) | 0 (không trang) | 13 (có trang) | 12 (có trang) |
| Thì quá khứ hoàn thành | 2 (không trang) | 8 (không trang) | 0 (không trang) | 3 (không trang) |
| Động từ khuyết thiếu (modal) | 42 (có trang) | 42 (có trang) | 10 (có trang) | 11 (có trang) |
| Động từ nguyên mẫu có "to" | 73 (có trang) | 85 (có trang) | 27 (có trang) | 18 (có trang) |
| Động từ to be (am, is, are) | 8 (không trang) | 10 (có trang) | 3 (không trang) | 3 (không trang) |
| So sánh hơn và so sánh nhất | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Câu điều kiện | 1 (không trang) | 0 (không trang) | 0 (không trang) | 1 (không trang) |
| Câu bị động | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Giới từ | 0 (không trang) | 2 (không trang) | 1 (không trang) | 0 (không trang) |
| Mạo từ a, an, the | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Tính từ sở hữu | 1 (không trang) | 4 (không trang) | 0 (không trang) | 1 (không trang) |
| Câu hỏi | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |

### Chưa phân loại

| Phạm vi | Tổng câu | Chưa phân loại | Tỷ lệ |
| --- | ---: | ---: | ---: |
| Lớp 6 | 137 | 0 | 0.0% |
| Lớp 7 | 169 | 0 | 0.0% |
| Lớp 8 | 63 | 0 | 0.0% |
| Lớp 9 | 52 | 0 | 0.0% |
| Toàn bộ | 421 | 0 | 0.0% |

### Luật được chọn

| Luật | Số câu |
| --- | ---: |
| grammar-be | 24 |
| grammar-conditional | 2 |
| grammar-modal | 105 |
| grammar-past-continuous | 10 |
| grammar-past-perfect | 13 |
| grammar-possessive | 6 |
| grammar-preposition | 3 |
| grammar-present-continuous | 15 |
| grammar-present-perfect | 26 |
| grammar-to-infinitive | 203 |
| grammar-will | 14 |

## Từ vựng

Tổng: 1253 câu.

| Chủ đề | Lớp 6 | Lớp 7 | Lớp 8 | Lớp 9 |
| --- | ---: | ---: | ---: | ---: |
| Gia đình và bạn bè | 4 (không trang) | 4 (không trang) | 0 (không trang) | 0 (không trang) |
| Trường học và giáo dục | 18 (có trang) | 21 (có trang) | 12 (có trang) | 1 (không trang) |
| Ẩm thực | 2 (không trang) | 1 (không trang) | 1 (không trang) | 1 (không trang) |
| Du lịch và địa điểm | 3 (không trang) | 7 (không trang) | 4 (không trang) | 1 (không trang) |
| Môi trường và thiên nhiên | 11 (có trang) | 12 (có trang) | 5 (không trang) | 1 (không trang) |
| Sức khỏe và cơ thể | 3 (không trang) | 4 (không trang) | 2 (không trang) | 1 (không trang) |
| Khoa học và công nghệ | 4 (không trang) | 9 (không trang) | 18 (có trang) | 8 (không trang) |
| Thể thao và giải trí | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Công việc và kinh doanh | 8 (không trang) | 11 (có trang) | 10 (có trang) | 0 (không trang) |
| Động vật | 10 (có trang) | 14 (có trang) | 7 (không trang) | 1 (không trang) |

### Chưa phân loại

| Phạm vi | Tổng câu | Chưa phân loại | Tỷ lệ |
| --- | ---: | ---: | ---: |
| Lớp 6 | 457 | 394 | 86.2% |
| Lớp 7 | 524 | 441 | 84.2% |
| Lớp 8 | 175 | 116 | 66.3% |
| Lớp 9 | 97 | 83 | 85.6% |
| Toàn bộ | 1253 | 1034 | 82.5% |

### Luật được chọn

| Luật | Số câu |
| --- | ---: |
| vocab-insufficient-evidence | 1030 |
| vocab-lexicon | 219 |
| vocab-word-family | 4 |

