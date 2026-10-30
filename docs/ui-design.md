# Tài Liệu Thiết Kế Giao Diện v2 (UI Design Specification)

> **HƯỚNG MỚI NHẤT — CAM/NAVY, KHÔNG CÒN SKY BLUE:** Chủ sở hữu yêu cầu dùng họ màu MEnglish, không đổi tên/logo. Hai màn đại diện tĩnh ở `previews/sky-blue-v2/app/direction/`: home và admin một chủ, mỗi màn có PNG1440/390. Token tham chiếu: trang trí `#f5691a`, CTA `#c2410c` chữ trắng, chữ/viền `#a23f00`, navy `#111a2b` / `#1b2a4a`, nền `#f9f9ff`/trắng, bề mặt ấm `#fff7ed` / `#fff3eb`, font **Be Vietnam Pro** đóng gói cục bộ. Home đổi bố cục thành workbook chú giải làm điểm nhấn; admin tập trung lượt duyệt thủ công, không chỉ thay màu hàng loạt.
>
> **Chỉ chờ duyệt hướng thẩm mỹ đại diện:** không yêu cầu demo bấm thử; chưa triển khai website. Không tiếp tục polish tất cả màn trước khi chủ duyệt hướng mới. Source và24ảnh xanh trước đó giữ làm lịch sử, không phải hướng đang đề xuất. Các phần SKY BLUE/luồng mock bên dưới mô tả vòng trước, không được hiểu là yêu cầu màu hiện hành. Xem `previews/sky-blue-v2/verification.md` cho bằng chứng và giới hạn.

> **Phạm vi chủ sở hữu cập nhật:** chỉ duyệt **ảnh thiết kế tĩnh PNG desktop/mobile** cho học sinh và admin một chủ; **không cần demo bấm thử**. Source Next.js/shadcn/Tailwind/Lucide đã tạo được giữ để tái tạo ảnh, không phải yêu cầu hoàn thiện tương tác hay triển khai website. Các điều khiển mock bên dưới là phần hiện có, không phải tính năng production đã được nghiệm thu. Kết quả build/render và các giới hạn xem `previews/sky-blue-v2/verification.md`.
>
> **TÌNH TRẠNG TÀI LIỆU:** Tài liệu này là bản thiết kế v2 thay thế bản v1 cũ, **chưa được chủ sở hữu duyệt thẩm mỹ**.
> *Liên kết lịch sử:* [Bản v1 HTML cũ](previews/sky-blue/preview.html), chưa được phê duyệt; không phải artifact chính của v2.
>
> Giai đoạn sinh các màn hình ban đầu: `ui-ux-pro-max` và `ui-styling` được đưa bằng **nội dung hướng dẫn inline trong brief Gemini**. Sau đó boss đã cài bản `ui-ux-pro-max` độc lập đầy đủ tại `~/.gemini/antigravity-cli/skills/ui-ux-pro-max` và kiểm chứng native slash expansion thành công; các brief Gemini về sau dùng `/ui-ux-pro-max`. Native skill không đồng nghĩa được tự mở quyền filesystem/terminal, search script vẫn cần quyền tương ứng. Không sinh lại màn hình đã có chỉ để đổi cách nạp skill. Giao diện và sửa lỗi hình ảnh do Gemini `gemini-3.8-flash-medium` qua CLI chính thức.
> Bản xem trước hiện tại v2 được đặt độc lập tại `docs/previews/sky-blue-v2/`.

---

## 1. Mục Đích & Phạm Vi Dự Án

- **Bản xem trước thẩm mỹ (Design Preview Only):** Đây là bản xem trước giao diện được thiết kế để chủ sở hữu và người đánh giá độc lập xem xét về mặt thẩm mỹ, bố cục và luồng trải nghiệm người dùng (aesthetic & UX review). Bản thiết kế này **KHÔNG PHẢI** là mã nguồn triển khai thực tế trên môi trường production.
- **Tác giả giao diện duy nhất:** Gemini gemini-3.8-flash-medium thông qua công cụ Antigravity CLI chính thức, thực hiện theo kế hoạch phân rã không dùng công cụ (no-tools structured JSON output). Đội ngũ phát triển hiện thực hóa chính xác các nội dung trong danh mục cho phép và thực hiện kiểm chứng độc lập.
- **Nhánh tài liệu:** `docs/ui-sky-blue-design` (PR 2).
- **Phê duyệt độc lập:** Bản thiết kế chỉ có hiệu lực phục vụ đánh giá; việc nghiệm thu cần quy trình kiểm thử độc lập và sự phê duyệt chính thức từ chủ sở hữu.

---

## 2. Định Vị Người Dùng & Nguyên Tắc Thị Giác

### 2.1. Đối Tượng Người Dùng Mục Tiêu
- **Học sinh THCS (Lớp 6 đến Lớp 9, độ tuổi từ 11 đến 15 tuổi):**
  - Giao diện cần trực quan, khích lệ tinh thần học tập, thân thiện nhưng trưởng thành.
  - **Không** sử dụng phong cách hoạt hình mầm non/mẫu giáo (preschool cartoon) gây cảm giác trẻ con.
  - **Không** sử dụng giao diện phần mềm doanh nghiệp (generic SaaS) khô khan, xám xịt hoặc đơn điệu.
  - Ngôn ngữ giao diện và hướng dẫn hoàn toàn bằng Tiếng Việt chuẩn mực, hỗ trợ ngắt dòng tự nhiên cho các câu văn bản dài.

### 2.2. Thương Hiệu & Bảng Màu (Bright Sky Blue Palette)
- **Tên thương hiệu:** Đang trong giai đoạn cân nhắc, chưa chốt tên thương mại cố định. Sử dụng định danh trung tính: **"Góc tiếng Anh"** kèm nhãn hiển thị rõ ràng **"Tên tạm"**.
- **Tông màu chủ đạo:** Màu xanh da trời tươi sáng (Bright Sky Blue) kết hợp nền trắng và bề mặt sáng tinh tế.
  - **Màu nền chính (`--background`):** `hsl(204, 100%, 98%)` (Xanh thiên thanh nhạt, dịu mắt).
  - **Màu văn bản (`--foreground`):** `hsl(215, 35%, 15%)` (Xanh đen đậm, tương phản cao trên nền sáng).
  - **Màu thương hiệu / Nút chính (`--primary`):** `hsl(201, 96%, 32%)` (Xanh ngọc biển sâu, đảm bảo tỷ lệ tương phản chuẩn).
  - **Màu phụ (`--secondary`):** `hsl(199, 89%, 94%)` kèm chữ `hsl(201, 90%, 22%)`.
  - **Màu thẻ & hộp thoại (`--card` / `--popover`):** `hsl(0, 0%, 100%)` (Trắng thuần, viền phân cách mềm mại).
  - **Màu viền (`--border`):** `hsl(201, 35%, 86%)`.
  - **TUYỆT ĐỐI TRÁNH:** Không dùng bảng màu tím (purple) hoặc các tông xám/đen trắng mặc định của shadcn (slate/zinc monotone).

### 2.3. Phông Chữ & Tài Nguyên Ngoại Vi (Zero-Fetch Architecture)
- Hoàn toàn **không nạp tài nguyên từ bên ngoài** (không Google Fonts, không external CDN, không API bên ngoài, không mã theo dõi quảng cáo/analytics).
- Sử dụng phông chữ hệ thống ngoại tuyến (System Font Stack):
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Kích thước chữ cơ sở: `16px` với chiều cao dòng tối thiểu `1.5` để văn bản tiếng Việt dễ đọc, không dính chữ.
- Biểu tượng SVG thuần túy từ thư viện `lucide-react` (phiên bản 1.65.0), tất cả biểu tượng trang trí đều có thuộc tính `aria-hidden="true"`, các nút hành động chứa biểu tượng đều có nhãn phụ trợ tiếp cận (`aria-label`).

---

## 3. Mục Tiêu Trải Nghiệm & Khả Năng Tiếp Cận (Accessibility & UX Goals)

> [!NOTE]
> Các chỉ số dưới đây là **mục tiêu thiết kế giao diện** được áp dụng nghiêm ngặt trong mã nguồn CSS/JSX, **không phải là chứng nhận chính thức** (certified WCAG / performance audit) được cấp bởi đơn vị đo kiểm độc lập.

1. **Độ tương phản màu sắc (Contrast Ratio):**
   - Mọi văn bản kích thước thông thường đạt độ tương phản tối thiểu từ `4.5:1` trở lên so với màu nền.
   - Các nhãn trạng thái (badge), cảnh báo (alert) đều sử dụng các cặp màu đã được tính toán kỹ lưỡng.
2. **Kích thước vùng chạm cảm ứng (Touch Targets):**
   - Mọi nút bấm (`button`), liên kết điều hướng, trường nhập liệu (`input`, `select`, `textarea`) đều có kích thước tương tác tối thiểu `44px x 44px`, hỗ trợ tốt cho học sinh sử dụng điện thoại màn hình nhỏ (390px) và máy tính bảng.
3. **Chỉ báo tiêu điểm bàn phím (Visible Keyboard Focus):**
   - Thiết lập toàn cục `:focus-visible` với viền đôi rõ ràng (`2px solid hsl(var(--ring))`, `outline-offset: 2px`). Không dựa vào trạng thái hover chuột để hiển thị các hành động cần thiết.
4. **Xử lý ngắt dòng Tiếng Việt & Chống tràn trang:**
   - Sử dụng `overflow-wrap: break-word` và `word-break: break-word` trên toàn bộ các khối nội dung, đoạn văn và tiêu đề tiếng Việt.
   - Thiết kế đáp ứng từ màn hình di động `390px` đến màn hình máy tính để bàn `1440px`. Không để xảy ra hiện tượng thanh cuộn ngang toàn trang (no horizontal page overflow).
   - Bảng dữ liệu quản trị (Table) được đặt trong vùng chứa có thanh cuộn riêng biệt và nhãn tiếp cận rõ ràng.
5. **Hỗ trợ Giảm Chuyển Động (Reduced Motion):**
   - Tích hợp truy vấn truyền thông `@media (prefers-reduced-motion: reduce)`, tự động triệt tiêu các hiệu ứng chuyển động và kéo thời gian hiệu ứng chuyển tiếp về `0.01ms` đối với người dùng bật chế độ giảm tải kích thích thị giác.

---

## 4. Kiến Trúc Kỹ Thuật Bản Xem Trước (Fixture v2)

Bản xem trước được cô lập hoàn toàn tại thư mục `docs/previews/sky-blue-v2/` với các thành phần:
- **Next.js 16.4.3 (App Router):** Cấu hình `output: 'export'` để xuất thành các tệp tĩnh thuần túy (`out/`).
- **React 19.3.1 & TypeScript 5.9.3.**
- **Tailwind CSS v4.3.3:** Khai báo cấu hình qua `@tailwindcss/postcss`, nạp `@import "tailwindcss";` và tùy biến biến chủ đề CSS qua `@theme inline`.
- **15 UI Primitives Chuẩn Upstream shadcn/ui (New York Style):**
  Được cài đặt trực tiếp qua câu lệnh chuẩn `npx --yes shadcn@4.23.0 add button card tabs badge progress dialog sheet select table input dropdown-menu skeleton alert label textarea --yes` vào thư mục `@/components/ui/`. Tuyệt đối không dùng component tự chế nhái giao diện.
- **Cơ chế trạng thái trong bộ nhớ (In-memory State Only):**
  - Mọi thao tác tương tác của học sinh và quản trị viên đều cập nhật vào `useState` nội bộ.
  - Dữ liệu tự động quay về trạng thái ban đầu khi tải lại trang (reload).
  - Không gửi bất kỳ yêu cầu mạng nào ngầm (no fetch/axios background calls).

---

## 5. Đặc Tả 11 Màn Hình & Tuyến Đường Điều Hướng (Hash Routes)

Bản xem trước sử dụng hệ thống chuyển màn hình dựa trên URL Hash (`window.location.hash`), hỗ trợ trực tiếp 11 màn hình chức năng mà không phụ thuộc vào máy chủ định tuyến động:

```
[Khu vực Học sinh - Công khai, không đăng nhập]
├── #home            : Trang chủ học sinh, giới thiệu bài đọc và nút làm bài nhanh
├── #browser         : Kho duyệt bài đọc, bộ lọc lớp (6-9), chủ đề và độ khó
├── #quiz            : Phòng thi làm bài đọc hiểu (3 câu hỏi trắc nghiệm MCQ)
└── #results         : Kết quả làm bài, điểm số tức thì và giải thích đáp án

[Khu vực Quản trị - MOCK duy nhất một chủ sở hữu]
├── #admin-login     : Màn hình vào khu vực quản trị MOCK (nút bấm một chạm, không mật khẩu)
├── #admin-overview  : Bảng điều khiển tổng quan quản trị mẫu (DEMO số liệu)
├── #admin-bank      : Ngân hàng bài đọc & câu hỏi, quản lý trạng thái kiểm duyệt
├── #admin-editor    : Trình soạn thảo bài đọc & câu hỏi kèm màn hình xem trước trực tiếp
├── #admin-sources   : Quản lý nguồn tài liệu, bản quyền và tiến trình crawl kiểm dịch
├── #admin-tests     : Bộ trộn đề (Mixer presets) và cấu hình đề thi theo ma trận
└── #admin-reports   : Báo cáo học tập mẫu và danh sách phản hồi nội dung cần xử lý
```

### Chi tiết từng màn hình:

1. **`#home` - Trang chủ học sinh:**
   - Lời chào mừng học sinh trung học cơ sở ("Chào bạn, hôm nay cùng luyện đọc nhé!").
   - Nút hành động nhanh ("Làm bài ngay") đưa trực tiếp vào bài đọc mẫu.
   - Thẻ hiển thị các chủ đề nổi bật: Đời sống học đường, Khám phá khoa học, Văn hóa thế giới, Môi trường xanh.
   - Nhắc nhở rõ ràng: Học sinh học tập hoàn toàn miễn phí, không yêu cầu tạo tài khoản hay đăng nhập.

2. **`#browser` - Kho bài đọc & Lọc chủ đề:**
   - Bộ lọc cục bộ đa tiêu chí: Khối lớp (Lớp 6, Lớp 7, Lớp 8, Lớp 9), Chủ đề và Cấp độ khó (Cơ bản, Vừa sức, Thử thách).
   - Thẻ bài đọc hiển thị thông tin: Tiêu đề tiếng Anh, chủ đề tiếng Việt, thời gian đọc ước tính (ví dụ: 3 phút), số lượng câu hỏi (3 câu MCQ).
   - Nút "Bắt đầu làm bài" dẫn tới màn hình thi tương ứng.

3. **`#quiz` - Màn hình làm bài thi đọc hiểu:**
   - Bố cục chia hai cột trên desktop (hoặc xếp chồng linh hoạt trên mobile): Cột bài đọc tiếng Anh mẫu nguyên bản và Cột câu hỏi trắc nghiệm.
   - Thanh tiến trình trực quan (Progress component) thể hiện câu hỏi hiện tại (1/3, 2/3, 3/3).
   - Đồng hồ đếm thời gian làm bài cục bộ.
   - Các lựa chọn đáp án trắc nghiệm (A, B, C, D) với vùng bấm lớn (>44px), phản hồi trạng thái chọn tức thì.
   - Hộp thoại xác nhận nộp bài (Dialog component) bảo vệ tránh nộp nhầm khi chưa chọn hết câu trả lời.

4. **`#results` - Kết quả bài làm:**
   - Hiển thị điểm số tính toán ngay trong bộ nhớ (ví dụ: 3/3 - Đạt 100%).
   - Thông điệp khích lệ thân thiện phù hợp lứa tuổi học sinh THCS.
   - Bảng phân tích chi tiết từng câu hỏi: Lựa chọn của học sinh, Đáp án chính xác và Lời giải thích chi tiết bằng tiếng Việt.
   - Nút "Làm lại bài này" (reset state bài thi) hoặc "Khám phá bài đọc khác" quay về `#browser`.

5. **`#admin-login` - Đăng nhập Quản trị viên MOCK:**
   - **Tuyệt đối không lưu trữ hay yêu cầu mật khẩu/token.**
   - Giao diện cung cấp nút bấm tiện ích: `"Vào bảng điều khiển quản trị (MOCK)"`.
   - Cảnh báo bảo mật nổi bật: Thông báo rõ đây là giao diện xem trước phục vụ thẩm mỹ, không áp dụng bất kỳ cơ chế xác thực nào; việc chuyển đổi hash route trên trình duyệt không phải là ranh giới bảo mật.

6. **`#admin-overview` - Tổng quan Quản trị viên (DEMO):**
   - Thiết kế chuyên biệt cho **duy nhất một chủ sở hữu (Single Owner)**.
   - Thẻ thống kê mẫu: Tổng số bài đọc đã duyệt, Số bài đang chờ kiểm duyệt (Draft/Quarantine), Lượt làm bài demo trong ngày.
   - Lối tắt nhanh tới các tác vụ thường xuyên: "Soạn bài đọc mới", "Kiểm tra nguồn thu nạp".

7. **`#admin-bank` - Ngân hàng bài đọc & Duyệt nội dung:**
   - Bảng dữ liệu (Table) hiển thị danh sách bài đọc với đầy đủ cột thông tin: Tên bài, Khối lớp, Số câu hỏi, Nguồn cấp phép, Trạng thái kiểm duyệt.
   - Huy hiệu trạng thái (Badge): `Đã xuất bản (Published)`, `Bản nháp (Draft)`, `Đang cách ly (Quarantine)`.
   - Thao tác nhanh: Nút "Chuyển trạng thái" (thay đổi state trong bộ nhớ kèm nhãn `[MOCK]`), nút "Chỉnh sửa" mở `#admin-editor`.

8. **`#admin-editor` - Trình biên tập & Xem trước bài đọc:**
   - Biểu mẫu nhập liệu bài đọc: Tiêu đề tiếng Anh, Khối lớp mục tiêu, Chủ đề, Đoạn văn bản đọc hiểu tiếng Anh.
   - Khu vực quản lý câu hỏi trắc nghiệm: Soạn nội dung câu hỏi, 4 phương án lựa chọn, chọn đáp án đúng và nhập giải thích tiếng Việt.
   - Tab "Xem trước trực tiếp" (Live Preview) mô phỏng chính xác giao diện hiển thị cho học sinh để chủ sở hữu rà soát trước khi lưu.
   - Nút hành động: "Lưu bản nháp [MOCK]" và "Phê duyệt phát hành [MOCK]".

9. **`#admin-sources` - Quản lý nguồn thu nạp & Bản quyền:**
   - Danh sách nguồn tài liệu được cấp phép rõ ràng (Creative Commons, Public Domain, Nguồn tự biên soạn).
   - Bảng theo dõi tiến trình thu nạp thử nghiệm (Mock quarantine crawl jobs): Tên nguồn, Trạng thái thu nạp, Cảnh báo lỗi giả lập (để kiểm tra giao diện xử lý ngoại lệ).
   - Luồng nghiệp vụ bắt buộc: Không bao giờ tự động xuất bản sau khi thu nạp; luôn chuyển vào hàng đợi kiểm dịch để chủ duyệt thủ công.

10. **`#admin-tests` - Bộ trộn đề thi (Mixer Presets):**
    - Cấu hình ma trận đề kiểm tra mẫu theo từng khối lớp: Số lượng bài đọc, phân bổ câu hỏi nhận biết/thông hiểu/vận dụng.
    - Nút tạo đề mẫu thử nghiệm ngẫu nhiên từ kho ngân hàng câu hỏi.

11. **`#admin-reports` - Báo cáo & Phản hồi nội dung:**
    - Báo cáo thống kê câu hỏi học sinh hay làm sai để chủ sở hữu cân nhắc điều chỉnh nội dung bài học.
    - Hòm thư phản hồi mẫu từ học sinh (báo lỗi chính tả, câu hỏi chưa rõ ý) kèm nút xử lý mẫu `[MOCK]`.

---

## 6. Ranh Giới Bảo Mật & Khoảng Trống Kiến Trúc (Security Gap Analysis)

Đối chiếu trực tiếp với tài liệu quy định an toàn tại `docs/security.md`, bản thiết kế v2 xác lập các ranh giới kiến trúc bất khả xâm phạm như sau:

> [!WARNING]
> Bản xem trước `docs/previews/sky-blue-v2/` **chỉ là giao diện tĩnh (Static Export)**. Việc điều hướng bằng URL hash hoàn toàn không có khả năng bảo vệ dữ liệu. Mọi thành phần máy chủ thật sự nằm trong danh mục **khoảng trống kiến trúc (architectural gap)** cần chủ sở hữu phê duyệt triển khai ở các giai đoạn sau.

### 6.1. Nguyên Tắc Phía Học Sinh
- Giai đoạn 1 tuân thủ tuyệt đối: **Học sinh công khai hoàn toàn không có tài khoản, không đăng nhập**.
- Không thu thập dữ liệu định danh cá nhân (PII), không lưu trữ tiến độ cá nhân gắn với danh tính, không có thanh toán hay giao dịch tài chính.
- Tuân thủ quy định bảo vệ dữ liệu trẻ em (Nghị định 13/2023/NĐ-CP).

### 6.2. Yêu Cầu Bảo Mật Bắt Buộc Khi Triển Khai Backend Thật (Future Implementation)
Khi chủ sở hữu phê duyệt triển khai mã nguồn phía máy chủ (Go/Gin và cơ sở dữ liệu), hệ thống thực tế bắt buộc phải có đầy đủ các tầng phòng thủ:
1. **Xác thực phiên làm việc cho Duy Nhất Một Chủ Sở Hữu (Single-Owner Auth):**
   - Đăng nhập và quản lý phiên (session) hoàn toàn phía máy chủ. Mật khẩu băm bằng thuật toán an toàn (Argon2id).
   - Phiên làm việc lưu trữ qua Cookie an toàn: đầy đủ cờ `HttpOnly`, `Secure`, `SameSite=Lax/Strict`.
   - Cơ chế phòng chống tấn công giả mạo yêu cầu chéo trang (CSRF Protection), cơ chế hủy phiên và xoay vòng định kỳ (session rotation).
2. **Ủy quyền & Kiểm soát truy cập trên MỌI Endpoint Quản trị:**
   - Kiểm tra quyền quản trị viên trên từng API endpoint phía máy chủ; **tuyệt đối không chỉ dựa vào việc ẩn nút bấm trên giao diện người dùng**.
   - Ghi nhật ký kiểm toán (Audit Logs) cho mọi hành động quản trị: đăng bài, xóa nội dung, thay đổi cấu hình nguồn thu nạp, thử nghiệm crawl.
3. **Phòng chống Tấn công SSRF (Server-Side Request Forgery) khi Thu Nạp Nguồn:**
   - Không bao giờ cho phép người dùng hoặc quản trị viên gửi yêu cầu fetch tới URL tùy ý.
   - Bắt buộc phải có danh sách trắng (Allowlist) tên miền và giao thức được phép.
   - Kiểm tra phân giải tên miền (DNS Resolution check) và kiểm tra từng bước chuyển hướng (redirect): Chặn đứng mọi dải IP nội bộ, loopback (`127.0.0.1`), private networks (`10.0.0.0/8`, `192.168.0.0/16`), link-local và cloud metadata endpoints (`169.254.169.254`).
   - Thiết lập giới hạn thời gian chờ (timeout) chặt chẽ, giới hạn kích thước tệp tải về tối đa và kiểm tra kiểu nội dung (`Content-Type`).
4. **Quy Trình Kiểm Dịch Nguồn Bắt Buộc (Strict Quarantine Workflow):**
   - Quy trình nạp liệu luôn tuân thủ tuần tự: **Quarantine / Draft (Cách ly / Bản nháp) → Chủ sở hữu rà soát nguồn, bản quyền và nội dung → Duyệt phát hành (Publish)**.
   - Tuyệt đối không bao giờ tự động phát hành (auto-publish) bài đọc hoặc câu hỏi ngay sau khi hoàn tất crawl hoặc phân tích cú pháp.
5. **Bảo Vệ Đáp Án & Chống Gian Lận Thi Cử:**
   - API phân phối đề thi cho học sinh tuyệt đối không trả về cờ `is_correct` hoặc đáp án đúng trong gói tin JSON.
   - Việc chấm điểm được thực hiện hoàn toàn tại máy chủ thông qua mã định danh nộp bài ký bảo mật (`attempt_token` HMAC-SHA256).

---

## 7. Trạng Thái Tiến Độ & Quy Trình Thẩm Định

- **Tiến độ thiết kế:** Phạm vi giao diện v2 đã hoàn thành trọn vẹn 11 màn hình theo đặc tả, sử dụng đầy đủ các component chuẩn của shadcn/ui, đáp ứng yêu cầu thẩm mỹ sáng sủa, thân thiện với lứa tuổi học sinh THCS.
- **Quy trình nghiệm thu:**
  1. Đội ngũ kiểm thử độc lập tiến hành thẩm định mã nguồn tĩnh và giao diện.
  2. Bằng chứng kiểm tra kiểu (typecheck) và biên dịch (build) được lưu trữ riêng tại tệp `verification.md` sau khi chạy trên môi trường thực tế (không tự ý bịa đặt kết quả hay giả mạo ảnh chụp).
  3. Trình nộp chủ sở hữu đánh giá thẩm mỹ và ra quyết định phê duyệt trước khi chuyển sang các giai đoạn tiếp theo.
