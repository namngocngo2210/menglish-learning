# Luyện tập nhóm — giao diện (Sprint S3)

> UI brief (Claude) → code (Codex). Thiết kế tham chiếu: `docs/previews/group-practice/` (10 màn × 1440/390, BeeJunior). API: [group-practice-api.md](group-practice-api.md). Quyết định D1–D14: [group-practice-plan.md](group-practice-plan.md#6-quyết-định-của-chủ-sở-hữu).

## Cờ tính năng
- `ROOMS_ENABLED` (đọc lúc **build** ở phía web, `web/lib/rooms/flag.ts`, `true`/`1`) mặc định TẮT.
- TẮT: `/luyen-tap-nhom` hiện trang "Sắp ra mắt" (noindex, không vào sitemap, không có form); `/luyen-tap-nhom/phong/*` và `/vao` trả 404; không có mục menu, không có nút "Tạo phòng từ đề này".
- BẬT: landing index + sitemap + mục menu "Luyện tập nhóm"; nút D14 trên trang đề.
- Giao tiếp với service rooms qua cùng origin `/rt/*`. Chỉ khi `ROOMS_DEV_PROXY` được đặt, `next.config.ts` thêm rewrite `/rt/:path*` → proxy đó (dev cục bộ). Production dùng Caddy (S4, ngoài phạm vi).

## Route
| Route | Loại | SEO |
|-------|------|-----|
| `/luyen-tap-nhom` | SSG | index, canonical, OG, JSON-LD BreadcrumbList + FAQPage + WebPage, sitemap, có `AdSlot` (chỉ ở đây, D9) |
| `/luyen-tap-nhom/phong/[ma]` | vỏ client, mọi trạng thái trong một route | `robots: noindex,nofollow` (meta) + `X-Robots-Tag: noindex, nofollow` + `Referrer-Policy: no-referrer` + `Cache-Control: no-store` (next.config `headers()`), không trong sitemap, không link nội bộ tới, **không AdSlot**, không script quảng cáo |
| `/luyen-tap-nhom/vao?ma=` | chuyển hướng client tới `/phong/[ma]` | noindex |

## Trạng thái của vỏ phòng (một route)
`loading` → `GET /snapshot`: 401 `no_session` ⇒ `GET /preview` ⇒ **join** (tên hiển thị) | 404 ⇒ **không tìm thấy phòng** | 409 đầy/khóa/đã bắt đầu ⇒ **phòng đầy / không vào được**.
Sau khi có session, kết quả suy ra từ snapshot: `lobby` (chủ phòng / người chơi) → `playing` + `me.status=playing` ⇒ **làm bài**; `me.status=submitted` ⇒ **chờ**; `results` ⇒ **kết quả** (+ xem đáp án, chơi lại, báo cáo); `closed` ⇒ **phòng đã đóng** (lý do từ `room_closed`: `host_closed`, `idle`, `empty`, `maintenance`, `expired`). `host_changed` ⇒ thông báo trong vùng aria-live. `server_restarting` ⇒ banner cảnh báo. `superseded` ⇒ màn "Đang dùng ở tab khác".
Realtime: `EventSource('/rt/rooms/<ma>/events')`; `snapshot`/`rematch` áp trực tiếp, mọi sự kiện khác thì gọi lại `/snapshot` (ETag/304) có gom nhịp. `retry` do server; khi `EventSource` lỗi liên tục ⇒ polling `/snapshot` mỗi 3 s. `game_started` ⇒ `GET /quiz`; `results_ready` ⇒ `GET /results`.

## Quy tắc nghiệp vụ UI
- Làm bài: dùng lại `SectionedPractice` (PR #16) với `feedback="none"`; **không** có đúng/sai, điểm, đáp án, lời giải, hay tiến độ người khác. Chỉ hiển thị "Đã nộp: x/y người". Đáp án lưu bằng `PUT /answers` ngay khi chọn (lạc quan, thử lại khi lỗi); vào lại thì khôi phục từ `GET /quiz`.
- Nộp bài: nút "Nộp bài" ở `footer` của SectionedPractice; hộp xác nhận (`<dialog>`) nêu số câu chưa trả lời; sau khi nộp không sửa được.
- Hẹn giờ: chip đồng hồ từ `deadlineAt` hiệu chỉnh bằng `serverNow`; `role="timer"`, không `aria-live` mỗi giây; thông báo lịch sự ở mốc còn 5 phút/1 phút. Hết giờ server tự nộp.
- Mọi người chơi (cả chủ phòng) ở phòng chờ: nút lớn "Sẵn sàng" / "Bỏ sẵn sàng" (`aria-pressed`), bộ đếm "Đã sẵn sàng 3/4", mỗi người có nhãn chữ "Sẵn sàng" / "Chưa sẵn sàng" (không chỉ màu); thay đổi được đọc qua vùng aria-live; đổi cài đặt đề hiện thông báo "Mọi người cần bấm Sẵn sàng lại".
- Chủ phòng: sao chép mã / đường dẫn (phản hồi bằng vùng aria-live), khóa phòng, chỉnh giờ & sĩ số, đuổi, Bắt đầu (cần ≥ 2 người đang kết nối và mọi người đã bấm Sẵn sàng; nút tắt kèm lý do "Chờ N người sẵn sàng"; khi đủ: "Tất cả đã sẵn sàng, chủ phòng có thể bắt đầu"), Kết thúc sớm, Đóng phòng, Chơi lại.
- 1v1 (maxPlayers = 2): rời ở phòng chờ ⇒ ván hủy; rời lúc đang làm ⇒ đối thủ thắng (hiển thị `duel`).
- Hòa điểm cùng hạng (không đua tốc độ). Chữ trong mockup "người nộp sớm hơn đứng trên" KHÔNG dùng; ghi "Bằng điểm: xếp chung hạng".
- Báo cáo ẩn danh tối giản (D8): nút "Báo cáo" ở màn kết quả → chọn 1 trong 3 lý do (`ten_khong_phu_hop`, `noi_dung_sai`, `khac`) → `POST /report`; không văn bản tự do.
- Không lưu tên vào localStorage; chỉ cookie token do server đặt. Không gửi request ra ngoài origin.

## Landing & form
- Chọn đề "Đề có sẵn": lớp → kỹ năng → đề (danh mục dựng lúc build từ nội dung đã xuất bản, truyền vào client dạng props nhỏ: slug, tiêu đề, lớp, kỹ năng, số câu) hoặc dán đường dẫn/slug (nhận cả URL đầy đủ). `?de=<slug>` chọn sẵn (nút D14). Thẻ xem trước: tiêu đề, số câu, lớp · kỹ năng.
- "Trộn theo loại": lớp (6–9), kỹ năng (nhiều lựa chọn), chủ đề (chọn), số câu 10/20/40, độ khó (Dễ/Vừa/Khó/Cân bằng), giờ (Không giới hạn / 15 / 30 phút), sĩ số (2 đấu đôi, 5, 10, 20, 30, 45), tên hiển thị (1–20 ký tự). Hiển thị **số câu khả dụng** theo bộ lọc (từ danh mục build) và chặn tạo nếu ít hơn số câu chọn; lỗi `422 not_enough_questions` từ server cũng hiển thị gọn.
- Vào bằng mã: ô 6 ký tự (chuẩn hóa: bỏ khoảng trắng/gạch, in hoa; bảng chữ `23456789ABCDEFGHJKMNPQRSTUVWXYZ`), điều hướng tới `/luyen-tap-nhom/phong/<MÃ>`.
- Lỗi form: ngay cạnh trường, `aria-describedby`, `role="alert"` cho lỗi từ server; trạng thái đang gửi khóa nút.
- Thông điệp quyền riêng tư: không tài khoản, không chat, tên chỉ tồn tại trong phòng, phòng tự xóa.

## Thị giác & a11y
BeeJunior: CTA vàng `#ffc001` chữ ink `#291e1c`; xanh `#0a6590` cho liên kết/chọn; nền `#fffdf5`; thẻ bo 12–16px; dùng token Tailwind sẵn có (`bg-cta`, `text-primary`, `bg-warm`, `bg-sky-soft`, `text-navy`...). Chữ ≥ 16px, câu hỏi ≥ 20px; mục tiêu chạm ≥ 44px; focus ring thấy rõ; tôn trọng `prefers-reduced-motion`; icon lucide `aria-hidden`; nút chỉ icon có `aria-label`; trạng thái không chỉ dựa vào màu. Kiểm tra 390 và 1440, không cuộn ngang. Lighthouse ngưỡng giữ nguyên (SEO 100, Perf ≥ 90, A11y ≥ 95, BP ≥ 95); thêm URL landing vào `lighthouserc.json`.

## Kiểm thử
- vitest (`web/tests/rooms-*.test.ts[x]`): cờ, cấu hình SEO/headers/sitemap, không `AdSlot`/script quảng cáo trong phòng, máy trạng thái UI, client API, chuẩn hóa mã, form, quét chuỗi để đảm bảo màn làm bài không bao giờ nhận/hiển thị `correctKey`/`explanation`.
- Playwright (`web/e2e/rooms-*.spec.ts`, 390 + 1440): luồng 1v1 (hai browser context) và luồng 3 người (mix, đuổi, kết thúc sớm/chơi lại), rooms chạy cục bộ sau proxy dev (`web/e2e/support/`), axe-core + kiểm tra mục tiêu chạm ≥ 44px.
