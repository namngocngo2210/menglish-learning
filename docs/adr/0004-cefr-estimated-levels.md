# ADR 0004: Trình độ CEFR ước tính bằng luật tất định, hiển thị dạng dải

- Trạng thái: đề xuất
- Ngày: 2026-11-01
- Người quyết định: owner (Babay1903)
- Liên quan: thẻ t_16929b90, [cefr-levels.md](../cefr-levels.md), [topic-classification.md](../topic-classification.md), [backend-blueprint.md](../backend-blueprint.md)

## Bối cảnh

Chủ muốn thêm chiều "trình độ" (Pre-A1, A1, A2, B1, B2) trực giao với lớp/kỹ năng/chủ đề. Chỉ dùng thang CEFR; không dùng tên kỳ thi/chứng chỉ thương hiệu hay logo; nhãn luôn là "ước tính". Danh sách từ của nhà xuất bản (EVP, Oxford 3000/5000) cấm dùng thương mại [đọc điều khoản]. CEFR-J Wordlist cho dùng thương mại có ghi nguồn nhưng phần miễn trừ còn câu "chi phí tính sau khi bàn riêng" ⇒ mơ hồ. Bản thử trên 2.698 câu [đo]: phương pháp chính so với tiêu chí chỉ-tần-suất Spearman 0,53, lệch ≤ 1 bậc 84,1%; đọc thử không chuyên gia 14/32 trùng đúng, 32/32 trong ±1; không có Pre-A1; 39,5% câu confidence < 0,3.

## Quyết định

Chúng ta sẽ ước tính trình độ bằng **luật tất định, không LLM** (cấp từ CEFR-J + hạng tần suất dự phòng + độ dài câu/độ đọc + band ngữ pháp từ classifier), lưu `level_estimated/score/confidence/reason` trong DB, tính trình độ của đề từ phân bố câu và **chỉ hiển thị cấp đề dạng dải** ("trình độ ước tính A2–B1"); chỉ bật nhãn công khai sau khi bộ nhãn người đạt ngưỡng; xin xác nhận thương mại CEFR-J bằng văn bản trước production.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Luật tất định + CEFR-J (chọn) | giải thích được, rẻ, tái lập, không phụ thuộc dịch vụ | điều khoản thương mại cần xác nhận; độ chính xác thô (±1 bậc) |
| B. Chỉ hạng tần suất (dự phòng) | giấy phép dễ hơn (CC-BY-SA / tự tính từ VOA) | kém chính xác rõ (đồng thuận 35% đúng bậc với A) |
| C. EVP / danh sách nhà xuất bản | chuẩn ngành | điều khoản cấm thương mại và lưu CSDL ⇒ loại |
| D. LLM gán nhãn | nhanh | không tất định, khó giải thích, rủi ro chi phí/nhãn; trái quy ước dự án ⇒ loại |
| E. Gán tay toàn bộ | chính xác nhất | quy mô 2.698+ câu, tốn công chuyên gia |

## Hệ quả

Tốt: thêm bộ lọc/mixer theo trình độ không đổi URL đề; nhãn giải thích được và ghi đè được. Xấu: nhãn từng câu chưa đủ tin; phụ thuộc giấy phép bên ngoài; cần người duyệt ~150 câu. Việc tiếp: L-0…L-4 trong cefr-levels.md §7 (≈ 9–13 ngày agent [ước]), CI chặn chuỗi cấm. Hoàn tác: cột `level_*` có thể NULL/bỏ, không ảnh hưởng nội dung. Đổi ý nếu: CEFR-J từ chối thương mại (chuyển B, chỉ hiển thị dải rộng), hoặc kiểm toán người dưới ngưỡng (giữ chỉ ở mixer/admin).
