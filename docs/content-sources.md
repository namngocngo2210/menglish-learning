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
