# Thiết kế lại bên trong các loại đề (inside-v2) — mockup, chưa đổi code production

Phạm vi: trang kỹ năng `/lop-6/doc-hieu`, trang chủ đề `/lop-6/doc-hieu/chung`, trang đề `.../chung/de-1`, và chế độ đề ngẫu nhiên (không có route riêng — là `RandomQuiz` chạy ngay trên trang chủ đề/trang đề).
Trước = ảnh chụp site thật (beejunior.meducation.vn, Chrome, 390 và 1440). Sau = HTML tĩnh `after-*.html` (sinh bằng `build-mockups.py`, CSS `assets/styles.css`, cùng token/header/footer với `docs/previews/home-v2`). Ảnh: `png/before-*` và `png/after-*`. Số đo thô: `audit.json`.

## Ý tưởng thiết kế (brief)
1. Mỗi thông tin xuất hiện MỘT lần. H1 mang ngữ cảnh; dưới H1 là đúng 1 dòng `N đề · N câu · …`. Bỏ kicker "BeeJunior · Luyện tập tiếng Anh" (đã có logo), bỏ dải hero cao.
2. Breadcrumb 1 dòng: mobile `… › Đề dài › Đề 1` (dấu `…` là link 44px về cấp trên, các cấp giữa ẩn bằng CSS; JSON-LD vẫn đủ cả chuỗi). Từ 640px hiện đủ.
3. Hướng dẫn chỉ ở MỘT chỗ: `Cách làm ▾` (details) cạnh dòng ngữ cảnh. Bỏ đoạn mở đầu và hộp "Bài luyện của em" lặp.
4. Thẻ đề chỉ chứa phần khác nhau: `Đề N`, `N câu · ~X phút`, trạng thái (localStorage: `✓ Tốt nhất 18/22`, `Đang làm dở`; chỗ trống giữ chiều cao → CLS 0). Lưới 2 cột mobile / 3–4 cột desktop.
5. Trang đề: thanh sticky gọn `0/22 câu` + thanh tiến độ + `Tổng quan` + `Nộp bài` + menu `⋯`. "Tạo phòng từ đề này" / "Làm đề ngẫu nhiên" nằm trong menu `⋯` và lặp lại một lần ở cuối trang (nút phụ, viền) — không còn trước câu 1. Desktop: bài đọc (sticky) bên trái, câu hỏi bên phải; mobile: bài đọc rồi câu hỏi (giữ thứ tự passage → questions).
6. A11y: nút ≥44px, focus ring giữ nguyên, tương phản token BeeJunior (ink #291e1c trên vàng #ffc001; xanh #0a6590 trên nền kem), `progressbar` có `aria-*`, `prefers-reduced-motion` không bị ảnh hưởng (không animation mới). Không có ảnh/phông mới ⇒ Perf không đổi; không phần tử nào thay đổi kích thước sau hydrate ⇒ CLS 0 (trạng thái localStorage có chỗ giữ sẵn).

## Bảng kiểm toán chữ (mobile 390; số đo bằng Chrome)
"Lặp" = tổng số lần lặp thừa của 11 cụm (`lớp 6`, `đọc hiểu`, `bài luyện`, `tổng hợp`, `câu hỏi`, `đáp án`, `nộp bài`, `kiểm tra`, `giải thích`, `không giới hạn thời gian`, `luyện tập tiếng anh`) = Σ max(0, lần−1) trên chữ nhìn thấy của `<main>`.

| Trang | Ký tự thấy được trước → sau | Ký tự trong DOM (kể cả gập) trước → sau | Cao px 390 trước → sau | Cao px 1440 trước → sau | Cụm lặp thừa trước → sau |
|---|---|---|---|---|---|
| Kỹ năng | 935 → 290 | 2006 → 642 | 2676 → 970 | 1655 → 900 | 24 → 1 |
| Chủ đề | 1512 → 504 | 2593 → 740 | 4676 → 1451 | 2780 → 1021 | 83 → 0 |
| Đề | 4083 → 1391* | 12041 → 1538* | 9649 → 2817* | 4171 → 1571* | 30 → 0 |
| Đề ngẫu nhiên | 4214 → 1344* | 14315 → 1494* | 10470 → 2602* | 4562 → 1404* | 90 → 0 |

\* Mockup trang đề/ngẫu nhiên chỉ minh họa bài đọc 1 (rút gọn) + 3 câu, nên tổng chiều cao/ký tự KHÔNG so trực tiếp được. So sánh đúng là hai dòng dưới:

| Trang đề (mobile 390) | Trước | Sau |
|---|---|---|
| Px từ đầu trang tới câu 1 | 4222 (1440: 950) | 1432 (1440: 345) |
| Ký tự "văn bản của site" ngoài bài đọc + câu hỏi | 1027 | 250 |
| Đoạn hướng dẫn lặp | 3 lần | 1 lần (gập) |
| Đề ngẫu nhiên: px tới câu 1 | 3278 (1440: 958) | 1438 (1440: 345) |
| Đề ngẫu nhiên: ký tự văn bản site ngoài bài/câu* | 1994 (gồm cả danh sách đề phía dưới) | 203 |

Trên mobile, bài đọc dài vẫn đứng trước câu 1 nên px tới câu 1 không thể về ~0; muốn giảm thêm có thể kẹp bài đọc ~12 dòng + "Đọc hết" (chưa làm trong mockup, cần JS — để vòng sau nếu chủ muốn).

## Dữ liệu bị trùng / chồng tên (đo trên site thật)
`chung` ("Tổng hợp") chỉ có ở **đọc hiểu** (lớp 6/7/8/9: 12/15/6/3 đề, đề ~20 câu). `tong-hop` ("Tổng hợp Đọc hiểu", 22/27/13/6 đề, đề ~10 câu) được `build-bank.ts` sinh cho MỌI kỹ năng từ TOÀN BỘ câu hỏi của kỹ năng đó (gồm cả các câu của `chung`) ⇒ cùng ngân câu hỏi, cắt lại thành đề khác. Hậu quả: hai thẻ tên gần giống, hai bộ URL gần trùng nội dung (rủi ro nội dung trùng), và FAQ nói sai "chia theo 1 chủ đề và phần tổng hợp".
- Đọc hiểu (4 lớp): `chung` ≡ `tong-hop` về nguồn câu hỏi, khác về độ dài đề.
- Từ vựng (lớp 6–9): chỉ có `tong-hop` (46/52/17/10 đề) ⇒ trang kỹ năng chỉ có 1 thẻ "Tổng hợp Từ vựng": cấp chủ đề thừa.
- Viết câu lớp 6/7: `sap-xep-tu` (1 đề) và `tong-hop` (1–2 đề) cùng ngân câu hỏi; lớp 8/9 không có trang.
- Ngữ pháp: `tong-hop` là phần gộp hợp lệ của các chủ đề nhỏ — giữ, nhưng đổi chữ mô tả.

**Khuyến nghị sửa dữ liệu (chỉ đổi tên hiển thị, KHÔNG đổi URL, không cần 301):** `chung` → "Đề dài" (~20 câu), `tong-hop` của đọc hiểu → "Đề ngắn" (~10 câu); tiêu đề đề `Đề dài - Đề N` / `Đề ngắn - Đề N`; trang kỹ năng chỉ hiện 2 thẻ phân biệt bằng độ dài (như mockup). Với kỹ năng chỉ có `tong-hop` (từ vựng, viết câu): trang kỹ năng liệt kê thẳng lưới đề, không hiện cấp chủ đề; URL `/tong-hop` giữ nguyên làm canonical. Cũng nên sắp xếp đề theo số (hiện đang theo chuỗi: Đề 1, 10, 11, 12, 2…).

## Ngân sách chữ SEO theo loại trang (tối thiểu giữ lại, và vì sao)
Chữ riêng của site (không tính bài đọc/câu hỏi/menu/footer). Nguyên tắc: mỗi trang có H1 + title + meta description duy nhất và ≥1 đoạn chữ riêng thật sự có ích; phần còn lại gập nhưng vẫn nằm trong DOM (Google lập chỉ mục chữ trong `<details>`), và FAQ nhìn thấy/gập phải khớp JSON-LD `FAQPage`.

| Loại trang | Giữ tối thiểu | Cắt/gập | Vì sao / rủi ro |
|---|---|---|---|
| Kỹ năng (4 lớp × 4 kỹ năng) | H1, dòng thống kê, **1 câu** giới thiệu (~100–150 ký tự), 2–3 thẻ bộ đề, FAQ 3 hỏi–đáp (gập) ≈ 550–700 ký tự trong DOM | Đoạn giới thiệu thứ 2 ("Chọn một chủ đề…"), mô tả lặp trên thẻ | Trang là hub liên kết nội bộ; ≥1 câu riêng + FAQ đủ để không "mỏng" |
| Chủ đề có định nghĩa (ngữ pháp/từ vựng: `def.intro`, ví dụ, lưu ý) | GIỮ nguyên phần kiến thức (≈700–1500 ký tự): đây là chữ độc nhất có giá trị nhất | Gập "Lưu ý khi làm bài" nếu dài; bỏ dòng "Lớp N: x câu · y đề" (đã ở dòng ngữ cảnh) | Cắt phần này mới làm tăng rủi ro nội dung mỏng |
| Chủ đề không có định nghĩa (đọc hiểu `chung`/`tong-hop`, ~500–750 ký tự) | H1 riêng, dòng ngữ cảnh, **1 câu mô tả riêng** (nên thêm ~100 ký tự: đề dài khác đề ngắn thế nào), FAQ 2 hỏi–đáp gập | Đoạn "Bài luyện … chủ đề tổng hợp", thẻ "Chủ đề khác/ở lớp khác" dạng đoạn mô tả → chip liên kết | **Rủi ro mỏng/trùng cao nhất**: 12–22 trang đề chỉ có tiêu đề; cần câu mô tả riêng + khác biệt dài/ngắn để tách hai trang |
| Đề (`/de-N`) | H1, dòng ngữ cảnh, meta description riêng (số câu, kỹ năng, chủ đề), `Cách làm` gập; ≈250 ký tự chữ riêng | Intro lặp, hộp "Bài luyện của em", đoạn dưới câu hỏi, danh sách 11 đề → 2–3 chip | Thân trang là bài đọc + câu hỏi (≈3–12k ký tự) nên không cần thêm chữ riêng; JSON-LD `Quiz` giữ nguyên |
| Đề ngẫu nhiên | Không index (trạng thái client trên trang chủ đề) — dùng lại thanh sticky/Cách làm, không thêm chữ | — | Không ảnh hưởng SEO |

JSON-LD không đổi về ngữ nghĩa: `BreadcrumbList` giữ đủ chuỗi (kể cả khi mobile ẩn cấp giữa), `Quiz`/`FAQPage` giữ. Chỉ khác: tên cấp chủ đề đọc hiểu đổi theo khuyến nghị dữ liệu ("Tổng hợp" → "Đề dài"/"Đề ngắn"), tiêu đề `<title>` đổi tương ứng (≤ giới hạn `TITLE_MAX` hiện có).

## Việc cần đổi khi triển khai (file)
Dữ liệu:
- `web/scripts/lib/build-bank.ts` (tên `chung` → "Đề dài", tên/mô tả/tiêu đề `tong-hop`, thứ tự số) rồi chạy lại `web/scripts/build-bank-tests.ts` để sinh `web/content/tests/bank-grade-{6..9}.json`.
- `web/lib/seo-content.ts` (`SKILL_INTROS` còn 1 câu; `buildSkillFaq`/`buildTopicFaq` sửa câu "1 chủ đề và phần tổng hợp", thêm câu riêng cho đề dài/ngắn).
- `web/lib/content/load.ts` (sắp xếp đề theo số; ước tính phút = ~0,7 phút/câu làm tròn 5).
Giao diện:
- `web/app/[grade]/[skill]/page.tsx`, `[topic]/page.tsx`, `[topic]/[test]/page.tsx` (bỏ đoạn mở đầu/đoạn lặp, dòng ngữ cảnh, chip liên quan).
- `web/components/ui-kit/index.tsx` (`PageShell` bỏ dải hero + kicker cho trang trong; `Breadcrumbs` thu gọn 1 dòng; thêm `TestTile` thay `LinkCardList` cho đề; thẻ bộ đề).
- `web/components/quiz/Quiz.tsx` (gộp hộp "Bài luyện của em" vào `Cách làm`, thanh sticky tiến độ + Nộp bài), `RandomQuiz.tsx` (nút ngẫu nhiên vào menu/CTA phụ), `PreviousResult.tsx` (gộp vào dòng ngữ cảnh), `SectionedPractice.tsx` (tab bài đọc dưới thanh sticky), `ProgressHydrator.tsx` (trạng thái + điểm cao nhất trên thẻ đề, có chỗ giữ sẵn).
- Test cần cập nhật: `web/tests/seo-pages.test.ts`, `topics-pages.test.ts` (kỳ vọng `chung`), `quiz-render.test.ts`, `quiz-sectioned.test.ts`, `chrome.test.ts`; chạy lại Lighthouse CI (`web/lighthouserc.json`).
Tách việc đề nghị: (1) dữ liệu + SEO text, (2) trang kỹ năng/chủ đề, (3) trang đề + thanh sticky (rủi ro a11y cao nhất).

## Phối hợp với home-v2
Dùng cùng token, phông Be Vietnam Pro nội bộ, header/footer rút gọn của `docs/previews/home-v2` (PR #31); không sửa file của PR đó. Header ở đây thấp hơn (56px) cho trang trong.

## Giới hạn / chưa làm
- "Trước" là ảnh chụp site thật (không phải HTML tĩnh); "Sau" là HTML tĩnh. Chưa chạy Lighthouse trên mockup (không có JS/ảnh nặng; số Perf/CLS thực sẽ đo khi triển khai).
- Thanh sticky, menu `⋯`, breadcrumb thu gọn là CSS/HTML tĩnh; hành vi thật (focus trap, đồng bộ tiến độ) cần dev khi triển khai.
- Công thức "~phút" là ước lượng 0,7 phút/câu, chưa kiểm chứng với học sinh.
