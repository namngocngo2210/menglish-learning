# Nguồn nội dung và crawler

Nguyên tắc: **không dùng AI/LLM sinh câu hỏi**. Chỉ dùng văn bản được phép từ hai nguồn dưới đây; câu hỏi tự động dùng quy tắc, regex, bảng từ và thống kê corpus. Dữ liệu giữ `source_url`, `source_name`, `license`, `crawled_at` (trong JSON: camelCase). Không thêm UI nguồn/giấy phép vào trang bài tập; trang ghi công chung `/nguon-du-lieu` sẽ được tạo sau.

## Hai nguồn được phép

| Nguồn | Dùng cho | Giấy phép | Cách lấy |
| --- | --- | --- | --- |
| VOA Learning English | Bài đọc, cloze, dạng từ, ngữ pháp, sắp xếp câu theo quy tắc | Public domain (work of the US Government) | Sitemap chính thức, bài từ 2015; loại AP, Reuters, AFP, bên thứ ba và credit không chắc chắn |
| Bộ/Sở GD&ĐT chính thức | PDF đề lớp 6–9 hoặc tuyển sinh lớp 10 với đáp án xác định | Văn bản chính thức của cơ quan nhà nước | Seed đã xác minh trên host allowlist `*.gov.vn` hoặc host Sở `*.edu.vn` cụ thể; giữ nguyên văn, năm, tỉnh |

Seed PDF nằm trong `crawler/config/gov-seeds.json`, mặc định rỗng. Host nằm trong `crawler/config/gov-hosts.json`; không cho phép chung mọi `*.edu.vn`. Chỉ nhập câu có đúng một đáp án chính thức. Không OCR hay đoán đáp án.

## Nguồn bị cấm

VnDoc, Hoc247, Loigiaihay, Tuyensinh247, Thư viện học liệu, Study4, langgo.edu.vn, navi.edu.vn, dethi.edu.vn, mọi website tổng hợp đề, nội dung SGK, Cambridge, OUP và nhà xuất bản khác. Denylist ưu tiên hơn allowlist. Không có nguồn thứ ba.

## Crawl và lưu trữ

- Tôn trọng robots.txt theo UA hoặc `*`; tối đa một request/giây mỗi host, timeout 20 giây, tối đa hai lần retry với backoff.
- UA: `MEnglishLearningBot/0.1 (+https://github.com/namngocngo2210/menglish-learning)`.
- Cache mọi response tại `data/raw/<host>/<sha1-url>.<ext>` kèm metadata URL, fetchedAt, status, contentHash. Không tải lại trừ `--refresh`.
- Build chỉ đọc cache; crawledAt lấy từ fetchedAt, thứ tự và ID ổn định. Lỗi parse và lý do loại câu có thống kê, không tự xuất bản.

## Sinh câu, phân loại và kiểm soát chất lượng

Cloze nội dung dùng phương án cùng nhóm từ/dạng biến đổi/tần suất; ngữ pháp chỉ dùng tín hiệu rõ ràng và bảng động từ. Dạng từ cần bốn thành viên họ từ có trong corpus. Định nghĩa chỉ lấy từ “Words in This Story” của chính bài VOA. Không tự sinh đồng/trái nghĩa, trọng âm hay phát âm; câu loại này chỉ được nhập nguyên văn từ đề chính thức có đáp án.

Lớp/độ khó dùng độ dài từ, độ dài câu, tần suất trong corpus đã crawl, mẫu ngữ pháp và nhãn level VOA; điều chỉnh theo tứ phân vị khi quá tập trung vào một lớp. Chủ đề theo keyword/regex, không đủ tự tin dùng `chung`. Công thức, giới hạn và lệnh chạy ở [crawler/README.md](../crawler/README.md).

Mỗi câu có bốn phương án khác nhau và đúng một khóa đáp án; cloze có một blank, kiểm tra tái tạo câu gốc và đáp án thay thế trong corpus. Chống trùng bằng stem chuẩn hóa, thêm passageId cho cloze có bài đọc. Các bộ lọc xác định không thay thế việc giáo viên kiểm tra tính duy nhất về nghĩa.

Chỉ ghi ContentBundle vào quarantine, `tests: []`, `reviewStatus: quarantine`; không đưa vào loader công khai. Chủ sở hữu phải kiểm tra nguồn/giấy phép, wording, đáp án, bài đọc và chất lượng trước luồng draft → in_review → published.

Mục tiêu **2.000 câu là best-effort**, không phải cam kết sản lượng. `npm run report` báo số thực giữ lại theo lớp/kỹ năng/loại/nguồn và lý do loại.
