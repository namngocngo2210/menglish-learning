# Bố cục làm bài theo section (bài đọc + câu hỏi)

## Mô hình
`web/lib/quiz/sections.ts` → `buildSections(questions, passages)`:
- 1 section / 1 bài đọc (thứ tự xuất hiện đầu tiên, câu hỏi của bài đọc luôn liền nhau).
- 1 section cuối "Câu độc lập" (hoặc "Bài tập" nếu đề không có bài đọc) chứa mọi câu không có `passageId` (ngữ pháp/từ vựng).
- Số câu hiển thị đánh liên tục theo thứ tự section (`numberQuestions`). Chấm điểm (`scoreTest`) không đổi, nhận danh sách phẳng theo thứ tự section.
- Đề ngẫu nhiên: `mixTest` đã giữ nguyên nhóm bài đọc; `buildSections` chỉ gom lại, có test.

## Desktop (>= 1024px)
Một section hiển thị tại một thời điểm, chia 2 pane: bài đọc (trái) và câu hỏi (phải). Mỗi pane là `<section tabindex=0>` có nhãn, `overflow-y: auto`, `scrollbar-gutter: stable`, `overscroll-behavior-y: auto` (không giữ cuộn, hết pane thì trang cuộn tiếp). Chiều cao `calc(100dvh - 17rem)` (tối thiểu 28rem). Tiêu đề bài đọc `sticky top-0` trong pane trái. Thanh điều khiển (Phần trước / Tổng quan / Nộp bài / Phần sau) `sticky bottom-0`. Section độc lập: một cột `max-w-3xl`, chỉ cuộn trang.

## Mobile (< 1024px)
Một luồng cuộn tự nhiên, **không có vùng cuộn lồng**. Bài đọc là thẻ gập ở đầu section (nút "Ẩn bài đọc"/"Xem bài đọc", `aria-expanded`), cộng thanh dưới `sticky` có "Xem bài đọc" (mở thẻ + cuộn lên), "Câu chưa làm tiếp" và tiến độ.
Vì sao không dùng bottom-sheet: sheet cần bẫy focus + khóa cuộn nền, che mất câu hỏi khi đang đọc, dễ lỗi với thanh địa chỉ iOS; thẻ gập + thanh nhảy giữ cuộn gốc của trình duyệt, đọc lại bài bất cứ lúc nào, không cần JS thêm để cuộn.

## Progressive enhancement / SEO
- HTML server luôn chứa MỌI bài đọc và MỌI câu hỏi, đúng thứ tự: `h3` section → bài đọc → câu hỏi, section độc lập cuối cùng.
- Section không hoạt động chỉ bị ẩn bằng CSS (`data-inactive` → `hidden`), cùng markup khi hydrate (không lệch hydration, không CLS do đổi cây DOM). Khối `<noscript><style>` hiện lại tất cả section xếp chồng và ẩn thanh điều khiển cần JS; mục lục (`nav` với link neo) vẫn dùng được không cần JS.
- Không có cloaking: người dùng và crawler nhận cùng nội dung; JSON-LD Quiz giữ nguyên; không thêm thư viện runtime.
- Không có quảng cáo trong vùng làm bài (AdSlot chỉ trong `afterResult`).

## Hợp đồng props của `SectionedPractice` (dùng lại cho phòng nhóm S3)
Presentational, controlled, không state/lưu trữ/chấm điểm:
`sections`, `answers`, `checked`, `revealAll?`, `feedback?: "per-question" | "none"`, `activeIndex`, `onActiveChange`, `onSelect(id,key)`, `onCheck?(id)`, `footer?` (nút thêm trên thanh điều khiển), `focusRequest?`.
Phòng nhóm dùng `feedback="none"` để ẩn nút Kiểm tra/lời giải khi thi trực tiếp.

## Lưu bài dở
`localStorage` khóa `ml:quiz:v1:<progressKey | random:<seed>>`, giá trị `{v:1, answers, checked, active}`. Đọc sau hydrate (kiểm tra id/key hợp lệ, bỏ qua JSON hỏng), ghi mỗi khi đổi, xóa khi nộp bài hoặc làm lại. Điểm đề cố định vẫn lưu ở `ml:progress:v1` như cũ.

## Kiểm thử
Vitest (`tests/quiz-*.test.ts`, jsdom cho component) và Playwright (`npm run e2e`, 390 + 1440; cần `npm run build`, đặt `PW_CHROME` nếu dùng Chrome có sẵn, `SHOT_DIR` để xuất ảnh chụp).
