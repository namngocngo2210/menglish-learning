# ADR 0004: Workspace TypeScript dùng `moduleResolution: Bundler`, import không đuôi `.js`

- Trạng thái: **được chấp nhận** (dev, thẻ t_e888732e; chờ reviewer xác nhận)
- Ngày: 2026-11-01
- Liên quan: [engineering-standards.md §2](../engineering-standards.md), [ADR 0001](0001-stack-typescript.md)

## Bối cảnh

Chuẩn ban đầu ghi `module: NodeNext` + import tương đối có đuôi `.js`. Khi trích `packages/core` ở S-A, `web` (Next.js 16, Turbopack) import trực tiếp mã nguồn TS của package qua `transpilePackages`. Turbopack **không** ánh xạ `./x.js` → `./x.ts`, nên build `next build` lỗi `Module not found: Can't resolve './routes.js'` ở 169 chỗ.

## Quyết định

`tsconfig.base.json` dùng `module: ESNext`, `moduleResolution: Bundler`. Import tương đối **không** có đuôi file (`from "./routes"`). Mọi nơi tiêu thụ package đều qua công cụ biết TS: Next/Turbopack (web), Vite/Vitest (test), `tsx` (CLI api hiện tại) và esbuild khi đóng gói image `api`/`worker` ở S-B. Các cờ nghiêm ngặt khác (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`…) giữ nguyên.

## Phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| Giữ NodeNext + `.js`, dùng webpack `extensionAlias` | Bỏ Turbopack (mặc định của Next 16), build chậm hơn, đổi công cụ build của web |
| Biên dịch core ra `dist/` rồi import dist | Thêm bước build trước mọi test/typecheck/Docker; vòng lặp dev chậm; dễ lệch dist cũ |
| Bundler resolution (**chọn**) | Một cấu hình chạy ở mọi nơi tiêu thụ; không bước build trung gian |

## Hệ quả

- `node file.ts` thuần (không `tsx`/bundler) không chạy được mã workspace; image production phải đóng gói bằng esbuild (kế hoạch S-B).
- `tsc --noEmit` vẫn kiểm đầy đủ kiểu; ESLint `consistent-type-imports` + `verbatimModuleSyntax` giữ nguyên.
- Đổi lại sang NodeNext khi Node chạy `.ts` trực tiếp ổn định (≥ 24 LTS) và Turbopack ánh xạ đuôi `.js`: một ADR + codemod.
