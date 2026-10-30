# Tài liệu Thiết kế Giao diện (UI Design Specification)
**Dự án**: Nền tảng luyện tiếng Anh THCS (Lớp 6–9)
**Tài liệu**: Bản đặc tả thiết kế & Phê duyệt sơ bộ của chủ sở hữu (Owner Approval Non-Production Preview)
**Trạng thái**: Bản duyệt giao diện ngoại tuyến độc lập (Standalone Offline HTML Preview)

---

## 1. Phạm vi tài liệu & Mục đích phê duyệt (Scope & Approval Notice)

Tài liệu này và bản giao diện mẫu đi kèm (`docs/previews/sky-blue/preview.html`) được lập ra nhằm mục đích **duyệt định hướng phong cách giao diện (UI Style), luồng trải nghiệm (UX Flow), hệ thống màu sắc và khả năng đáp ứng trên các cỡ màn hình (Responsive)** trực tiếp với chủ sở hữu dự án trước khi triển khai mã nguồn vào hệ thống Next.js / Go backend.

> [!IMPORTANT]
> **Giới hạn kỹ thuật của bản Preview**:
> - Bản preview là mã HTML/CSS/JS độc lập (offline standalone), **không kết nối backend thật**, không lưu dữ liệu vĩnh viễn (no localStorage/database), không có phân tích hành vi hay tracking quảng cáo thực.
> - Đồng hồ làm bài, điểm số kết quả (8.0/10), trạng thái câu hỏi hoàn toàn là **dữ liệu mẫu định trước (Mock Data)**.
> - Toàn bộ mã nguồn, dịch vụ crawler, API và kiến trúc hạ tầng hiện có trong dự án vẫn giữ nguyên trạng thái tạm dừng, không bị xáo trộn.

---

## 2. Hệ thống Tokens & Quyết định Thiết kế (Design Tokens & Decisions)

### 2.1. Bảng màu Sky-Blue chủ đạo (Color Palette)
Theo yêu cầu trực tiếp từ chủ sở hữu dự án, tông màu **Sky-Blue (Xanh da trời tươi sáng)** được lựa chọn làm màu nhận diện chủ đạo, tạo cảm giác học tập thanh thoát, tích cực, sáng sủa và phù hợp tâm lý học sinh THCS lứa tuổi 11–15 tuổi:

- **Primary Brand / Action Tokens**:
  - `var(--color-sky-500)`: `#0ea5e9` (Sky sáng, điểm nhấn thứ cấp)
  - `var(--color-sky-600)`: `#0284c7` (Sky chuẩn, đường viền và icon)
  - `var(--color-sky-700)`: `#0369a1` (Sky đậm, nút bấm chính Primary Actions đạt độ tương phản chữ trắng >= 4.5:1, tiêu đề)
  - `var(--color-sky-800)`: `#075985` (Sky sâu, heading cấp cao, text nhấn mạnh)
- **Surfaces & Backgrounds (Nền & Bề mặt)**:
  - `var(--color-surface-bg)`: `#f8fafc` (Nền trang xám phấn siêu nhẹ, giảm mỏi mắt)
  - `var(--color-surface-card)`: `#ffffff` (Nền thẻ bài tập & card nội dung)
  - `var(--color-surface-alt)`: `#f0f7fd` (Nền đoạn văn đọc hiểu Reading passage)
  - `var(--color-sky-50)`: `#f0f9ff` / `var(--color-sky-100)`: `#e0f2fe` (Nền banner hero, chip tag, reviewer bar)
- **Typography & Status Colors (Văn bản & Trạng thái)**:
  - `var(--color-text-main)`: `#0f172a` (Màu chữ chính - tương phản cao trên nền trắng)
  - `var(--color-text-secondary)`: `#334155` (Màu nội dung phụ, mô tả đề thi)
  - `var(--color-text-muted)`: `#64748b` (Ghi chú thời gian, số câu)
  - `var(--color-success)`: `#047857` (Trạng thái câu đúng, mục tiêu tương phản >= 4.5:1 cho chữ nhỏ, kết hợp icon tích V và chữ "Chính xác")
  - `var(--color-error)`: `#dc2626` (Trạng thái câu sai, kết hợp icon chéo X và chữ "Chưa đúng")
  - `var(--color-warning)`: `#b45309` (Cảnh báo rate-limit 429, mục tiêu tương phản >= 4.5:1 cho chữ nhỏ)

### 2.2. Ghi nhận nghiên cứu UI/UX & Lý do loại trừ các trường phái khác
Trong quá trình đối chiếu tri thức kỹ năng `ui-ux-pro-max`:
1. **Loại trừ Claymorphism / Hoạt hình hoạt họa (Cartoon/Preschool)**: Nhóm học sinh lớp 6–9 (11–15 tuổi) đang trong giai đoạn chuyển tiếp tâm lý thiếu niên, rất nhạy cảm với các thiết kế mang hơi hướng "con nít / mẫu giáo".
2. **Loại trừ Giao diện Quản trị viên (Admin Dashboard)**: Tránh cảm giác bảng biểu khô khan, ngột ngạt tạo áp lực thi cử.
3. **Loại trừ tông màu Tím (Purple) & Giao diện tối mặc định (Dark Default)**: Bảng màu Sky-Blue được ưu tiên áp dụng để duy trì độ tương phản văn bản cao nhất khi học sinh đọc các đoạn văn dài dưới điều kiện ánh sáng phòng học.
4. **Giữ lại các nguyên tắc cốt lõi**:
   - Cấu trúc Feature-Card phân tầng rõ rệt.
   - Khoảng cách chạm tối thiểu 44×44px cho mobile touch screen.
   - Đường viền bo cong vừa phải (`border-radius: 12px` - 16px), đổ bóng kiềm chế nhẹ nhàng (`box-shadow: 0 4px 12px rgba(14, 165, 233, 0.08)`).

### 2.3. Quy ước thương hiệu tạm thời (Temporary Wordmark)
Dự án hiện chưa chốt nhận diện thương hiệu cuối cùng (không sử dụng thương hiệu MEnglish hoặc tự đặt thương hiệu mới). Bản thiết kế sử dụng wordmark trung tính:
- Tiêu đề hiển thị: **"Anh Ngữ 6–9"** kèm nhãn phù hiệu rõ ràng: `[Tên tạm thời]` / `[Chờ duyệt]`.
- Biểu tượng inline SVG cuốn sách mở trung tính, không chứa ký tự M hay liên hệ thương hiệu cũ.

---

## 3. Cấu trúc 4 Màn hình Trải nghiệm (Detailed Screen Specifications)

Giao diện xem trước tích hợp đầy đủ 4 màn hình chính trên một trang duy nhất, chuyển đổi linh hoạt qua URL Hash (`#home`, `#exercises`, `#quiz`, `#results`):

```
┌─────────────────────────────────────────────────────────────┐
│          Reviewer Meta Bar (Light Sky-Blue Theme)           │
├─────────────────────────────────────────────────────────────┤
│ Brand Logo [Tên tạm thời]     [Home] [Exercises] [Quiz] [Results] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Màn hình 1: Trang chủ]   [Màn hình 2: Danh sách đề]      │
│  - Hero không cần login   - Bộ lọc Khối/Kỹ năng/Độ khó      │
│  - Selector Lớp 6–9       - Thẻ bài tập + Thời gian + Nút   │
│  - Thẻ 4 kỹ năng chính     - Khung dự phòng AdSlot tĩnh     │
│  - Lộ trình 4 bước mẫu                                      │
│                                                             │
│  [Màn hình 3: Làm bài]     [Màn hình 4: Bảng kết quả]       │
│  - Đoạn văn Reading        - Vòng tròn điểm số mẫu (8.0/10) │
│  - Câu hỏi & Radio options- Thống kê Đúng/Sai/Thời gian     │
│  - Đồng hồ demo đóng băng  - Lời giải chi tiết + dẫn chứng   │
│  - Đánh dấu cờ (Flag)      - Nút làm lại đề / Sang đề mới   │
│  - Modal Native Dialog                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.1. Màn hình 1: Trang chủ (Home View - `#home`)
- **Điểm bắt đầu miễn phí**: Khẳng định thông điệp "Không cần đăng nhập / Không cần tài khoản", giúp học sinh tiếp cận kiến thức tức thì.
- **Minh họa Hero SVG nguyên bản**: Đồ họa vector vẽ tay inline hình tượng trang sách mở, huy hiệu sao vàng và mục tiêu học tập, phối hợp hài hòa trên nền dải màu xanh da trời mát mắt.
- **Bộ chọn khối lớp (Grade Selector 6–9)**: Phân tách rõ ràng chương trình 4 khối lớp từ Lớp 6 (khởi đầu) đến Lớp 9 (ôn thi vào 10).
- **Thẻ 4 kỹ năng trọng tâm**:
  1. *Đọc hiểu (Reading)*: Mô phỏng 12 chủ đề đọc hiểu đoạn văn ngắn, thông báo, biển báo.
  2. *Ngữ pháp (Grammar)*: Mô phỏng 45 chuyên đề mẫu về thì, câu điều kiện, bị động, mệnh đề quan hệ.
  3. *Từ vựng (Vocabulary)*: Mô phỏng từ vựng Unit mẫu (Word Form, Collocations, Phrasal Verbs).
  4. *Viết trắc nghiệm (Writing MCQ)*: Mô phỏng dạng đề vào 10 (tìm lỗi sai, viết lại câu đồng nghĩa).
- **Lộ trình học tập 4 bước**: Khảo sát đầu vào → Luyện chuyên đề → Phân tích lời giải → Thi thử áp lực giờ.

### 3.2. Màn hình 2: Danh sách đề (Exercise List View - `#exercises`)
- **Thanh lọc đa chiều (Filter Bar)**: Hỗ trợ lọc theo Khối lớp (Lớp 6, 7, 8, 9), Kỹ năng (Reading, Grammar, Writing), và Độ khó (Cơ bản, Vừa sức, Nâng cao).
- **Thẻ bài tập rõ ràng**: Cung cấp đầy đủ thông tin: Tiêu đề đề thi, tóm tắt nội dung ngữ liệu, số lượng câu hỏi, thời gian ước tính (10–20 phút) và nút hành động "Làm bài ngay".
- **Vị trí quảng cáo dự phòng**: Nằm độc lập bên ngoài màn hình làm bài (kích thước chuẩn 728×90), hiển thị nhãn minh họa rõ ràng và tuân thủ chế độ không cá nhân hóa thân thiện với trẻ em.

### 3.3. Màn hình 3: Giao diện làm bài tập (Quiz View - `#quiz`)
- **Bố cục 2 cột (Desktop 1440px) / 1 cột xếp chồng (Mobile 390px)**:
  - Cột chính: Khung bài đọc ngữ cảnh (Reading passage) nổi bật trên nền xanh nhạt, thân bài câu hỏi trắc nghiệm với các lựa chọn A, B, C, D có vùng bấm rộng rãi (tối thiểu 48px chiều cao).
  - Cột bên: Đồng hồ đếm ngược (được gắn nhãn rõ ràng: *Thời gian cố định minh họa demo*), nút bật/tắt gắn cờ xem lại (Flag toggle), và lưới điều hướng nhanh số câu hỏi (1..5).
- **Tuyệt đối không có quảng cáo trong khi làm bài**: Đảm bảo học sinh tập trung 100% vào việc tư duy và đọc hiểu.
- **Hộp thoại nộp bài (Native `<dialog>`)**: Tận dụng thẻ HTML5 chuẩn với phương thức `showModal()`, hỗ trợ phím `Escape` để hủy, bẫy tiêu điểm (focus trap) tự nhiên, và nút xác nhận nộp bài.

### 3.4. Màn hình 4: Kết quả & Giải thích chi tiết (Results View - `#results`)
- **Điểm số trực quan**: Hiển thị điểm số mẫu định trước (8.0/10) trên vòng tròn đồ họa nổi bật.
- **Nguyên tắc tương phản WCAG (Không dựa vào màu sắc đơn thuần)**:
  - Câu đúng: Sử dụng phù hiệu chữ **"Chính xác (Đúng)"** kết hợp icon dấu tích `✓`.
  - Câu chưa đúng: Sử dụng phù hiệu chữ **"Chưa đúng (Sai)"** kết hợp icon dấu chéo `✗` và hiển thị phương án đúng kèm theo.
- **Hộp giải thích chi tiết (Explanation Box)**: Phân tích cặn kẽ vì sao chọn đáp án đó, trích dẫn câu văn bằng chứng trong bài đọc, và phân tích ngữ pháp/từ vựng liên quan.
- **Điều hướng tiếp diễn**: Cung cấp hai nút hành động rõ ràng: "Làm lại đề này" và "Luyện đề tiếp theo".

---

## 4. Đặc tả Trạng thái Biên (Edge States: Loading / Empty / Error / 429)

Để chủ sở hữu có thể thẩm định toàn diện các trường hợp ngoại lệ trong vận hành thực tế, bản preview tích hợp sẵn thanh chọn trạng thái tại thanh Reviewer Bar ở đầu trang:

1. **Trạng thái Đang tải (Loading Skeleton)**:
   - Các khối mô phỏng vạch dữ liệu với hiệu ứng chuyển sắc động (shimmer animation), giữ nguyên khung bố cục (mục tiêu kỹ thuật thiết kế nhắm tới CLS < 0.1 trong môi trường triển khai thực tế, không phải số liệu đo kiểm sản xuất tại bản xem trước này).
2. **Trạng thái Danh sách rỗng (Empty State)**:
   - Minh họa khi bộ lọc không tìm thấy đề thi phù hợp; cung cấp thông điệp hướng dẫn học sinh đổi khối lớp hoặc nút "Đặt lại bộ lọc".
3. **Trạng thái Lỗi máy chủ (500 Error State)**:
   - Thông báo sự cố kỹ thuật nhẹ nhàng bằng tiếng Việt, có nút "Thử lại ngay" mà không gây hoang mang cho học sinh.
4. **Trạng thái Giới hạn lượt gọi (429 Rate Limit State)**:
   - Mô phỏng trường hợp học sinh bấm nút trộn đề ngẫu nhiên liên tục nhiều lần trong thời gian ngắn; hiển thị biểu tượng đồng hồ và khuyến nghị học sinh tạm dừng 30 giây để bảo vệ tài nguyên máy chủ.

---

## 5. Khả năng truy cập (Accessibility - a11y) & Chuẩn SEO

### 5.1. Mục tiêu Khả năng tiếp cận (Accessibility Implementation Targets)
*Lưu ý: Các thông số dưới đây là mục tiêu thiết kế và tính toán màu sắc trên mã nguồn xem trước, không cấu thành chứng nhận tuân thủ WCAG sản xuất đã qua kiểm toán bên thứ ba.*

- **Kích thước vùng bấm cảm ứng (Touch Targets)**: Toàn bộ nút bấm, ô chọn radio, thẻ khối lớp, ô chọn trạng thái (select), liên kết thương hiệu và phím điều hướng số câu đều được cấu hình đạt kích thước tối thiểu **44×44px** cùng khoảng cách đệm (spacing) tối thiểu **8px**.
- **Mục tiêu tương phản màu sắc (Color Contrast Targets)**: Chữ trắng trên nền nút bấm chính `#0369a1` đạt tỷ lệ tương phản tính toán ~5.89:1 (vượt mức tối thiểu 4.5:1 cho văn bản thông thường); các trạng thái chữ nhỏ thành công (`#047857`) và cảnh báo (`#b45309`) đều nhắm tới ngưỡng >= 4.5:1. Các tông màu xanh da trời tươi sáng được duy trì tại bề mặt nền và đồ họa minh họa.
- **Hỗ trợ bàn phím (Keyboard Navigation)**: Trạng thái `:focus-visible` với viền xanh 3px sắc nét, liên kết nhảy cóc (Skip to content) ở đầu trang dành cho người dùng dùng phím Tab.
- **Hạn chế chuyển động (Reduced Motion)**: Tự động triệt tiêu hoạt cảnh chuyển động khi hệ điều hành kích hoạt `@media (prefers-reduced-motion: reduce)`.
- **Ngắt dòng tiếng Việt (Vietnamese Typography Wrapping)**: Áp dụng `overflow-wrap: break-word` bảo đảm không phát sinh thanh cuộn ngang (horizontal scroll) ở màn hình 390px mà không cần ẩn thanh cuộn cưỡng bức bằng `overflow-x: hidden`.

### 5.2. Đối chiếu Yêu cầu SEO Production vs. Giới hạn Bản Mockup
- Trong môi trường sản xuất thật (Next.js): Toàn bộ trang nội dung sẽ được xuất bản dưới dạng **SSG + ISR (1 giờ)**, thẻ canonical tuyệt đối, Schema JSON-LD `Quiz` và `LearningResource`, sitemap.xml.
- Trong bản duyệt sơ bộ này: Sử dụng `<meta name="robots" content="noindex, nofollow">` để tránh việc các công cụ tìm kiếm thu thập bản giao diện thử nghiệm.

---

## 6. Hướng dẫn Mở & Thẩm định Bản Giao diện (Review Instructions)

Chủ sở hữu dự án có thể mở và tương tác trực tiếp với bản thiết kế bằng bất kỳ trình duyệt web hiện đại nào (Chrome, Safari, Edge, Firefox) thông qua giao thức tệp cục bộ (`file://`):

### 6.1. Đường dẫn tệp cục bộ
```
file:///home/menglish/wt-learning-ui-design/docs/previews/sky-blue/preview.html
```

### 6.2. Các liên kết điều hướng xem trước
- Màn hình Trang chủ: `preview.html#home`
- Màn hình Danh sách đề: `preview.html#exercises`
- Màn hình Làm bài tập: `preview.html#quiz`
- Màn hình Kết quả bài làm: `preview.html#results`

### 6.3. Kịch bản kiểm thử tương tác
1. **Kiểm tra độ co giãn (Responsive)**: Mở DevTools (F12) chuyển đổi giữa màn hình Desktop (1440px) và Mobile iPhone 14 / Android (390px). Xác nhận không bị vỡ bố cục hay tràn thanh cuộn ngang.
2. **Kiểm tra lọc bài tập**: Tại màn hình Danh sách đề, chuyển đổi bộ lọc khối lớp hoặc bấm "Đặt lại bộ lọc".
3. **Kiểm tra luồng nộp bài**: Tại màn hình Làm bài tập, bấm chọn đáp án A/B/C/D, bấm nút gắn cờ (Flag), sau đó bấm "Nộp bài thi" để kích hoạt Native Modal Dialog và bấm xác nhận để chuyển sang màn hình Kết quả.
4. **Kiểm tra các trạng thái biên**: Sử dụng menu chọn trạng thái ở thanh điều khiển duyệt màu xanh nhạt (Reviewer Bar) để xem trước trạng thái Loading, Empty, 500 Error, và 429 Rate Limit.

---

## 7. Ranh giới Triển khai Tương lai (Future Production Boundaries)

Khi bản thiết kế giao diện được chủ sở hữu phê duyệt chính thức, các bước triển khai kỹ thuật tiếp theo sẽ bao gồm:
1. Chuyển đổi mã HTML/CSS thành các React Server Components (RSC) và Client Components trong thư mục `web/` (Next.js App Router).
2. Tích hợp API trộn đề tất định từ backend Go (`POST /api/v1/tests/random` và `GET /api/v1/tests/{slug}`).
3. Quản lý phiên làm bài và khóa bảo mật nộp bài (`attempt_token`) tại máy chủ nhằm bảo mật đáp án tuyệt đối.
4. Cấu hình vị trí quảng cáo Google AdSense dành riêng cho nội dung học sinh (không cá nhân hóa và loại trừ hoàn toàn khỏi trang làm bài).
