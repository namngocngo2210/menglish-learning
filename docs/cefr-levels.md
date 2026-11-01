# Trình độ CEFR (ước tính) cho câu hỏi và đề — thiết kế + khả thi

> **Trạng thái: ĐỀ XUẤT, chỉ tài liệu** (thẻ t_16929b90). Không có mã tính năng, không đổi DB. Quyết định cần chủ duyệt: §9, ADR: [0004](adr/0004-cefr-estimated-levels.md).
>
> Quy ước số liệu: **[đo]** = chạy thật trên ngân hàng hiện tại (bản thử [`cefr/prototype.py`](cefr/prototype.py), kết quả [`cefr/prototype-run.txt`](cefr/prototype-run.txt), tất định, chạy lại cho cùng kết quả); **[ước]** = ước tính chưa đo; **[giả định]** = dev tự gán, chưa có nguồn.
>
> **Ràng buộc từ chủ (1/11):** chỉ dùng thang CEFR (Pre-A1, A1, A2, B1, B2). Không dùng tên các kỳ thi/chứng chỉ thương hiệu hay logo ở bất kỳ đâu (UI, dữ liệu, tài liệu, SEO, URL). Nhãn luôn là **trình độ ước tính**, không bao giờ là chứng nhận/chính thức.

## 1. Mục tiêu

1. **Chiều "trình độ"** trực giao với lớp (6–9, sau này 1–5) và kỹ năng/chủ đề: một câu lớp 6 có thể là B1, một câu lớp 9 có thể là A2. Trình độ **không** thay thế lớp, không đổi URL đề hiện có.
2. Học sinh: lọc đề/câu theo trình độ; thấy huy hiệu "trình độ ước tính A2" trên đề; **mixer** trộn đề theo trình độ (`levelMix`, `levelRange`).
3. Nội dung lớp 1–5 sau này cần Pre-A1/A1 — thang phải mở rộng được mà không đổi cấu trúc (xem §2.6: Pre-A1 hiện **không** ước tính được tin cậy).
4. Phụ huynh/giáo viên: biết đề "chủ yếu A2" để chọn bài; nhưng **không** hứa tương đương chứng chỉ.

Không-mục tiêu: chấm trình độ cá nhân học sinh, thi thử theo chứng chỉ, dùng LLM, logo/tên thương hiệu thi.

## 2. Nguồn dữ liệu để ước tính (không dùng danh sách có bản quyền của nhà xuất bản)

| Nguồn | Giấy phép / điều khoản (đã đọc) | Dùng? |
|---|---|---|
| **CEFR-J Wordlist v1.6** (Tono Lab, ĐH Ngoại ngữ Tokyo; 7.801 mục A1–B2) | Trang tải của CEFR-J: bản quyền thuộc Tono Lab, "dùng được cho nghiên cứu **và thương mại** với ghi nguồn đúng"; cho phép sửa để tạo bảng khác nếu vẫn ghi nguồn. **Nhưng** phần miễn trừ ghi: "với thương mại, chi phí cần thiết sẽ tính sau khi bàn riêng" (bản JP: áp dụng khi họ tham gia giám tu). Hai câu này không trùng khớp hẳn ⇒ **mơ hồ** — [cefr-j.org/download_eng.html](https://www.cefr-j.org/download_eng.html). Bản sao v1.5 trên GitHub ([openlanguageprofiles/olp-en-cefrj](https://github.com/openlanguageprofiles/olp-en-cefrj)) ghi: "dùng cho nghiên cứu và thương mại, miễn phí, miễn trích dẫn đúng". Lưu ý: CEFR-J được soạn từ giáo trình Trung/Hàn/Đài và **đối chiếu với English Vocabulary Profile** để bổ sung từ — rủi ro dòng dõi (§6). | **Có điều kiện**: dùng để đo thử (đã làm); lên production chỉ sau khi chủ gửi email xin xác nhận thương mại bằng văn bản (D1). Ghi nguồn: *The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.* Không đưa nguyên bảng vào repo. |
| **CEFR-J Grammar Profile** (20180315, ~500 mục) | Cùng điều khoản với kho OLP ở trên (miễn phí nghiên cứu/thương mại, trích dẫn). Điều khoản riêng trên trang gốc không có trong phần đã đọc — [chưa xác nhận]. Cột `EGP` trong file là dữ liệu của nhà xuất bản khác ⇒ **không dùng cột đó**, chỉ cột `CEFR-J Level`. Nhiều mục có số lệch (vd. "I am" A1.1 nhưng "you are" B1.1), nên chỉ dùng làm **căn cứ định hướng**, không làm chân lý. | **Có điều kiện** như trên; chỉ dùng cột `CEFR-J Level`. |
| **English Vocabulary Profile (EVP)** / English Grammar Profile | Điều khoản trang của nhà xuất bản đại học Anh (liên kết từ englishprofile.org): chỉ dùng cá nhân phi thương mại; **cấm** sao chép/scrape/lưu thành CSDL ("Only use … for personal, non-commercial purposes", "'Scrape' or store content … create an electronic database"; cập nhật 8/2022). | **KHÔNG DÙNG.** Cũng không dùng Oxford 3000/5000 (OUP). |
| **Tần suất từ — OpenSubtitles 2018** (`hermitdave/FrequencyWords`, `en_50k`) | Mã MIT; **nội dung CC-BY-SA-4.0** (README repo). Share-alike: bảng dẫn xuất công bố lại có thể phải CC-BY-SA. Dữ liệu gốc OPUS cho phép dùng kèm ghi nguồn. | Dùng để đo thử và làm **dự phòng**; nếu dùng sản xuất chỉ giữ *điểm số* của từng câu (không phát hành lại bảng hạng) và ghi nguồn. |
| **wordfreq** (R. Speer) | Mã Apache-2.0; dữ liệu CC-BY-SA-4.0, gồm Google Books Ngrams ("dùng tự do cho mọi mục đích, nên ghi nguồn"), Wikipedia, OpenSubtitles, SUBTLEX (đã được tác giả cho phép dùng mọi mục đích, phải ghi nguồn) — NOTICE.md. Dữ liệu dừng ~2021. | Phương án thay thế tần suất (cần thêm dependency ⇒ ADR theo engineering-standards). |
| **Ngữ liệu tự có**: VOA Learning English (public domain) + nguồn chính thức | Đã được repo xác định là public domain (`sources.license`). | Dự phòng sạch giấy phép nhất: tần suất tự tính từ toàn bộ VOA đã crawl (thiên về tin tức; mẫu nhỏ hơn). |
| **Công thức độ đọc** (Flesch-Kincaid, độ dài câu, âm tiết) | Công thức công khai, tự tính trên văn bản của ta. | **Có**, nhưng chỉ ổn định ở đoạn văn; câu ngắn thì nhiễu (§3). |
| **Luật ngữ pháp** (classifier chủ đề đã gán `grammar-*`) | Luật của ta; **band** lấy từ CEFR-J Grammar Profile (bảng §3.3). | **Có.** |

### 2.5 Kết luận trung thực về danh sách từ

Có **một** danh sách từ cấp CEFR dùng hợp lý được (CEFR-J), nhưng điều khoản thương mại **chưa đủ rõ** để kết luận "an toàn" — cần xác nhận văn bản. **Nếu bị từ chối/không được trả lời**, phương án dự phòng là dải hạng tần suất lấy từ ngữ liệu có giấy phép (OpenSubtitles hoặc VOA tự tính). Độ chính xác dự phòng **thấp hơn rõ rệt**: trên ngân hàng thật, phương pháp chỉ-tần-suất so với phương pháp chính có tương quan hạng Spearman **0,53**, trùng đúng bậc **35,4%**, lệch ≤ 1 bậc **84,1%** [đo] (đây là độ nhất quán giữa hai phương pháp, không phải độ chính xác tuyệt đối). Khi đó chỉ nên công bố dải rộng ("A2–B1") chứ không nhãn từng câu.

### 2.6 Pre-A1

CEFR-J chỉ có A1–B2. **Pre-A1 không có nguồn từ vựng có giấy phép** và ngân hàng lớp 6–9 hiện có **0 câu** Pre-A1 [đo]. Đề xuất: giữ nhãn Pre-A1 trong thang/CSDL nhưng chỉ gán bằng luật hẹp (điểm < 0,95 *và* câu ≤ 5 từ, toàn từ thuộc ~300 từ tần suất cao nhất *và* CEFR-J A1); với nội dung lớp 1–5 sau này, cần nguồn khác (giáo viên đánh nhãn) — ghi vào D5.

## 3. Thuật toán (tất định, giải thích được, không LLM)

### 3.1 Đầu vào mỗi câu

- Văn bản đánh giá = **câu dẫn đã điền đáp án đúng**. **Phương án nhiễu KHÔNG BAO GIỜ được tính** (như bản sửa classifier chủ đề: nhiễu cố tình sai/lạ nên làm lệch).
- Token: chữ cái; bỏ danh từ riêng (từ viết hoa không đầu câu) và số; bỏ ~100 từ chức năng; chuẩn hoá về gốc bằng bảng bất quy tắc + luật hậu tố (-s/-es/-ies/-ed/-ing/-er/-est/-ly/-ment/-ness).
- Cấp từ: tra CEFR-J (lấy **cấp thấp nhất** nếu từ có nhiều từ loại — nới lỏng, tránh đánh giá quá cao); không có → theo hạng tần suất: ≤ 2000 ⇒ A2, ≤ 5000 ⇒ B1, còn lại/không thấy ⇒ B2. Thang số: A1=1, A2=2, B1=3, B2=4.
- Thành phần: `lex` = bách phân vị 90 cấp từ nội dung (nhạy với từ khó nhất); `sent` = độ dài câu trung bình (từ) nội suy tuyến tính (4→0,5; 7→1; 11→2; 16→3; 22→4); với bài đọc: `fk` = Flesch-Kincaid grade (2→0,5; 4→1; 6→2; 8→3; 11→4), `rare` = tỷ lệ từ ≥ B1 (3%→1; 8%→2; 15%→3; 25%→4).

### 3.2 Công thức điểm S (0–4), theo kỹ năng

| Kỹ năng | S = tổng có trọng số / tổng trọng số |
|---|---|
| từ vựng | 0,45 × cấp **từ đích** (đáp án đúng; max nếu nhiều từ) + 0,30 × `lex` + 0,25 × `sent` |
| ngữ pháp (có luật `grammar-*`) | 0,40 × band ngữ pháp + 0,35 × `lex` + 0,25 × `sent` |
| ngữ pháp (chưa phân loại)/viết câu | 0,60 × `lex` + 0,40 × `sent` |
| đọc hiểu | 0,50 × điểm **bài đọc** + 0,30 × `lex` câu hỏi+đáp án + 0,20 × `sent` (không có bài ⇒ 0,6/0,4 như trên) |
| **bài đọc** | 0,35 × `rare` + 0,25 × `fk` + 0,25 × `sent` + 0,15 × `lex` |

Bài đọc tính **một lần**, mọi câu của bài kế thừa 50%: câu về bài khó không bị kéo xuống chỉ vì câu hỏi ngắn.

### 3.3 Band ngữ pháp (ánh xạ chủ đề → CEFR, nguồn CEFR-J Grammar Profile `CEFR-J Level`)

| Luật classifier | Band | Căn cứ |
|---|---|---|
| be / tính từ sở hữu / mạo từ | 1 (A1) | mục 58 A1.1; 13–14 A1.1; sở hữu **[giả định]** |
| giới từ, câu hỏi, hiện tại đơn/tiếp diễn, quá khứ đơn, to-V | 1–1,5 (A1) | mục 21 A1.1; 61 A1.3; 65 A1.3; 101 A1.2 (88 A1.1, nhưng "not to do" B1.2 ⇒ 1,5); giới từ/câu hỏi nâng **[giả định]** |
| so sánh | 2 (A2) | 38 A1.3, 39 A2.2, 41 A2.1, "as…as" 37 B2.1 |
| will, quá khứ tiếp diễn, hiện tại hoàn thành | 2 (A2) | 141 A2.2; 66 A2.1; 62 A2.1 |
| bị động | 2,5 | 76 A2.1; 73 A1.2; 75 (hoàn thành) B2.1 |
| khuyết thiếu | theo từ: can 1; will/should/would 2; must/could/may/might 3 | 123 A1.2; 141 A2.2; 139 A2.1; 142 A2.1; 135 B1; 124/129/132 B1.1 |
| điều kiện, quá khứ hoàn thành | 3 (B1) | 215 (loại 2) B1.2; 67 B1.2 |

Hạn chế: phần đã đọc không có mục "điều kiện loại 1/0" và "hiện tại đơn" riêng cho mọi biến thể; band chỉ là thô.

### 3.4 Điểm → bậc, độ tin cậy, lý do

- Ngưỡng: S < 0,95 Pre-A1; < 1,65 A1; < 2,35 A2; < 3,05 B1; còn lại B2. **S đúng bằng ngưỡng ⇒ bậc cao hơn** (tie-break). S > 4 vẫn gán B2 (chặn trên), confidence × 0,7.
- `level_confidence` ∈ [0,1] = min(1, khoảng cách tới ngưỡng gần nhất / 0,35) × (1 − min(0,5, độ lệch giữa các thành phần / 6)); gần ngưỡng hoặc các thành phần mâu thuẫn ⇒ thấp.
- `level_reason` (jsonb): `{method:"cefr-est-v1", parts:{target,lex,sent,gram|passage}:[giá trị,trọng số], hard_words:[…tối đa 6], grammar_rule, score}` — đủ để reviewer hiểu vì sao.
- Ghi đè người: cột `level_reviewed` (nếu có thì thắng, `level_confidence=1`); lần chạy lại **không** ghi đè giá trị đã duyệt.

### 3.5 Cấp độ của ĐỀ

Cho mỗi đề: `level_median` (trung vị bậc các câu), `level_p25`, `level_p75`, `level_dist` (số câu mỗi bậc). **Hiển thị = dải** `p25–p75` (vd. "A2–B1", hoặc "A2" nếu trùng) + "chủ yếu <median>". Đề là hỗn hợp nên trung vị đơn lẻ che mất độ phân tán: chỉ **58/316** đề có ≥ 70% câu cùng một bậc [đo] ⇒ không hiển thị một nhãn duy nhất như thể đề đồng nhất.

## 4. Đo thật trên ngân hàng hiện tại (prototype estimate)

Dữ liệu: `web/content/tests/bank-grade-{6..9}.json`, đọc chỉ-đọc: **2.698 câu = 2.587 VOA + 111 chính thức (thi vào 10 Hà Nội)**, 50 bài đọc, 316 đề; chạy dưới `heavy` (800 MB), 1 lượt vài giây. *(Thẻ nói 2.589 VOA: 2 câu bị guard loại nên không có trong bank đã xuất bản, xem blueprint §0.)* Phân loại ngữ pháp dùng `topicSlug` đã được classifier gán trong bank. Tất cả số liệu dưới đây là **ước tính bản thử**, chưa kiểm chứng bởi chuyên gia.

### 4.1 Phân bố bậc (số câu, %)

| Phạm vi | n | Pre-A1 | A1 | A2 | B1 | B2 | S trung bình |
|---|---:|---:|---:|---:|---:|---:|---:|
| VOA tất cả | 2.587 | 0 | 420 (16,2%) | 983 (38,0%) | 901 (34,8%) | 283 (10,9%) | 2,28 |
| VOA lớp 6 | 893 | 0 | 259 (29,0%) | 367 (41,1%) | 224 (25,1%) | 43 (4,8%) | 2,01 |
| VOA lớp 7 | 1.084 | 0 | 131 (12,1%) | 446 (41,1%) | 396 (36,5%) | 111 (10,2%) | 2,31 |
| VOA lớp 8 | 386 | 0 | 15 (3,9%) | 99 (25,6%) | 193 (50,0%) | 79 (20,5%) | 2,63 |
| VOA lớp 9 | 224 | 0 | 15 (6,7%) | 71 (31,7%) | 88 (39,3%) | 50 (22,3%) | 2,55 |
| **Chính thức (vào 10)** | 111 | 0 | 7 (6,3%) | 49 (44,1%) | 37 (33,3%) | 18 (16,2%) | 2,39 |
| theo kỹ năng (VOA): ngữ pháp / từ vựng / đọc hiểu / viết câu | 421/1253/870/43 | 0 | 13,5/27,5/2,1/0 % | 51,3/41,3/27,2/30,2 % | 31,8/22,3/54,5/32,6 % | 3,3/8,9/16,2/37,2 % | 2,19/2,07/2,59/2,75 |

Bài đọc (50): A2 = 9, B1 = 29, B2 = 12. Đề (316) theo trung vị: A1 28, A2 153, B1 127, B2 8; 58 đề có ≥ 70% câu cùng bậc.

### 4.2 Kiểm tra hợp lý (sanity)

- **Lớp 6 thấp hơn lớp 9: ĐẠT một phần.** Xác suất một câu lớp 9 ngẫu nhiên điểm cao hơn một câu lớp 6 ngẫu nhiên = **0,739** [đo]; điểm trung bình tăng 2,01 → 2,31 → 2,63 từ lớp 6 → 8. **Nhưng lớp 9 (2,55) thấp hơn lớp 8 (2,63)** — không đơn điệu. Lý do khả dĩ [chưa kiểm]: lớp 9 chỉ có 224 câu VOA với tỷ lệ kỹ năng khác, và VOA không viết theo chương trình lớp nên "lớp" trong bank là gán thủ công.
- **Đề chính thức vào 10 ≈ A2–B1: ĐẠT tương đối.** 77,5% (86/111) rơi vào A2–B1, trung vị A2; 16,2% là B2 (chủ yếu câu từ vựng: 11/32 là B2) và 6,3% A1. Ở cấp đề: 21 đề thi vào 10 có trung vị **B1 = 17, A2 = 4** [đo] — đúng dải A2–B1 kỳ vọng. Chưa đủ để kết luận phần từ vựng chính thức khó hơn dự kiến.
- **Đề theo lớp (trung vị, không tính đề vào 10):** lớp 6 (102 đề): A1 26 / A2 54 / B1 22; lớp 7 (121): A1 2 / A2 76 / B1 42 / B2 1; lớp 8 (45): A2 9 / B1 31 / B2 5; lớp 9 (27): A2 10 / B1 15 / B2 2 [đo] — ở cấp đề thứ tự lớp 6 < 7 < 8 rõ hơn cấp câu.
- **Không có Pre-A1** (xem §2.6). **Độ tin cậy thấp là phổ biến:** trung bình 0,39; 1.066/2.698 câu (39,5%) có confidence < 0,3 [đo].

### 4.3 Kiểm toán ngẫu nhiên: mẫu 30 câu/bậc + tiêu chí độc lập

- Mẫu: [`cefr/audit-sample.csv`](cefr/audit-sample.csv) — 30 câu mỗi bậc A1/A2/B1/B2 (seed 20261101; **Pre-A1 không có câu để rút**), 120 dòng, có cột `reviewer_level`/`reviewer_note` để điền.
- **Tiêu chí độc lập (máy):** ước tính chỉ-tần-suất (không dùng CEFR-J). Spearman 0,53; trùng đúng 35,4%; lệch ≤ 1 bậc 84,1% [đo]. Đây là kiểm tra nhất quán, **không** phải độ chính xác.
- **Đọc thử của dev (không phải chuyên gia, 8 câu × 4 bậc = 32 câu, rút ngẫu nhiên từ mẫu trên):** đồng ý đúng bậc **14/32 (44%)**, lệch tối đa 1 bậc **32/32**. Nhận xét: câu A1 thường nên là A2; câu B1 chứa tên riêng/từ lịch sử bị đánh thấp/cao thất thường; một số "B2" thực chất B1 vì một từ B2 đơn lẻ. ⇒ Bản thử là **công cụ phân dải thô (±1 bậc)**, chưa đủ tin để dán nhãn từng câu như sự thật.
- **Quy trình kiểm toán người thật (chủ không phải chuyên gia) — checklist cho người duyệt** (giáo viên tiếng Anh nếu có; nếu không, 2 người duyệt độc lập, chưa xem nhãn máy):
  1. Đọc câu (đã điền đáp án). Tra từ lạ trong CEFR-J (công khai) hoặc từ điển; ghi cấp từ khó nhất.
  2. **A1:** câu rất ngắn (≤ 7 từ), từ đời sống rất quen, hiện tại đơn/to be/có thể (can). **A2:** chủ đề quen thuộc, thì đơn giản, nối bằng and/but/because, ≤ ~12 từ. **B1:** văn bản liền mạch, ý kiến/giải thích, hoàn thành/bị động/điều kiện, vài từ trừu tượng. **B2:** từ trừu tượng/học thuật, câu dài phức hợp, suy luận.
  3. Chọn **một bậc**; nếu phân vân giữa hai bậc, chọn bậc **thấp** và ghi "?".
  4. Báo cáo: tỷ lệ trùng đúng, trùng ±1, và weighted kappa giữa 2 người duyệt (mục tiêu ≥ 0,6 để bộ nhãn người đáng tin) rồi so với máy. **Mục tiêu cho bản sản xuất [đề xuất]: ≥ 60% trùng đúng và ≥ 95% ±1 so với bộ nhãn người** trước khi hiển thị nhãn từng câu.
- Mọi con số này gọi là **"độ chính xác bản thử (prototype estimate)"** trên UI nội bộ/docs; không nói "chính xác X%" công khai.

## 5. Tác động schema / API / UI

### 5.1 DB (migration mới ở **S-C**, khi có admin để ghi đè; S-A đã xây — `questions.difficulty` smallint 1–3 và `passages.level` smallint 1–5 **giữ nguyên**: `passages.level` là cấp của nguồn VOA, không phải CEFR)

```sql
-- questions, passages
level_estimated  smallint CHECK (level_estimated BETWEEN 0 AND 4),   -- 0=Pre-A1 … 4=B2
level_score      numeric(3,2),
level_confidence numeric(3,2) CHECK (level_confidence BETWEEN 0 AND 1),
level_reason     jsonb,                 -- {method, parts, hard_words, grammar_rule}
level_method     text,                  -- 'cefr-est-v1'
level_reviewed   smallint CHECK (level_reviewed BETWEEN 0 AND 4),   -- người duyệt, thắng khi có
level_reviewed_at timestamptz
-- tests
level_median smallint, level_p25 smallint, level_p75 smallint, level_dist jsonb, level_method text
CREATE INDEX questions_level_idx ON questions (grade, skill, COALESCE(level_reviewed, level_estimated)) WHERE review_status='published';
CREATE INDEX tests_level_idx ON tests (level_median, grade) WHERE published_at IS NOT NULL;
```

Tính ở worker/importer (hàm thuần trong `packages/core/cefr`, có golden-vector test), **không** ở request. `level_*` của đề tính lại khi đề được tạo/xuất bản. Có view `v_public_*` thêm cột để role `bj_web` đọc.

### 5.2 Mixer / API

- `mixer_presets.config` thêm `levelMix` (trọng số theo bậc, như `difficultyMix`) và `levelRange` (`min`,`max`); `MixOptions` thêm hai field tương ứng (tất định, cùng seed ⇒ cùng đề; seed của đề hiện có **không đổi** khi không dùng level).
- API công khai đọc (OpenAPI): thêm `level` (bộ lọc) vào danh sách đề; trả `level: {median,p25,p75,dist,estimated:true}`. Không lộ `level_reason` công khai.

### 5.3 URL & SEO

- **Giai đoạn 1: không trang indexable theo trình độ.** Bộ lọc là tham số (`?trinh-do=a2`), `rel=canonical` về trang không lọc, `noindex,follow` cho biến thể lọc; URL đề `/lop-6/...` không đổi. Lý do: các trang trình độ chỉ là tập con đề đã có ⇒ rủi ro nội dung mỏng/trùng; nhãn còn là bản thử.
- **Giai đoạn 2 (sau xác nhận bằng người):** nếu muốn, cho phép `/trinh-do/a1|a2|b1|b2` (Pre-A1 chỉ khi đủ nội dung) **chỉ khi** mỗi trang có ≥ 10 đề, văn bản giới thiệu riêng (cách đọc nhãn ước tính, ví dụ từ/ngữ pháp điển hình do ta viết, liên kết lên lớp→kỹ năng→chủ đề→đề), và JSON-LD `BreadcrumbList`; nếu không thì giữ noindex. Quy tắc nội dung SEO: luôn dùng "trình độ ước tính", không "chuẩn/chứng chỉ/tương đương kỳ thi", không tên kỳ thi, không logo.
- Sitemap: không thêm URL lọc; thêm `/trinh-do/*` chỉ khi giai đoạn 2 bật.

### 5.4 UI (chữ, thương hiệu BeeJunior; hiện thực bởi Claude brief → Codex theo CLAUDE.md repo)

- **Huy hiệu** trên thẻ đề và đầu đề: viên thuốc nhỏ, nền vàng nhạt, chữ mực `#291e1c` (độ tương phản ≥ 4,5:1), nội dung "Trình độ ước tính A2" (hoặc "A2–B1"); có `title`/popover "Ước tính tự động, có thể lệch 1 bậc" + liên kết "Cách ước tính". Không dùng sắc xanh/đỏ để diễn đạt "tốt/xấu" ⇒ tránh gợi ý đánh giá học sinh.
- **Bộ lọc**: nhóm nút bậc A1/A2/B1/B2 (mục tiêu chạm ≥ 44 px, focus nhìn thấy, `aria-pressed`), cạnh bộ lọc kỹ năng; "Tất cả" mặc định.
- Trang kết quả/luyện: không hiển thị nhãn cho từng câu ở giai đoạn 1 (chỉ ở đề); ẩn khi `level_confidence` của đề < ngưỡng (D4).

## 6. Rủi ro / pháp lý

| Rủi ro | Giảm thiểu |
|---|---|
| Giấy phép CEFR-J mơ hồ về thương mại | Email Tono Lab xin xác nhận bằng văn bản **trước** production (D1); dự phòng tần suất (§2.5); không đưa bảng từ vào repo; ghi nguồn đúng mẫu trong trang "Cách ước tính". |
| Dòng dõi EVP trong CEFR-J (đối chiếu để bổ sung từ) | Chấp nhận như CEFR-J tự công bố quyền sở hữu; ghi vào ADR; không dùng cột `EGP`/cột có nhãn nhà xuất bản khác; nếu có khiếu nại ⇒ chuyển phương án tần suất. |
| Nhãn sai gây hiểu lầm (HS/phụ huynh) | Luôn "ước tính", hiển thị **dải**, ẩn khi confidence thấp, không kèm lời hứa thi cử; người duyệt ghi đè; chỉ bật nhãn công khai sau ngưỡng §4.3. |
| Tên/logo kỳ thi | Lint ở CI chặn danh sách chuỗi cấm (tên các kỳ thi/chứng chỉ thương hiệu và nhà xuất bản liên quan) ở `web/`, dữ liệu, docs; danh sách đặt trong tệp cấu hình của CI, không lặp lại trong tài liệu — xem tiêu chí (6) ở §7. |
| Quyền riêng tư | Không thu dữ liệu cá nhân; nhãn là thuộc tính nội dung, không phải hồ sơ học sinh. |
| Bảo trì | Chạy lại khi ngân hàng tăng/đổi phiên bản `level_method`; chỉ ghi vào dòng chưa có `level_reviewed`; lưu phiên bản bảng từ; báo cáo phân bố sau mỗi lần chạy. |

**Câu miễn trừ (VI) cho trang "Cách ước tính" và chân đề:** *"Trình độ CEFR trên BeeJunior là ước tính tự động từ từ vựng, độ dài câu và ngữ pháp của chính nội dung. Đây không phải kết quả đánh giá, chứng chỉ hay thang điểm chính thức, và có thể lệch khoảng một bậc. Hãy dùng như gợi ý để chọn bài."*

## 7. Kế hoạch triển khai

| Bước | Nội dung | Ước (ngày agent) | Test |
|---|---|---|---|
| L-0 | Chủ trả lời D1–D6; email xin xác nhận CEFR-J | — | — |
| L-1 | `packages/core/cefr` (hàm thuần: token/lemma/band/score/confidence/reason, đọc bảng từ từ tệp ngoài repo hoặc gói dữ liệu đã duyệt), lệnh CLI `cefr:estimate` trong `api` | 3–4 | unit; golden-vector từ 150 câu đã gán; tính tất định; không đọc nhiễu; coverage `core` ≥ 90% |
| L-2 | Migration `level_*` + backfill + ghi đè ở admin (S-C), tính `level_*` cho đề khi xuất bản | 2–3 (trong S-C) | migration up/down; backfill idempotent; property: đề `p25 ≤ median ≤ p75` |
| L-3 | Mixer `levelMix/levelRange`, API lọc, huy hiệu + bộ lọc (S-B/S-E) | 3–4 | mixer tất định, parity URL đề cũ = 0 chênh; e2e Playwright 390 & 1440; a11y; SEO checklist |
| L-4 | Kiểm toán người 150 câu (2 người), hiệu chỉnh ngưỡng/trọng số, báo cáo | 1–2 + công người duyệt | báo cáo trùng/±1/kappa; chỉ bật nhãn công khai khi đạt §4.3 |

Tổng **≈ 9–13 ngày agent [ước]**, chưa tính thời gian duyệt/tester/reviewer. Chỗ gắn: L-1 độc lập (sau S-A), L-2 vào S-C, L-3 vào S-B/S-E; không chặn chuỗi S-A→S-F hiện tại.

**Tiêu chí nghiệm thu:** (1) hàm tất định, cùng đầu vào ⇒ cùng đầu ra; (2) nhiễu không bao giờ được đọc (test chứng minh); (3) mỗi câu/bài/đề có `level_*` đầy đủ + `level_reason`; (4) ngân hàng thật: báo cáo phân bố + 0 câu thiếu nhãn; (5) trên bộ nhãn người: ≥ 60% trùng đúng và ≥ 95% ±1 (nếu không, chỉ hiển thị dải ở đề); (6) CI chặn chuỗi cấm; (7) trang lọc có `noindex`/canonical, Lighthouse giữ ngưỡng; (8) ghi nguồn CEFR-J đúng mẫu.

## 8. Giới hạn của bản thử (nói rõ)

Một người đọc thử không chuyên gia (n=32); tiêu chí độc lập là máy; ngân hàng thiên về tin tức VOA; band ngữ pháp thô và 4 giá trị là [giả định]; Pre-A1 không đo được; lớp 9 thấp hơn lớp 8; mẫu 30 câu/bậc chỉ cho khoảng tin cậy rộng (±~18 điểm % ở p=50%) [ước]. Kết luận: **khả thi làm bộ lọc/dải đề thô; chưa đủ để dán nhãn từng câu như sự thật** cho tới khi có bộ nhãn người.

## 9. Quyết định cho chủ (kèm đề xuất)

| # | Quyết định | Đề xuất |
|---|---|---|
| D1 | Xin xác nhận thương mại CEFR-J bằng văn bản trước production? | **Có** — gửi email Tono Lab; trong lúc chờ làm L-1 với bảng từ ngoài repo. Nếu không được ⇒ dự phòng tần suất, chỉ hiển thị dải. |
| D2 | Hiển thị nhãn ở mức nào? | **Chỉ cấp đề, dạng dải** (A2–B1); nhãn từng câu chỉ trong admin/mixer. |
| D3 | Trang `/trinh-do/*` indexable? | **Chưa** (giai đoạn 1: lọc `noindex`, canonical); xét lại sau xác nhận bằng người. |
| D4 | Ngưỡng ẩn nhãn theo confidence | Ẩn nhãn đề khi < 50% câu có confidence ≥ 0,3; ngưỡng hiệu chỉnh ở L-4. |
| D5 | Pre-A1 / lớp 1–5 | Giữ nhãn trong schema; gán thủ công bởi giáo viên cho nội dung lớp 1–5 khi có. |
| D6 | Ai duyệt 150 câu? | Một giáo viên tiếng Anh (ưu tiên) hoặc 2 người dùng checklist §4.3; ~3–4 giờ. |
| D7 | Nguồn tần suất sản xuất nếu cần dự phòng | VOA tự tính (sạch giấy phép) hoặc OpenSubtitles (CC-BY-SA, chỉ giữ điểm). |

## 10. Tái lập

Tải về ngoài repo: `cefrj-vocabulary-profile-1.5.csv` và `cefrj-grammar-profile-20180315.csv` từ `openlanguageprofiles/olp-en-cefrj`, `en_50k.txt` từ `hermitdave/FrequencyWords` (2018/en). Đặt vào `$CEFR_WORK/data/` rồi chạy [`cefr/prototype.py`](cefr/prototype.py) dưới `heavy`. Kết quả mẫu: [`cefr/prototype-run.txt`](cefr/prototype-run.txt).
