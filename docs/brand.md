# BeeJunior — thương hiệu và bảng màu

Tên website: **BeeJunior** (hằng số duy nhất `SITE.name` trong `web/lib/site-config.ts`).
Logo gốc: `web/public/brand/beejunior-logo-source.png` (2048×2048, nền trắng, không sửa).
Mọi biến thể được sinh bằng `python3 web/scripts/generate-brand.py` (chỉ cần Pillow).

## Tài sản logo (`web/public/brand/`)

| File | Dùng ở | Ghi chú |
| --- | --- | --- |
| `logo-lockup.webp` (462×88) | Header | mascot + chữ BeeJunior, nền trong suốt, ~13 KB, hiển thị 231×44 |
| `logo-full.webp` | Footer/giới thiệu | mascot + chữ, 800×399 |
| `mascot.webp` | Hero trang chủ, 404, kết quả | 512×348, dùng tiết chế |
| `wordmark.png` | dự phòng | chỉ chữ |
| `icon-*.png`, `favicon-*.png`, `apple-touch-icon.png` | favicon/PWA | nền xanh da trời, mascot ở giữa; bản maskable chừa vùng an toàn 80% |
| `og-image.png` (1200×630) | Open Graph/Twitter | nền kem, logo đầy đủ |

## Bảng màu

Màu thương hiệu lấy mẫu từ logo: vàng `#ffc001`, xanh da trời `#10b7eb`, mực `#291e1c`.
Vàng/xanh nhạt chỉ làm nền, minh hoạ hoặc nút có chữ mực; chữ và liên kết dùng mực hoặc xanh đậm.

| Token | Hex | Vai trò |
| --- | --- | --- |
| `brand` | `#ffc001` | Vàng thương hiệu: nút CTA chính (chữ mực), viền nhấn |
| `cta-hover` | `#e6ac00` | Hover/active của nút vàng (chữ mực) |
| `sky` | `#10b7eb` | Xanh logo, chỉ trang trí (không làm chữ) |
| `primary` | `#0a6590` | Xanh đậm: liên kết, nhãn nhấn, nút xanh chữ trắng, viền focus |
| `navy` (mực) | `#291e1c` | Chữ chính, nền footer |
| `navy-soft` | `#4a3f3a` | Chữ phụ, viền (độ mờ), nút vô hiệu |
| `surface` | `#fffdf5` | Nền trang (kem) |
| `warm` | `#fff6d6` | Nền vàng nhạt cho hero/khối nhấn |
| `warm-2` | `#ffedaa` | Hover vàng nhạt, nền biểu tượng |
| `sky-soft` | `#e8f7fd` | Nền xanh nhạt phụ |

Tên token cũ (`navy`, `navy-soft`, `surface`, `warm`, `warm-2`, `primary`, `cta`) được giữ để không phải đổi
hàng trăm class; chỉ giá trị đổi. `cta` = `#ffc001` (nút vàng chữ mực), hover = `cta-hover`.

### Tỷ lệ tương phản (WCAG 2.x, tính bằng công thức độ chói tương đối)

| Cặp | Tỷ lệ | Đạt |
| --- | --- | --- |
| Mực `#291e1c` trên vàng `#ffc001` (nút CTA) | 9.86 | AA, AAA |
| Mực trên vàng hover `#e6ac00` | 7.92 | AA, AAA |
| Mực trên kem `#fffdf5` | 15.9 | AAA |
| Chữ phụ `#4a3f3a` trên kem | 9.99 | AAA |
| Chữ phụ trên vàng nhạt `#fff6d6` | 9.41 | AAA |
| Xanh đậm `#0a6590` trên kem | 6.29 | AA |
| Xanh đậm trên vàng nhạt `#fff6d6` | 5.92 | AA |
| Xanh đậm trên xanh nhạt `#e8f7fd` | 5.84 | AA |
| Trắng trên xanh đậm `#0a6590` | 6.41 | AA |
| Vàng `#ffc001` trên kem (chỉ viền/nền, không chữ) | 1.61 | không dùng cho chữ |
| Kem trên mực (footer) | 15.9 | AAA |
| Xanh logo `#10b7eb` trên mực | 6.94 | AA (chỉ dùng trên nền tối) |

Không dùng `#10b7eb` hay `#ffc001` làm màu chữ trên nền sáng (tương phản < 3:1).

## Hướng thiết kế (brief)

- Phong cách: thân thiện, sáng, bo góc (`rounded-xl`/`rounded-2xl` cho thẻ và nút), nhưng không trẻ con — học sinh lớp 6–9.
- Nền trang kem, hero vàng nhạt; thẻ lớp học có viền mực mảnh (20%) và bóng nhẹ; hover đổi viền sang xanh đậm.
- Header: kem, viền dưới mực mờ, một dải vàng 4px phía trên thay cho dải navy; logo lockup bên trái, điều hướng lớp bên phải; nút menu di động 44px.
- Footer: nền mực, chữ kem, liên kết kem, vòng focus vàng; logo-full không dùng nền tối (chỉ chữ + tagline).
- Mascot dùng tiết chế: hero trang chủ, trang 404, trạng thái trống và đầu khối kết quả. Không đặt trong vùng câu hỏi.
- Nút chính: nền vàng, chữ mực đậm, bo `rounded-xl`, cao ≥ 44px, hover vàng đậm hơn, focus ring xanh đậm 2px offset 3px.
- Nút phụ: nền trắng/kem, viền xanh đậm, chữ xanh đậm.
- Hiệu ứng chỉ `motion-safe`, tôn trọng giảm chuyển động.
- Font: Be Vietnam Pro phục vụ cục bộ, không thêm CDN hay thư viện.

Original inline SVG art, skill colours, sizes and motion rules: [visual-assets.md](visual-assets.md).
