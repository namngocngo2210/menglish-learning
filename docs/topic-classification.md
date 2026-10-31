# Báo cáo phân loại chủ đề

Báo cáo được sinh tự động bởi `npm run build:tests`; không sửa bằng tay.

## Phương pháp

Phân loại bằng luật cố định, không dùng LLM. Chạy sau bộ lọc chất lượng và trước khi chia đề; bỏ qua nhãn chủ đề của trình thu thập. Ngữ pháp dùng luật có thứ tự, luật đầu tiên khớp được chọn. Đọc hiểu và viết câu giữ nguyên nhãn.

Từ vựng dùng từ điển chủ đề gồm các từ khóa mạnh (đã loại từ chung như have, go, good, like, buy, learn…) và dạng biến đổi thông dụng, khớp theo từ nguyên vẹn (word boundary). Các gốc từ chồng lặp được gộp (ví dụ teach/teacher/teaching). Chỉ câu dẫn và đáp án đúng được tính; các phương án nhiễu KHÔNG BAO GIỜ được tính. Chọn chủ đề khi: đáp án đúng chính là từ khóa của chủ đề, có ít nhất 2 từ khóa khác nhau trong câu dẫn + đáp án đúng, và hơn chủ đề thứ hai ít nhất 1 từ khóa; hoặc 1 từ khóa là chính đáp án đúng kèm tín hiệu chủ đề từ bài đọc (từ 4 từ khóa khác nhau trong tiêu đề/thân bài, hơn chủ đề thứ hai ít nhất 2). Bài đọc chỉ củng cố, không tự quyết định. Bài tập họ từ không được phân loại. Phần lớn câu từ vựng là điền từ phổ thông (động từ, giới từ…) không thuộc chủ đề nào nên tỷ lệ chưa phân loại rất cao; các câu này chỉ nằm ở Tổng hợp. Kiểm tra thủ công toàn bộ câu được gán chủ đề (không quá 30 câu mỗi lớp) cho độ chính xác 100% ở lần chạy cuối; xem scripts/audit-vocab-topics.ts.

Chỉ mở trang và đề chủ đề cụ thể khi có ít nhất 10 câu sau lọc và chia được đề tối thiểu 10 câu. Ô ghi số câu và có/không có trang. Câu chưa phân loại chỉ thuộc Tổng hợp; đề Tổng hợp vẫn lấy toàn bộ câu của kỹ năng. Số liệu gồm cả câu chưa được đưa vào đề do giới hạn nhóm bài đọc.

Tổng sau lọc: **2697 câu**, trong đó **1721 câu** ngữ pháp và từ vựng.

## Ngữ pháp

Tổng: 436 câu.

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
| Động từ nguyên mẫu có "to" | 73 (có trang) | 85 (có trang) | 27 (có trang) | 19 (có trang) |
| Động từ to be (am, is, are) | 8 (không trang) | 10 (có trang) | 3 (không trang) | 3 (không trang) |
| So sánh hơn và so sánh nhất | 0 (không trang) | 0 (không trang) | 0 (không trang) | 2 (không trang) |
| Câu điều kiện | 1 (không trang) | 0 (không trang) | 0 (không trang) | 3 (không trang) |
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
| Lớp 9 | 67 | 10 | 14.9% |
| Toàn bộ | 436 | 10 | 2.3% |

### Luật được chọn

| Luật | Số câu |
| --- | ---: |
| grammar-be | 24 |
| grammar-comparison | 2 |
| grammar-conditional | 4 |
| grammar-modal | 105 |
| grammar-past-continuous | 10 |
| grammar-past-perfect | 13 |
| grammar-possessive | 6 |
| grammar-preposition | 3 |
| grammar-present-continuous | 15 |
| grammar-present-perfect | 26 |
| grammar-to-infinitive | 204 |
| grammar-will | 14 |
| unclassified | 10 |

## Từ vựng

Tổng: 1285 câu.

| Chủ đề | Lớp 6 | Lớp 7 | Lớp 8 | Lớp 9 |
| --- | ---: | ---: | ---: | ---: |
| Gia đình và bạn bè | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Trường học và giáo dục | 3 (không trang) | 1 (không trang) | 4 (không trang) | 0 (không trang) |
| Ẩm thực | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Du lịch và địa điểm | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Môi trường và thiên nhiên | 1 (không trang) | 1 (không trang) | 0 (không trang) | 0 (không trang) |
| Sức khỏe và cơ thể | 2 (không trang) | 1 (không trang) | 1 (không trang) | 0 (không trang) |
| Khoa học và công nghệ | 2 (không trang) | 2 (không trang) | 2 (không trang) | 2 (không trang) |
| Thể thao và giải trí | 0 (không trang) | 0 (không trang) | 0 (không trang) | 0 (không trang) |
| Công việc và kinh doanh | 1 (không trang) | 2 (không trang) | 0 (không trang) | 0 (không trang) |
| Động vật | 5 (không trang) | 5 (không trang) | 3 (không trang) | 0 (không trang) |

### Chưa phân loại

| Phạm vi | Tổng câu | Chưa phân loại | Tỷ lệ |
| --- | ---: | ---: | ---: |
| Lớp 6 | 457 | 443 | 96.9% |
| Lớp 7 | 524 | 512 | 97.7% |
| Lớp 8 | 175 | 165 | 94.3% |
| Lớp 9 | 129 | 127 | 98.4% |
| Toàn bộ | 1285 | 1247 | 97.0% |

### Luật được chọn

| Luật | Số câu |
| --- | ---: |
| vocab-insufficient-evidence | 1243 |
| vocab-lexicon | 17 |
| vocab-lexicon-cue | 21 |
| vocab-word-family | 4 |

