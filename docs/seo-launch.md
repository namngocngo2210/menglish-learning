# Hướng dẫn SEO khi ra mắt (dành cho chủ site)

Tài liệu này dành cho **chủ site**. Dev không thực hiện các bước trên Google Search Console (GSC); chỉ chủ site có tài khoản Google sở hữu tên miền mới làm được.

Tên miền hiện tại: `beta.meducation.vn` (tạm thời) → tên miền chính thức `beejunior.meducation.vn`. Làm lại các bước dưới đây cho tên miền mới khi chuyển.

## 1. Kiểm tra trước khi gửi

- [ ] Mở `https://<tên-miền>/robots.txt`: có `Allow: /`, không có `Disallow: /` toàn site, có dòng `Sitemap: https://<tên-miền>/sitemap.xml`.
- [ ] Biến môi trường `SEO_NOINDEX` **không** đặt là `true` trên production.
- [ ] Xem nguồn trang bất kỳ: không có `<meta name="robots" content="noindex">`; header phản hồi không có `X-Robots-Tag: noindex` (kiểm tra cả proxy/Cloudflare).
- [ ] `https://<tên-miền>/sitemap.xml` mở được, URL đều dùng đúng tên miền, có `lastmod`.
- [ ] Mỗi trang có `<link rel="canonical">` và `hreflang="vi"` trỏ về chính nó.
- [ ] Ảnh chia sẻ `/brand/og-image.png` mở được (1200×630).
- [ ] Trang 404 hiển thị liên kết về trang chủ, các lớp và trang thi vào lớp 10.

## 2. Xác minh quyền sở hữu trên Google Search Console

Truy cập <https://search.google.com/search-console> bằng tài khoản Google của chủ site.

**Cách A – Tài sản Tên miền (khuyến nghị, bao phủ mọi subdomain, http/https):**
1. Bấm **Thêm tài sản** → chọn **Tên miền** → nhập `meducation.vn`.
2. Google hiển thị một bản ghi TXT. Thêm bản ghi đó vào DNS của `meducation.vn` (nơi quản lý DNS/Cloudflare).
3. Chờ DNS cập nhật (vài phút đến vài giờ) rồi bấm **Xác minh**.

**Cách B – Tài sản Tiền tố URL (nếu không sửa được DNS gốc):**
1. Chọn **Tiền tố URL** → nhập `https://beta.meducation.vn/` (sau này `https://beejunior.meducation.vn/`).
2. Chọn phương thức: **Bản ghi DNS TXT** hoặc **Thẻ HTML** (gửi thẻ `<meta name="google-site-verification" ...>` cho dev để thêm vào layout, hoặc tải tệp HTML về đặt vào `web/public/`).
3. Bấm **Xác minh**.

## 3. Gửi sitemap

1. Trong tài sản vừa xác minh, vào **Sơ đồ trang web (Sitemaps)**.
2. Nhập `sitemap.xml` (đầy đủ: `https://beta.meducation.vn/sitemap.xml`) → **Gửi**.
3. Trạng thái phải là **Thành công**; số URL đã phát hiện gần bằng số URL trong sitemap.

## 4. Yêu cầu lập chỉ mục trang chính

Dùng **Kiểm tra URL** (ô tìm kiếm trên cùng) lần lượt cho: trang chủ, `/grade-6` … `/grade-9`, `/grade-10-entrance`, một trang chủ đề và một trang đề. Với mỗi URL: bấm **Kiểm tra URL trực tiếp** → xem "URL có thể được lập chỉ mục" → **Yêu cầu lập chỉ mục**.

## 5. Theo dõi sau ra mắt

- [ ] Sau 3–7 ngày: báo cáo **Lập chỉ mục trang** — số trang hợp lệ tăng; xem lý do "Đã phát hiện – hiện chưa được lập chỉ mục" (bình thường với site mới).
- [ ] **Dữ liệu có cấu trúc / Kết quả nhiều định dạng**: không có lỗi ở BreadcrumbList, FAQPage, Quiz/LearningResource.
- [ ] **Core Web Vitals** (sau khi đủ dữ liệu thực): LCP < 2,5 s, CLS < 0,1, INP < 200 ms.
- [ ] **Hiệu suất**: theo dõi truy vấn, trang, CTR hằng tuần.
- [ ] Kiểm tra công cụ Rich Results Test (<https://search.google.com/test/rich-results>) với 1 trang chủ đề và 1 trang đề.
- [ ] Khi đổi sang tên miền chính thức: giữ tên miền beta redirect 301 sang tên miền mới, thêm tài sản mới, gửi lại sitemap, dùng công cụ **Thay đổi địa chỉ** nếu cần.

## 6. Việc không làm

- Không dùng dịch vụ mua backlink/lập chỉ mục tự động.
- Không bật `SEO_NOINDEX` trên production; biến này chỉ để khóa môi trường thử nghiệm.
- Không hiển thị nguồn/giấy phép trên trang câu hỏi; ghi nhận nguồn tập trung ở `/data-sources`.

## 7. Chuyển URL sang tiếng Anh (2/11/2026)

Toàn bộ URL công khai đổi từ tiếng Việt sang tiếng Anh (bảng đầy đủ: `docs/url-map.md`). Ví dụ:
`/lop-6/ngu-phap/thi-hien-tai-don/de-1` → `/grade-6/grammar/present-simple/test-1`, `/thi-vao-lop-10` → `/grade-10-entrance`,
`/luyen-nhanh` → `/quick-practice`, `/gioi-thieu` → `/about`, `/lien-he` → `/contact`, `/luyen-tap-nhom/phong/ABCDEF` → `/group-practice/room/ABCDEF`.
Tiêu đề, H1, mô tả trang vẫn là tiếng Việt.

- Mọi URL cũ trả **một** lần `301` tới URL mới (giữ query `?utm_...`, không chuỗi, không vòng). Redirect do ứng dụng Next xử lý (`web/proxy.ts`), **vĩnh viễn, không bao giờ gỡ**.
- `sitemap.xml` chỉ liệt kê URL mới (cùng số lượng URL như trước). Canonical, og:url, JSON-LD đều là URL mới.
- Trang tài khoản/phòng vẫn `noindex` ở đường dẫn mới.

Việc chủ site làm trong Google Search Console (cùng tên miền nên **không** dùng Change of Address):
1. Vào thuộc tính `beejunior.meducation.vn` → **Sơ đồ trang web** → gửi lại `https://beejunior.meducation.vn/sitemap.xml` (nay chỉ chứa URL mới). Không cần xóa sitemap cũ, nó là cùng một URL.
2. **Kiểm tra URL** cho: trang chủ, `/grade-6` … `/grade-9`, `/grade-10-entrance`, một trang đề; bấm *Yêu cầu lập chỉ mục*.
3. Với vài URL cũ (ví dụ `/lop-6`), Kiểm tra URL phải báo "Trang chuyển hướng" và trỏ đúng URL mới.
4. Theo dõi 4–8 tuần: **Lập chỉ mục → Trang** (mục "Trang có chuyển hướng" tăng rồi giảm; "Đã lập chỉ mục" chuyển dần sang URL mới), **Hiệu suất** (so sánh theo trang), báo cáo **Cải tiến**/Core Web Vitals. Không đặt lại lịch sử bằng công cụ Xóa URL.
5. Các bài đăng Facebook đã lên lịch (`~/beejunior-social/queue`) dùng link đường dẫn cũ kèm UTM: vẫn hoạt động nhờ 301, nên cập nhật sang link mới khi có thể.
