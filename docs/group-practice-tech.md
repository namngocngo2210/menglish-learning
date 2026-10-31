# Luyện tập nhóm — thiết kế kỹ thuật, đánh đổi, khuyến nghị

> **Trạng thái: thiết kế ĐÃ DUYỆT (chủ, 31/10, D1–D14 theo khuyến nghị — xem [plan §6](group-practice-plan.md#6-quyết-định-của-chủ-sở-hữu)). Lõi phòng (S1) và lớp thời gian thực/độ bền/an toàn (S2: SSE, giới hạn tốc độ, drain, healthz, CSP) nằm trong `rooms/`, tắt mặc định bằng `ROOMS_ENABLED`; chưa có UI/deploy.** Luồng/quy tắc người dùng: [group-practice.md](group-practice.md). Hợp đồng API: [group-practice-api.md](group-practice-api.md). Mọi con số công suất/bộ nhớ là **ước tính** dựa trên kích thước dữ liệu thật của repo, phải kiểm chứng bằng test tải ở Sprint 2.

## 0. Hiện trạng ảnh hưởng thiết kế

- `web/` là Next.js standalone **tĩnh/SSG, không backend**; giới hạn 512 MB / 1 CPU (compose) hoặc 256 MB (architecture.md). Máy chủ 5,9 GB RAM dùng chung với MEnglish và các site khác (lúc đo: ~3 GB còn trống).
- Service Go `api/` + Postgres + Redis trong [architecture.md](architecture.md) **chưa tồn tại** (chỉ là kế hoạch). Tạo cả ba chỉ để chạy phòng nhóm là quá nặng.
- Ngân hàng câu hỏi: 5 file JSON ≈ **3,7 MB** (`web/content/tests/bank-*.json`) → nạp vào RAM dễ dàng.
- Mixer là TypeScript (`web/lib/mixer`: `mixTest`, `createRng`, `applyOptionOrder`), tất định theo `seed`; chấm điểm `web/lib/scoring.ts`.
- **Lưu ý bảo mật hiện có:** các trang đề cố định và `/pool/*` hiện gửi `correctKey` + `explanation` xuống trình duyệt (chấm điểm phía client). Nghĩa là học sinh biết mở DevTools **có thể tra đáp án của đề cố định/đề trộn từ trang công khai**, kể cả khi chơi nhóm. Phòng nhóm không tạo ra lỗ hổng này nhưng không thể che nó. Xem quyết định D5.

## 1. Kiến trúc đề xuất (tóm tắt)

```
Trình duyệt ──HTTPS──► Caddy ─┬─► web (Next.js tĩnh, :3000)    /luyen-tap-nhom, /luyen-tap-nhom/phong/*  (vỏ client)
                              └─► rooms (Node/TS, 1 tiến trình)  /rt/*  (POST + SSE)
                                   ├─ RAM: phòng, người chơi, đáp án
                                   └─ RAM (chỉ đọc): bank-rooms.json (có đáp án, KHÔNG public)
```

- Container mới `rooms`: Node 22 + TypeScript, **1 tiến trình, trạng thái trong RAM**, không DB, không Redis, không gọi mạng ra ngoài.
- Dùng lại **nguyên mã** `mixer`, `scoring`, schema zod từ `web/lib` (thư mục chung hoặc workspace) → không port, không lệch hành vi.
- Dữ liệu câu hỏi: bước build sinh `bank-rooms.json` (câu đã `published`, kèm `correctKey`, `explanation`) đóng vào image `rooms`; **không** nằm trong `web/public`.
- Giới hạn tài nguyên đề xuất: 0,25–0,5 CPU, **192 MB** RAM, read-only FS, user không root, `no-new-privileges`, chỉ nối mạng Caddy.

## 2. Truyền tải thời gian thực

| Tiêu chí | **SSE + POST** | WebSocket | Polling |
|----------|----------------|-----------|---------|
| Chiều dữ liệu cần | server→client (danh sách, trạng thái, đếm nộp); client→server là hành động rời rạc (POST) | hai chiều, nhưng ta không cần tần số cao | đơn giản nhất |
| Qua Caddy / proxy trường học | HTTP thường, tương thích tốt; cần tắt buffering (`flush_interval -1`) | cần upgrade, một số proxy trường chặn/ngắt | luôn qua |
| Tự nối lại | có sẵn (`EventSource`, `Last-Event-ID`) | tự viết | không cần |
| Xác thực & giới hạn tốc độ | mỗi POST là request riêng → rate limit, CSRF, kiểm tra đầu vào theo từng hành động, dễ log/đếm | phải tự làm theo từng frame | như SSE |
| Bộ nhớ / kết nối | ~1 response mở (~10–30 KB Node) | tương đương + khung WS | không giữ kết nối, nhưng tốn CPU/request |
| Mở rộng ngang | không cần sticky nếu định tuyến theo mã phòng | cần sticky | cần |
| Độ trễ | tức thời (một chiều) | tức thời | 2–3 s |

**Khuyến nghị: SSE + POST**, kèm **polling `GET /snapshot` mỗi 3 giây** làm dự phòng tự động khi SSE bị cắt (proxy trường học). Lý do: nhu cầu nhẹ (vài sự kiện/phút/phòng), không ai cần độ trễ mili-giây (không đua tốc độ), phần lớn logic là POST có kiểm tra.
Chi tiết: heartbeat comment 20 s; gửi `retry: 3000`; mỗi lần nối lại server gửi **snapshot đầy đủ** (không cần phát lại sự kiện); `id:` tăng dần theo phòng.

## 3. Nơi giữ trạng thái phòng

| Phương án | Ưu | Nhược | Hợp với máy này? |
|-----------|----|-------|------------------|
| **A. RAM của 1 tiến trình `rooms` (khuyến nghị)** | Nhanh, đơn giản nhất, không phụ thuộc; xóa dữ liệu trẻ em rất dễ (hết phòng là hết); ~100 MB cả service | Khởi động lại/deploy làm mất phòng đang chơi; chỉ 1 instance | **Có** |
| B. Redis (pub/sub + hash) | Sống sót qua restart `rooms`; nhiều instance | Thêm service (96 MB dự kiến) + phụ thuộc mới; thêm một nơi giữ tên/đáp án của trẻ em (cần mật khẩu, TTL, kiểm toán); độ phức tạp cao hơn nhiều so với tải thực | Không (quá sớm) |
| C. Dịch vụ Go `api` + Postgres/Redis trong architecture.md | Thống nhất với kế hoạch dài hạn | Chưa tồn tại; kéo theo cả Postgres/Redis/migration; mixer phải port sang Go (cần golden test trùng seed) | Không (để dành pha sau) |
| D. Route handler trong Next.js `web` | Không thêm container | Trộn trạng thái RAM vào tiến trình SSG/ISR; limit 256–512 MB chung cho cả site; deploy `web` (thường xuyên) làm rơi mọi phòng; `output: standalone` + nhiều worker làm vỡ trạng thái | Không |

**Khuyến nghị: A (container `rooms` riêng, RAM).** Chấp nhận rủi ro "restart làm mất phòng" vì phòng chỉ sống 10–60 phút và không có dữ liệu cần giữ: giao diện hiển thị rõ "Phòng đã đóng do bảo trì, hãy tạo phòng mới"; ops tránh deploy `rooms` khi có phòng `playing` (endpoint `/rt/healthz` trả số phòng đang chơi; có chế độ **drain**: ngừng nhận phòng mới, chờ phòng cũ xong, rồi thoát). Nếu sau này cần HA, chuyển sang B hoặc C chỉ cần đổi lớp lưu trữ (giữ `RoomStore` là interface).

Port sang Go (C) chỉ nên làm khi (a) kiến trúc Go `api` đã có, và (b) có golden-vector chứng minh mixer Go trùng mixer TS theo seed.

## 4. Mã phòng và chống dò

- Định dạng: **6 ký tự** từ bảng 31 ký tự `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (bỏ `0 O 1 I L` dễ nhầm khi đọc to ở lớp học). 31⁶ ≈ **887 triệu** mã. Sinh bằng CSPRNG (`crypto.randomInt`), nhập không phân biệt hoa thường, bỏ khoảng trắng/gạch nối.
- Va chạm: kiểm tra trong tập phòng đang sống + **tombstone 10 phút** của phòng vừa đóng (tránh người nhập mã cũ vào phòng mới); trùng thì sinh lại (xác suất ≈ 10⁻⁶ với 1.000 phòng).
- Chống dò: với ≤ 300 phòng sống, xác suất đoán trúng 1 lần ≈ 3,4×10⁻⁷. Giới hạn **20 lần tra mã sai/phút/IP** + **60/giờ/IP**, tăng thời gian chờ khi vượt (429 + `Retry-After`). Phản hồi **giống hệt** cho "không tồn tại" và "đã hết hạn" (404 chung) để không lộ mã đã dùng. Chỉ phòng `lobby` mới nhận người vào, nên mã đoán trúng phòng đang chơi cũng không vào được (409 chung "không thể vào").
- Mã **không phải bí mật bảo mật** (chia sẻ qua lời nói/ảnh chụp); an toàn dựa vào: giới hạn, chỉ vào lúc phòng chờ, tên lọc, chủ phòng đuổi/khóa phòng, không lộ dữ liệu cá nhân (không có).
- Chủ phòng có công tắc **Khóa phòng** (không nhận thêm người dù còn chỗ).

## 5. Token vào lại và phiên

- Khi tạo phòng/vào phòng, server sinh `playerToken` 128 bit ngẫu nhiên (base64url) và `playerId` ngắn (không đoán được, 64 bit). Server chỉ lưu **SHA-256(token)**; so sánh thời gian hằng.
- Trình duyệt giữ token bằng **cookie chức năng** `HttpOnly; Secure; SameSite=Strict; Path=/rt/rooms/<mã>; Max-Age=10800`, chỉ phục vụ phòng này (EventSource không gửi được header tùy biến; cookie giải quyết gọn và không để token lộ qua JS/URL/log). Không phải cookie theo dõi, không chứa định danh người dùng. Phương án thay thế: `localStorage` + `fetch` stream với header `Authorization` — XSS đọc được token nên kém hơn.
- Bảo vệ CSRF: `SameSite=Strict` + kiểm tra `Origin` trùng domain + chỉ nhận `Content-Type: application/json`.
- Token vô hiệu khi: phòng đóng, người chơi bị đuổi/rời chủ động, hết 3 giờ. Không refresh token (đời ngắn).
- Vào lại: `GET /rt/rooms/<mã>/events` (SSE) hoặc `/snapshot` với cookie → server khôi phục người chơi cũ (trạng thái, đáp án đã lưu). Hai tab cùng token: tab mới thay thế tab cũ (kết nối cũ nhận `superseded` và đóng).
- Chủ phòng được nhận biết bằng `hostId` trong state phòng, **không** bằng token riêng; chuyển quyền khi mất kết nối > 60 s.

## 6. Bảo vệ đáp án và chấm điểm

- Kho đáp án nằm trong RAM server; `QuestionView` gửi client **chỉ** `{id, stem, options[{key,text}], passage}`. Không `correctKey`, không `explanation`, không `difficulty`, không `sourceUrl` trước `results`.
- **Lập phương án theo từng người:** thứ tự câu chung cả phòng (cùng đề); thứ tự phương án A–D hoán vị theo từng người từ `HMAC(roomSeed, playerId, questionId)` — giảm chép bài khi ngồi cạnh nhau ở lớp. Server giữ ánh xạ, người chơi gửi **khóa hiển thị** (A–D), server đổi về khóa gốc rồi chấm. (Tùy chọn D6: dùng cùng hoán vị cho cả phòng nếu chủ muốn đơn giản.)
- `seed` của phòng lưu trong state; trộn bằng `mixTest` (seed sinh bằng CSPRNG, **không** đoán trước được từ giờ). Đề cố định: lấy `questionIds` của test trong bank; vẫn hoán vị phương án theo người.
- Chấm: `scoreTest` phía server khi nộp hoặc khi tự nộp (hết giờ/kết thúc sớm). Client không bao giờ tự báo điểm.
- Mỗi lần chọn đáp án: `PUT /answers` chứa `{qid, key}`; server kiểm tra phòng `playing`, người chơi chưa nộp, `qid` thuộc đề, `key ∈ A–D`; bỏ qua nếu quá hạn.
- Sau `results`, `GET /review` trả `correctKey`, `explanation` **của chính người đó** (với khóa hiển thị của họ) và, cho toàn đề, lời giải. Chỉ gọi được khi phòng đã `results` (không trước đó, kể cả với người nộp sớm).
- Chống gian lận cơ bản (không cần đua tốc độ): (1) không lộ đáp án trước; (2) không lộ đáp án/tiến độ của người khác; (3) hoán vị phương án theo người; (4) giới hạn tốc độ `PUT /answers` 120/phút/người; (5) ghi nhận thời điểm nộp chỉ để tự nộp hết giờ, không xếp hạng; (6) thừa nhận giới hạn: đề cố định/ngân hàng công khai có thể tra tay (D5); đây là bài luyện tập không có giải thưởng nên không cần chống gian lận mức thi.

## 7. Lạm dụng và bảo vệ trẻ em

**Không chat, không nội dung do người chơi tạo ngoài tên hiển thị.** Mọi trường người dùng nhập: tên hiển thị, mã phòng, slug/URL đề, tham số trộn đề.

- **Tên hiển thị:** NFKC, cắt khoảng trắng, 2–20 ký tự, chỉ chữ (có dấu tiếng Việt), số, khoảng trắng, `-` `_` `.`; cấm ký tự điều khiển/RTL/emoji; không toàn số; không chứa `@`, `http`, `www`, chuỗi ≥ 6 chữ số liên tiếp (điện thoại), `zalo`, `fb`, `tiktok`… Kiểm tra **blocklist** trên bản chuẩn hóa (bỏ dấu, bỏ ký tự phân tách, gộp leetspeak `0→o, 1→i/l, 3→e, @→a`). Blocklist tiếng Việt/Anh (tục, tình dục, thù ghét, bắt nạt) lưu trong file cấu hình, **chủ sở hữu duyệt**; từ vi phạm → báo lỗi chung "Tên này không dùng được, hãy chọn tên khác". Trùng tên (không phân biệt hoa thường/dấu) trong phòng → từ chối.
- **Chủ phòng** có thể đuổi người; "Khóa phòng"; phòng có nút "Báo cáo" chỉ gửi chỉ báo ẩn danh (mã phòng + lý do chọn sẵn), không văn bản tự do (D8).
- **Tên không bao giờ vào log**; trang phòng không có link ngoài; không hiển thị tên ở bất kỳ nơi công khai nào.
- **Giới hạn chống ngập phòng/kết nối** (cấu hình bằng biến môi trường; học sinh dùng chung IP của trường nên mức cho phép rộng):

| Hành động | Giới hạn |
|-----------|----------|
| Tạo phòng | 10/giờ và 3 phòng đang sống mỗi IP; 300 phòng sống toàn hệ thống (đủ → "Hệ thống đang bận, thử lại sau") |
| Tra/vào phòng sai mã | 20/phút, 60/giờ mỗi IP |
| Vào phòng (thành công) | 120/phút mỗi IP |
| Người chơi mỗi phòng | ≤ 45 (mặc định 10); kết nối SSE ≤ 2 mỗi token, ≤ 60 mỗi IP; ≤ 2.000 toàn hệ thống |
| `PUT /answers` | 120/phút mỗi người chơi |
| Các POST khác (start, kick…) | 30/phút mỗi người chơi |
| Thân request | ≤ 4 KB, JSON, thư viện parse chặt (schema zod strict) |
| Phòng không hoạt động | `lobby` 30 phút, `results` 10 phút, `playing` ≤ 60 phút |

- **SSRF: không có bề mặt.** Dịch vụ `rooms` không thực hiện request ra ngoài. Đề cố định chỉ nhận **slug** (khớp mẫu `lop-N/<skill>/<topic>/de-N` hoặc `thi-vao-lop-10/de-N`) và tra trong bank nội bộ; nếu người dùng dán URL, **client** chỉ lấy phần đường dẫn nếu host trùng domain site rồi gửi slug; server từ chối mọi thứ không phải slug hợp lệ trong bank, không bao giờ fetch URL.
- IP thật chỉ lấy từ `X-Forwarded-For` của Caddy (proxy tin cậy). Dùng IP để giới hạn tốc độ trong RAM (cửa sổ trượt), không ghi ra log thô (băm có salt xoay theo ngày).
- Bảo vệ DoS: header giới hạn kích thước, `server.requestTimeout`/`headersTimeout`, giới hạn kết nối đồng thời, đóng SSE không heartbeat; nếu tải lớn, bật Cloudflare phía trước Caddy (đã dự kiến trong security.md).
- Header: CSP (`default-src 'self'`; không script quảng cáo trên trang phòng), `Referrer-Policy: no-referrer` ở trang phòng, `X-Content-Type-Options`, `X-Frame-Options: DENY`.

## 8. Quyền riêng tư và lưu giữ dữ liệu

Phù hợp [security.md §Dữ liệu trẻ em](security.md#dữ-liệu-trẻ-em-nghị-định-132023nđ-cp):

| Dữ liệu | Nơi lưu | Thời gian giữ | Ghi chú |
|---------|---------|---------------|---------|
| Tên hiển thị | RAM `rooms` | đến khi phòng đóng (+ tombstone chỉ lưu **mã**, không tên) | do trẻ tự nhập, khuyến cáo không dùng họ tên thật |
| Đáp án đã chọn, điểm | RAM | như trên | không ghi DB |
| Hash token vào lại | RAM | như trên | trình duyệt giữ token ≤ 3 giờ |
| Mã phòng + thời điểm tạo + cấu hình đề | RAM → số liệu tổng hợp | đếm không định danh (số phòng/ngày, cỡ phòng, điểm TB) có thể lưu, không kèm tên/mã/IP | cho thống kê chủ sở hữu |
| IP | RAM bộ đếm giới hạn tốc độ | ≤ vài giờ, dạng băm | không vào log thô |
| Log | stdout (slog JSON) | theo chính sách log hiện có | chỉ id yêu cầu, mã trạng thái, kích thước phòng; **không** tên, đáp án, IP thô |

- Không tài khoản, email, họ tên, số điện thoại, vị trí, ảnh. Không cookie phân tích/quảng cáo. Cookie token chức năng được nêu trong Chính sách quyền riêng tư (cập nhật trước khi mở tính năng).
- **Quảng cáo:** `AdSlot` không được render ở mọi route `/luyen-tap-nhom/phong/*` (kiểm bằng test); landing và trang kết quả của chính site (không phải phòng) giữ cấu hình trẻ em/không cá nhân hóa. Trong thiết kế ảnh, màn kết quả có một ô quảng cáo *giữ chỗ* — **chờ chủ quyết định D9** có cho phép ở màn kết quả hay chỉ ở landing.
- Quyền xóa: không có dữ liệu bền vững để xóa; phòng tự xóa khi đóng. Người chơi rời phòng → xóa tên và đáp án ngay (trừ khi điểm đã tính vào bảng hạng đang chờ; sau `results` bảng hạng giữ đến khi phòng đóng).
- Cần xác nhận pháp lý với chủ: có coi "tên hiển thị tạm trong RAM" là dữ liệu cá nhân của trẻ (NĐ 13) hay không; thiết kế đã giảm thiểu tối đa (D10).

## 9. Hết hạn, dọn dẹp

- Vòng quét mỗi 30 giây: đóng phòng theo bảng thời gian nhàn rỗi (§7), người chơi mất kết nối quá hạn, tombstone quá 10 phút. Mọi đối tượng phòng bị thả cho GC khi `closed` (xóa khỏi `Map`, đóng SSE còn mở).
- Trần cứng: mỗi phòng ≤ 3 giờ kể từ lúc tạo.
- Khi tiến trình nhận SIGTERM: gửi sự kiện `server_restarting`, từ chối phòng mới, chờ tối đa 30 s rồi thoát.
- Dung lượng ghi đĩa: không (FS read-only).

## 10. Bộ nhớ, công suất, giới hạn mở rộng (ước tính)

| Thành phần | Ước tính |
|-----------|----------|
| Runtime Node + code + bank (3,7 MB JSON → ~15–25 MB đối tượng) | 70–90 MB |
| Một phòng (cài đặt, danh sách id câu, hoán vị) | ~10–30 KB |
| Một người chơi (tên, hash token, đáp án ≤ 40 mục, trạng thái) | ~1–2 KB |
| Một kết nối SSE (đối tượng response + buffer) | ~15–50 KB |
| Phòng 30 người đầy | ≈ 1–2 MB |
| Phòng 2 người (1v1) | ≈ 100–150 KB |

- **Mục tiêu thiết kế:** 150 phòng sống, ~1.000 người chơi đồng thời → ≈ 50 MB thêm → tổng ≈ 120–140 MB; **hạn mức container 192 MB**, giới hạn mềm 300 phòng / 2.000 kết nối (từ chối tạo mới khi vượt, không làm sập).
- CPU: sự kiện phát sóng chỉ khi có người vào/ra, đổi trạng thái, nộp bài (không phát theo từng đáp án) → < 5 sự kiện/phút/phòng, tổng vài trăm sự kiện/giây là đỉnh trên lý thuyết; 0,25 CPU là đủ ở mục tiêu trên. Hot path: lúc `Bắt đầu` (30 snapshot) và `results` (tính xếp hạng 30 người) đều O(n) rất nhỏ.
- **Giới hạn mở rộng:** một tiến trình Node đơn luồng chịu vài nghìn SSE nhàn rỗi; nút thắt thực tế là RAM chung của máy và bộ đếm file descriptor (đặt `ulimit` ≥ 8.192). Lớn hơn nữa: chạy nhiều instance `rooms` và **định tuyến theo mã phòng** (hash của `<mã>` trong đường dẫn ở Caddy) — các phòng độc lập nhau nên không cần chia sẻ trạng thái; tạo phòng được chia theo mã được sinh ra có tiền tố phân vùng. Cần Redis/Go chỉ khi muốn sống sót qua restart hoặc cần hàng chục nghìn người đồng thời.
- Ước tính phải xác nhận: test tải (autocannon/k6) 300 phòng × 6 người, đo RSS, thời gian phản hồi p95, 429 đúng ngưỡng; ghi kết quả vào PR Sprint 2.

## 11. Quan sát, vận hành

- `/rt/healthz` (nội bộ): số phòng theo trạng thái, số kết nối, RSS; không tên/mã.
- Watchdog của ops: theo dõi RSS, 5xx, 429, số phòng sống.
- Chủ sở hữu có công tắc tắt tính năng (`ROOMS_ENABLED=false` → landing hiện "Tạm dừng", API 503).
- Kiểm thử (xem [plan §4](group-practice-plan.md#4-kế-hoạch-kiểm-thử)): đáp án không lộ trong payload, giới hạn, tên, máy trạng thái, mất kết nối, test tải.
