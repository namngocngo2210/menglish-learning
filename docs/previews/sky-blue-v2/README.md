# Bản thiết kế v2 — hướng cam/navy mới nhất

**Bàn giao hiện tại: ảnh PNG tĩnh home + admin một chủ ở1440/390, chờ chủ duyệt thẩm mỹ; không cần demo bấm thử, chưa triển khai website.** Tên thư mục `sky-blue-v2` được giữ để không mất lịch sử, không phải palette mới.

Source đại diện mới: `app/direction/page.tsx`, `app/direction/admin/page.tsx`; xem ảnh đính kèm card/ZIP. Nếu cần tái tạo ảnh, build rồi mở `/direction/` và `/direction/admin/` qua HTTP cục bộ. Bản root và các route `partial-*` là vòng thiết kế xanh trước đó, không phải hướng đang đề xuất. Hướng mới sử dụng cam/navy tham chiếu MEnglish nhưng tên/logo vẫn tạm; Be Vietnam Pro được bundle từ `@fontsource/be-vietnam-pro@5.3.0`, không gọi font bên ngoài.

Các hướng dẫn xem fixture cũ bên dưới chỉ phục vụ lưu trữ/tái tạo, không phải tiêu chí nghiệm thu demo tương tác. Xem `verification.md` cho kiểm tra thực tế và giới hạn.

## Ghi chép vòng thiết kế xanh trước đó

> **LƯU Ý QUAN TRỌNG:** Đây là bản xem trước giao diện (**Design Preview Only**) được xây dựng để phục vụ đánh giá thẩm mỹ và trải nghiệm người dùng (aesthetic & UX review). Đây **KHÔNG** phải là mã nguồn triển khai thực tế (production implementation). Toàn bộ dữ liệu là mẫu minh họa nguyên bản (**original sample DEMO**), chạy hoàn toàn trên bộ nhớ trình duyệt (**in-memory state**), không có backend, không có hệ thống xác thực (auth), không lưu trữ cookie/token/mật khẩu và không kết nối mạng ngoài.

---

## 1. Thông Tin Bản Thiết Kế

- **Tác giả giao diện:** Gemini gemini-3.8-flash-medium thông qua công cụ Antigravity CLI chính thức.
- **Tên ứng dụng (Tạm thời):** "Góc tiếng Anh" (Kèm nhãn "Tên tạm" - thương hiệu chưa cố định).
- **Đối tượng người dùng:** Học sinh THCS (Lớp 6–9, 11–15 tuổi).
- **Công nghệ nền tảng:**
  - Next.js 16.4.3 (App Router, cấu hình Static Export `output: 'export'`)
  - React 19.3.1 & TypeScript 5.9.3
  - Tailwind CSS v4.3.3 (`@tailwindcss/postcss`, cấu hình `@import "tailwindcss";` và `@theme inline`)
  - 15 UI primitives chuẩn upstream shadcn/ui (style New York) cài đặt qua `npx --yes shadcn@4.23.0 add button card tabs badge progress dialog sheet select table input dropdown-menu skeleton alert label textarea --yes`
  - Biểu tượng vector Lucide React 1.65.0 (không dùng icon tự vẽ nhái)

---

## 2. Hướng Dẫn Cài Đặt & Chạy Thử Nghiệm

### A. Dành cho người xem bản tĩnh từ gói ZIP (Static ZIP)
Gói ZIP chứa thư mục đã xuất tĩnh sẵn (`out/`) và tài liệu hướng dẫn này.
- **Không cần cài đặt Node.js hay chạy lệnh npm để xem.**
- **CẢNH BÁO QUAN TRỌNG:** **KHÔNG THỂ** nhấp đúp chuột hoặc mở trực tiếp tệp `out/index.html` qua giao thức `file://` (khác với tệp HTML đơn lẻ v1 cũ). Do Next.js static export sử dụng các gói mã nguồn JavaScript dạng module chunks và đường dẫn tuyệt đối, trình duyệt sẽ chặn tải tài nguyên do chính sách CORS/Local file.
- **Cách xem:** Khởi chạy một máy chủ HTTP tĩnh nội bộ trỏ vào thư mục `out`:
  ```bash
  python3 -m http.server 4173 --bind 127.0.0.1 --directory out
  ```
  Sau đó mở trình duyệt và truy cập: [http://127.0.0.1:4173](http://127.0.0.1:4173)

### B. Dành cho nhà phát triển (Build từ mã nguồn)
Để biên dịch và đóng gói bản xuất tĩnh từ mã nguồn:

1. **Cài đặt thư viện phụ thuộc:**
   ```bash
   npm ci
   ```

2. **Kiểm tra kiểu dữ liệu tĩnh (Typecheck):**
   ```bash
   npm run typecheck
   ```

3. **Biên dịch và xuất bản tĩnh (Build Static Export):**
   ```bash
   npm run build
   ```
   *(Lệnh này sẽ tạo thư mục `out/` chứa toàn bộ HTML, CSS và JavaScript tĩnh).*

4. **Khởi chạy máy chủ HTTP nội bộ để kiểm thử:**
   ```bash
   python3 -m http.server 4173 --bind 127.0.0.1 --directory out
   ```
   Mở trình duyệt tại: [http://127.0.0.1:4173](http://127.0.0.1:4173)

> **Ghi chú về các lệnh khác:**
> - Trong quá trình chỉnh sửa giao diện, có thể dùng lệnh `npm run dev -- --hostname 127.0.0.1` để mở dev server. Tuy nhiên, trong quy trình xem trước thông thường thì không cần chạy lệnh này.
> - Lệnh `npm start` **không hoạt động** với cấu hình static export (`output: 'export'`), do đó không sử dụng lệnh này.

---

## 3. Danh Mục 11 Màn Hình (Hash Routes)

Ứng dụng mẫu điều hướng hoàn toàn bằng URL Hash trên máy khách (client-side hash routing), đảm bảo hoạt động trơn tru trên máy chủ tĩnh mà không bị lỗi 404 khi làm mới trang:

| Hash Route | Tên Màn Hình | Vai Trò & Chức Năng |
| :--- | :--- | :--- |
| `#home` | Trang chủ học sinh | Giới thiệu bài đọc tiêu biểu, nút làm bài nhanh, không yêu cầu đăng nhập. |
| `#browser` | Kho bài đọc | Bộ lọc bài đọc theo Khối lớp (6–9), Chủ đề và Độ khó (lọc cục bộ). |
| `#quiz` | Phòng luyện thi | Đọc văn bản mẫu và trả lời 3 câu hỏi trắc nghiệm (MCQ), bộ đếm giờ mẫu. |
| `#results` | Kết quả làm bài | Xem điểm số tính toán tức thì, xem lại đáp án và giải thích chi tiết mẫu. |
| `#admin-login` | Đăng nhập Quản trị (Mock) | Nút bấm "Vào quản trị (Mock)" một chạm, không nhập/lưu mật khẩu hay token. |
| `#admin-overview` | Bảng điều khiển (Demo) | Số liệu thống kê mẫu dành riêng cho 1 chủ sở hữu duy nhất. |
| `#admin-bank` | Ngân hàng câu hỏi | Quản lý danh sách bài đọc, câu hỏi và trạng thái kiểm duyệt (Draft / Published). |
| `#admin-editor` | Soạn thảo & Xem trước | Trình tạo/sửa bài đọc, thêm câu hỏi trắc nghiệm và xem trước trực tiếp. |
| `#admin-sources` | Quản lý nguồn & Bản quyền | Danh mục nguồn dữ liệu, danh sách tác vụ crawl kiểm dịch (Mock quarantine jobs). |
| `#admin-tests` | Trộn đề & Cấu hình | Công cụ phối đề mẫu (Mixer presets), chọn ma trận kiến thức theo khối lớp. |
| `#admin-reports` | Báo cáo & Phản hồi | Báo cáo học tập mẫu và danh sách phản hồi nội dung cần xử lý. |

---

## 4. Dữ Liệu Mẫu & Ranh Giới An Toàn

- **Dữ liệu cục bộ (Local State):** Mọi thao tác thêm mới bài đọc, thay đổi trạng thái duyệt, làm bài kiểm tra đều được lưu trong bộ nhớ tạm của React (`useState`). Tải lại trang (F5) sẽ khôi phục về bộ dữ liệu mẫu mặc định ban đầu.
- **Nhãn Thao Tác Mock:** Mọi hành động quản trị nhạy cảm (Duyệt bài, Xóa bài, Thử tải lại nguồn) đều được gắn nhãn `[MOCK]` rõ ràng trên giao diện.
- **Quy trình Kiểm Dịch Nghiêm Ngặt:** Luồng dữ liệu tuân thủ nguyên tắc: **Thu nạp / Cách ly (Quarantine / Draft) → Chủ sở hữu kiểm tra nguồn & bản quyền → Phê duyệt (Publish)**. Không bao giờ tự động phát hành nội dung.

---

## 5. Trạng Thái Thẩm Định & Kiểm Thử

- Các bằng chứng kiểm thử thực tế (typecheck, build log, kết quả giao diện) được ghi nhận độc lập tại tệp `docs/previews/sky-blue-v2/verification.md`. Không tự ý công bố kết quả kiểm thử hay ảnh chụp màn hình khi chưa chạy kiểm tra.
- Phạm vi thiết kế (Design scope) của bản v2 đã hoàn thành đầy đủ theo đặc tả và sẵn sàng cho quy trình thẩm định độc lập từ reviewer và chủ sở hữu.
