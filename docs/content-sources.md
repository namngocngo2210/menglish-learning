# Nguồn nội dung và crawler

Nguyên tắc: **không dùng AI/LLM sinh câu hỏi**. Chỉ dùng văn bản được phép từ hai nguồn dưới đây; câu hỏi tự động dùng quy tắc, regex, bảng từ và thống kê corpus. Dữ liệu giữ `source_url`, `source_name`, `license`, `crawled_at` (trong JSON: camelCase). Không thêm UI nguồn/giấy phép vào trang bài tập; trang ghi công chung `/nguon-du-lieu` sẽ được tạo sau.

## Hai nguồn được phép

| Nguồn | Dùng cho | Giấy phép | Cách lấy |
| --- | --- | --- | --- |
| VOA Learning English | Bài đọc, cloze, dạng từ, ngữ pháp, sắp xếp câu theo quy tắc | Public domain (work of the US Government) | Sitemap chính thức, bài từ 2015; loại AP, Reuters, AFP, bên thứ ba và credit không chắc chắn |
| Bộ/Sở GD&ĐT chính thức | PDF đề lớp 6–9 hoặc tuyển sinh lớp 10 với đáp án xác định | Văn bản chính thức của cơ quan nhà nước | Seed đã xác minh trên host allowlist `*.gov.vn` hoặc host Sở `*.edu.vn` cụ thể; giữ nguyên văn, năm, tỉnh |

Seed PDF nằm trong `crawler/config/gov-seeds.json`, mặc định rỗng. Host nằm trong `crawler/config/gov-hosts.json`; không cho phép chung mọi `*.edu.vn`. Chỉ nhập câu có đúng một đáp án chính thức. Không đoán đáp án. PDF scan chỉ được nhập qua quy trình OCR chép lại hai lượt bên dưới (owner duyệt 31/10/2026, chạy một lần).

## Kết quả nhập đề chính thức (31/10/2026)

Seed đã xác minh (trang công bố của Sở GD&ĐT Hà Nội trên `hanoi.edu.vn`, robots.txt cho phép, 1 request/giây): đề + đáp án môn Ngoại ngữ không chuyên kỳ thi vào lớp 10 các năm 2024, 2025 và 2026 (6 PDF, ghi trong `crawler/config/gov-seeds.json` kèm `pageUrl`).

**Lần 1 (PR #7): 0 câu.** Cả 6 PDF là ảnh scan (pdfjs trích 0 ký tự văn bản) nên bị bỏ qua.

### OCR chép lại hai lượt (owner duyệt 31/10/2026, chạy một lần)

Phạm vi của AI: **chỉ chép chữ từ ảnh trang** (không viết lại, thêm, sửa, dịch hay giải). Không dùng Antigravity/Gemini.
- Ảnh trang lấy trực tiếp từ luồng JPEG trong 6 PDF (15 trang: 3 đề × 4 trang + 3 đáp án × 1 trang), cache ở `data/raw/pages` (gitignored). Không cài thêm gói hệ thống; tesseract không có trên máy.
- Hai lượt độc lập, hai mô hình khác nhau: lượt A = Claude vision, lượt B = Codex vision (gpt-6.1-sol), prompt khác nhau. Mỗi lượt chép từng câu (đề, đoạn văn, phương án, gạch chân `<u>…</u>`) và cột đáp án của đúng mã đề (đề 2024: mã 101; 2025 và 2026: mã 001).
- **Đáp án chỉ lấy từ PDF đáp án chính thức**; câu không có ô đáp án khớp bị loại. Ô đáp án bị con dấu che (2024 câu 2) bị loại vì hai lượt đọc khác nhau.
- Giữ câu khi và chỉ khi: cả hai lượt có câu đó, không cần hình, văn bản khớp (bỏ qua khác biệt trình bày: kiểu nháy, dấu gạch, khoảng trắng, độ dài chỗ trống, cách tách đoạn/stem và nhãn blank), phần gạch chân khớp, và hai lượt cùng đọc một đáp án A–D. Câu lệch bị loại và đếm theo lý do trong `official-exams-report.json`.
- Ngân sách: 59 lượt xem ảnh/vùng cắt tổng cộng (cap ~60), gồm cả lượt kiểm tra mẫu; không chạy lặp.
- Dữ liệu chép lưu ở `crawler/ocr/hanoi-<năm>.json` (hai lượt + khoá đáp án, không chứa ảnh); `npm run build-bank` chỉ đọc các file này nên kết quả xác định, không cần ảnh hay cache PDF. Logic gộp/kiểm tra: `crawler/src/ocr/merge.ts` (+ `crawler/test/ocr.test.ts`).
- Mọi câu có `sourceRef` kết thúc bằng `ocr-transcribed`, `reviewStatus: quarantine`; script `build:tests` **không bao giờ** xuất bản chúng (`web/scripts/lib/build-bank.ts`) cho tới khi owner duyệt. Câu thi vào lớp 10 chỉ vào ngân hàng tuyển sinh sau khi duyệt.

Kết quả thực (kho chờ duyệt, lớp 9, `tuyen-sinh-10-ngoai-ngu-khong-chuyen`):

| Năm (mã đề) | Câu đọc được | Giữ lại | Loại | Lý do loại | Giữ theo phần |
| --- | ---: | ---: | ---: | --- | --- |
| 2024 (101) | 40 | 37 | 3 | câu 11 cần hình biển báo; câu 2 hai lượt đọc đáp án khác nhau (dấu che ô); câu 4 gạch chân phát âm khác nhau | trắc nghiệm 20, đọc/điền 10, phát âm/trọng âm 3, viết lại câu 4 |
| 2025 (001) | 40 | 37 | 3 | câu 25, 26 cần hình thông báo/tin nhắn; câu 28 lượt B bỏ sót chữ “of” | trắc nghiệm 8, đọc/điền 22, phát âm/trọng âm 4, viết lại câu 3 |
| 2026 (001) | 40 | 37 | 3 | câu 15, 16 cần hình biển; câu 2 lượt A gắn nhầm đoạn văn (lỗi của lượt A, hai lượt lệch) | trắc nghiệm 8, đọc/điền 21, phát âm/trọng âm 4, viết lại câu 4 |
| **Tổng** | 120 | **111** | 9 | | trắc nghiệm 36, đọc/điền 53, phát âm/trọng âm 11, viết lại câu 11 |

Ghi chú: “đọc/điền” gồm câu đọc hiểu, điền khuyết trong đoạn văn và câu chọn câu/đoạn bị bỏ; câu điền khuyết giữ stem là nhãn blank (ví dụ `(13)`) cùng đoạn văn gốc. Câu cần hình (6 câu) không nhập vì nội dung nằm trong ảnh.

#### Kiểm tra mẫu (25 câu giữ lại, bốc ngẫu nhiên có seed `ocr-sample-2026-10-31`)

So khớp với ảnh trang gốc (vùng cắt độ phân giải đầy đủ): **0/25 câu sai** ở văn bản/phương án; khoá đáp án của các câu mẫu khớp bảng đáp án (3 ô bị dấu che ở đề 2025 câu 1–3 đọc giống nhau ở cả hai lượt, câu 3 nằm trong mẫu). Chặn trên 95% (quy tắc ba): ≈ 12%, nên mẫu này chỉ cho thấy tỷ lệ lỗi thấp, không chứng minh bằng 0. 19 câu được so lại với vùng cắt mới, 6 câu (2025 c19, c38 và c40 phần phương án C–D; 2026 c14, c29, c37 phần phương án) được so lại với lượt xem ảnh đầu do giới hạn 60 ảnh.

| Đề | Câu mẫu (trang) | Kết quả |
| --- | --- | --- |
| 2024 | 7 (tr.2), 12 (tr.2), 20 (tr.3), 25 (tr.3), 36 (tr.4), 38 (tr.4) | đúng |
| 2025 | 3, 6, 7 (tr.1), 13, 15, 19 (tr.2), 23, 29 (tr.3), 35, 38, 40 (tr.4) | đúng |
| 2026 | 6, 14 (tr.2), 21, 23, 24, 29 (tr.3), 35, 37 (tr.4) | đúng |

Sai lệch thật đã bắt được nhờ hai lượt (nên bị loại, không vào kho): lượt A gắn đoạn văn nhầm ở 2026 câu 2; lượt B bỏ chữ “of” ở 2025 câu 28; hai lượt khác gạch chân ở 2024 câu 4. Quy trình này không đảm bảo bắt được lỗi mà cả hai mô hình cùng mắc; owner vẫn cần duyệt từng câu.

Đã tìm nhưng không dùng được:
- `quantridongda.hanoi.edu.vn`, `file2.hanoi.edu.vn`: robots.txt `Disallow: /` — không tải.
- Bản đề TP.HCM đăng lại trên site trường `*.hcm.edu.vn`: tệp nằm dưới `/tai/` (bị robots.txt chặn) và là bản đăng lại của trường, không phải kênh công bố của Sở.
- Trang tin của Sở Đồng Nai (2025): chỉ có “gợi ý đáp án” do giáo viên cung cấp, không phải đáp án chính thức.
- Mọi kết quả còn lại là trang tổng hợp (bị cấm).

Chưa thêm nguồn nào ngoài danh sách đã duyệt.

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


## Reviewed bank promotion (Phase A)

Run `npm run build:tests` inside `web/` after owner review to explicitly promote the checked-in VOA quarantine bank. The crawler remains quarantine-only. The generator merges all fragments, writes published copies into `content/tests/bank-grade-{6..9}.json` plus tests-only `bank-entrance.json`, and never modifies quarantine. Unused resources and topics without tests are pruned; shared references resolve after merging output files.

Tests use fixed string seeds and publication date `2026-10-31T00:00:00.000Z`. Ordered `questionIds` and per-question `optionOrder` ABCD permutations reproduce both question and option order; the loader remaps the correct answer. Topic/mixed sets and the entrance set each avoid repeated question IDs. Entrance tests (`thi-vao-lop-10/de-K`) are grade 9, omit skill/topic metadata, and may reference grade 8/9 questions of any skill. The generator is the explicit reviewed promotion command, not an automatic crawler publishing path.


## Owner approval (2026-10-31)

The owner approved all quarantined VOA items for public display on 2026-10-31, subject to the deterministic guards below. Promotion records `reviewStatus: "published"`, `reviewNote: "owner-approved-bulk 2026-10-31"` and `reviewedAt: "2026-10-31T00:00:00.000Z"` on each published copy. `sourceUrl`, `sourceName`, `license` and `crawledAt` remain unchanged. Quarantine files are never edited.

## Guards

`web/scripts/lib/guards.ts` runs before any partitioning. The first matching reason wins, so counts sum to distinct excluded questions; excluded items are omitted from all published pools without editing their originals. `npm run build:tests` prints these counts before generating tests. Audit of the checked-in 2,589 quarantine questions:

| Reason | Excluded | Rule |
| --- | ---: | --- |
| `duplicate-options` | 0 | Any pair of options equals after lowercasing and removing punctuation/whitespace (retain Unicode letters and digits), including two distractors. |
| `cloze-inflection` | 2 | Only `content-cloze` / `reading-cloze` kinds parsed from `sourceRef`: a correct/distractor pair shares at least `max(4, max(lengths)-3)` initial letters and a root under simple `s`, `es`, `ed`, `ing` removal (minimum root length 4), or the explicit irregular `build/built` root. Base forms can match inflected forms. No arbitrary derivational or prefix-only match. |
| `cloze-equivalent` | 0 | Same cloze kinds: the correct option and a distractor are an alternate past/participle spelling pair from the small list below. |
| `verb-equivalent` | 0 | Only `verb-form`: `has`, `have` or `had` immediately precedes the blank, and both a correct participle and its alternate spelling are options. General verb-form/agreement guessing is skipped. |

The spelling pairs are `learned/learnt`, `dreamed/dreamt`, `burned/burnt`, `spilled/spilt`, `spoiled/spoilt`, and `kneeled/knelt`; each is a pair of alternate past/participle spellings. The separate `build/built` entry is an irregular inflection with a four-letter prefix, used only by the cloze stem guard. There are no broad synonym lists. `be/am/is/are/was/were`, `a/an`, and `much/many` are deliberately not treated as interchangeable because agreement, sound and countability can make one uniquely correct. `appealed/appeared` is retained: its shared prefix does not establish a shared root.

The two exclusions are `voa-d137037f` and `voa-dae9171e` (`built/build`, grade 9). The guards flag potential ambiguity, not a full linguistic judgment; they do not replace owner review. Vitest pins the reason counts and IDs, verifies unit examples and negative boundaries, checks filtering before partitioning, and reproduces generated files byte for byte even with reversed fragment order.

After excluding **2**, all **2,587** eligible questions appear in the regenerated bank:

| Grade | Published questions | Topic tests | Mixed tests | Entrance tests |
| --- | ---: | ---: | ---: | ---: |
| 6 | 893 | 41 | 83 | 0 |
| 7 | 1,084 | 50 | 98 | 0 |
| 8 | 386 | 17 | 36 | 0 |
| 9 | 224 | 9 | 21 | 15 |
| Total | 2,587 | 117 | 238 | 15 |

Entrance tests are grade 9 and draw from eligible grade 8/9 questions; these questions are stored only in the grade bank files. Total: **370 tests**.
