# SEO (bắt buộc)

Mọi PR chạm `web/` phải đạt các mục dưới đây; CI chặn merge nếu Lighthouse dưới ngưỡng.

## Render

- Trang nội dung render sẵn (SSG + ISR 1 giờ): HTML đầy đủ nội dung khi tắt JavaScript.
- Không có `noindex` ở production (kể cả header `X-Robots-Tag` của proxy).
- Đề ngẫu nhiên, trang kết quả: `noindex, follow`.

## Đường dẫn

Tiếng Việt không dấu, chữ thường, gạch nối, không đuôi `/`:

```
/grade-6
/grade-6/grammar
/grade-6/grammar/present-simple
/grade-6/grammar/present-simple/test-1
/grade-10-entrance
/grade-10-entrance/test-1
/tu-vung/<tu>
```

Đổi đường dẫn phải có redirect 301.

## Metadata (Next.js Metadata API)

- `title` (≤ 60 ký tự, duy nhất), `description` (≤ 155 ký tự, duy nhất), `canonical` tuyệt đối.
- Thương hiệu **BeeJunior** lấy từ `SITE.name`; tiêu đề theo mẫu `<trang> | BeeJunior` qua template gốc.
- Open Graph + Twitter `summary_large_image`: mặc định `/brand/og-image.png` (1200×630, alt "BeeJunior"), URL tuyệt đối.
- `<html lang="vi">`, một `h1` mỗi trang, heading có thứ bậc.

## Dữ liệu có cấu trúc (JSON-LD)

- `BreadcrumbList`: mọi trang.
- `Quiz` / `LearningResource` (`educationalLevel`, `teaches`, `numberOfQuestions`): trang đề.
- `FAQPage`: trang chủ đề có mục hỏi đáp.
- `Organization` + `WebSite` tên **BeeJunior**: trang chủ. Organization có URL website và logo tuyệt đối `/brand/logo-full.webp`; chỉ thêm `SearchAction` khi có tìm kiếm.

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

- Source attribution is centralized at `/data-sources`, an indexable page with
  source links, licenses, attribution and published question/passage counts by grade.
  Test pages retain provenance in the bank without displaying it.
- Entrance list/tests are static pages under `/grade-10-entrance`; all fixed tests
  and credits appear in `getAllRoutes()` and the sitemap.
- Random quizzes use in-page client state and lazy static `/pool/…` JSON;
  they create no crawlable URL or sitemap entry.
- Public AdSense environment variables and reserved-slot behavior are documented
  in `web/README.md` and `web/.env.example`. The optional loader is lazy, configures
  non-personalized requests first, and defaults child-directed treatment to ON.
  Quiz ads mount only in submitted results, outside question/passage areas.

## Chủ đề cụ thể

- Ngữ pháp và từ vựng dùng danh mục viết tay và bộ phân loại theo luật khi dựng ngân hàng; không dùng LLM. Chủ đề đủ 10 câu mới có trang và đề; Đọc hiểu, Viết câu giữ nguyên.
- Trang chủ đề có kiến thức, ví dụ, số câu và liên kết cùng kỹ năng hoặc cùng chủ đề ở lớp khác. Tổng hợp luôn đứng cuối và vẫn lấy toàn bộ câu của kỹ năng.
- `web/content/legacy-redirects.json` được sinh từ danh sách đường dẫn cũ; Next.js đọc để chuyển hướng vĩnh viễn sang Tổng hợp cùng lớp/kỹ năng. Không đưa đường dẫn đã bỏ vào sitemap.
- Số liệu, luật và tỷ lệ chưa phân loại: [Báo cáo chủ đề](topic-classification.md), sinh cùng `npm run build:tests`.

## SEO content hardening

- Tiêu đề trang lớp/kỹ năng/chủ đề/đề dùng `fitTitle`/`TITLE_MAX` để `<tiêu đề> | BeeJunior` ≤ 60 ký tự; mô tả chứa số liệu thật (số câu, đề, chủ đề) nên duy nhất theo trang.
- Mọi trang có `hreflang="vi"` (cùng canonical) qua `buildMetadata`.
- Trang lớp và kỹ năng có đoạn giới thiệu viết tay (`lib/seo-content.ts`), số liệu tính từ nội dung, danh sách chủ đề nổi bật.
- Lớp, kỹ năng, chủ đề có mục “Câu hỏi thường gặp” hiển thị trên trang; `FAQPage` JSON-LD sinh từ cùng một mảng (`components/faq-section.tsx`) nên khớp nội dung hiển thị.
- Sitemap: mọi URL có `lastmod` (trang trung tâm = ngày xuất bản đề mới nhất bên dưới; trang tĩnh = `STATIC_PAGES_LASTMOD`).
- `robots.txt` chặn `/api/` và `/pool/`; trang 404 có liên kết về trang chủ, các lớp, thi vào lớp 10.
- Test `web/tests/structured-data.test.ts` kiểm tra JSON-LD, độ dài/duy nhất metadata, hreflang, lastmod và không có `noindex`.
- Hướng dẫn Search Console cho chủ site: [seo-launch.md](seo-launch.md).
