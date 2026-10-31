# SEO (bắt buộc)

Mọi PR chạm `web/` phải đạt các mục dưới đây; CI chặn merge nếu Lighthouse dưới ngưỡng.

## Render

- Trang nội dung render sẵn (SSG + ISR 1 giờ): HTML đầy đủ nội dung khi tắt JavaScript.
- Không có `noindex` ở production (kể cả header `X-Robots-Tag` của proxy).
- Đề ngẫu nhiên, trang kết quả: `noindex, follow`.

## Đường dẫn

Tiếng Việt không dấu, chữ thường, gạch nối, không đuôi `/`:

```
/lop-6
/lop-6/ngu-phap
/lop-6/ngu-phap/thi-hien-tai-don
/lop-6/ngu-phap/thi-hien-tai-don/de-1
/thi-vao-lop-10
/thi-vao-lop-10/de-1
/tu-vung/<tu>
```

Đổi đường dẫn phải có redirect 301.

## Metadata (Next.js Metadata API)

- `title` (≤ 60 ký tự, duy nhất), `description` (≤ 155 ký tự, duy nhất), `canonical` tuyệt đối.
- Open Graph + Twitter card; ảnh OG sinh động theo trang.
- `<html lang="vi">`, một `h1` mỗi trang, heading có thứ bậc.

## Dữ liệu có cấu trúc (JSON-LD)

- `BreadcrumbList`: mọi trang.
- `Quiz` / `LearningResource` (`educationalLevel`, `teaches`, `numberOfQuestions`): trang đề.
- `FAQPage`: trang chủ đề có mục hỏi đáp.
- `Organization` + `WebSite` (có `SearchAction` khi có tìm kiếm): trang chủ.

## Sitemap, robots

- `sitemap.xml` (chia nhiều file khi > 5.000 URL) sinh từ API, có `lastmod`.
- `robots.txt`: cho phép nội dung, chặn `/api/`, trang đề ngẫu nhiên, trang kết quả; khai báo sitemap.

## Liên kết nội bộ

Lớp → kỹ năng → chủ đề → đề; mỗi đề liên kết đề trước/sau, chủ đề liên quan, cùng chủ đề ở lớp khác. Breadcrumb hiển thị trên trang.

## Nội dung trang

- Mỗi trang chủ đề có đoạn giới thiệu và tóm tắt kiến thức (viết tay hoặc từ giáo viên), không chỉ danh sách đề.
- Mỗi đề có phần lời giải/giải thích sau khi nộp (nằm trong HTML sau tương tác, không lộ đáp án trước).
- Ghi nguồn câu hỏi theo giấy phép.

## Hiệu năng (Core Web Vitals)

- LCP < 2,5 s, CLS < 0,1, INP < 200 ms trên mobile.
- Font tự host (`next/font`), ảnh `next/image`, không chặn render bởi script quảng cáo (`lazyOnload`, chừa sẵn kích thước khung quảng cáo để không nhảy layout).

## Ngưỡng Lighthouse CI

| Hạng mục | Ngưỡng |
|----------|--------|
| SEO | 100 |
| Performance (mobile) | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |

Chạy trên: trang chủ, trang lớp, trang chủ đề, trang đề.

## Phase B implementation (2026-10-31)

- Source attribution is centralized at `/nguon-du-lieu`, an indexable page with
  source links, licenses, attribution and published question/passage counts by grade.
  Test pages retain provenance in the bank without displaying it.
- Entrance list/tests are static pages under `/thi-vao-lop-10`; all fixed tests
  and credits appear in `getAllRoutes()` and the sitemap.
- Random quizzes use in-page client state and lazy static `/pool/…` JSON;
  they create no crawlable URL or sitemap entry.
- Public AdSense environment variables and reserved-slot behavior are documented
  in `web/README.md` and `web/.env.example`. The optional loader is lazy, configures
  non-personalized requests first, and defaults child-directed treatment to ON.
  Quiz ads mount only in submitted results, outside question/passage areas.
