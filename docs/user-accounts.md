# Tài khoản người dùng (đăng ký email + Google) — thiết kế & rủi ro pháp lý

> **Trạng thái: THIẾT KẾ, chờ chủ duyệt. Chưa có mã, migration, ứng dụng OAuth hay bí mật nào.** Quyết định liên quan: [ADR 0008](adr/0008-user-accounts-parent-first.md).
> **Phạm vi chủ chốt (2/11):** đăng ký email + mật khẩu và đăng nhập Google. **Không Facebook** (chỉ ghi "có thể làm sau", mục 5.3). Luyện tập ẩn danh giữ nguyên, không có "tường đăng nhập".
> Đây **không phải tư vấn pháp lý**. Mọi kết luận pháp lý đánh dấu **[cần xác nhận với luật sư]**; mục 9 liệt kê điều chưa kiểm chứng được.

## 0. Phát hiện quan trọng (đọc trước)

1. **Nghị định 13/2023/NĐ-CP đã hết hiệu lực từ 01/01/2026**, thay bằng **Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15** (hiệu lực 01/01/2026) và **Nghị định 356/2025/NĐ-CP** (ký 31/12/2025, hiệu lực 01/01/2026; điều khoản hiệu lực nêu NĐ 13/2023 hết hiệu lực từ ngày đó). Các tài liệu trong repo (`security.md`, `group-practice*.md`) vẫn viện dẫn NĐ 13 — cần cập nhật khi sửa Chính sách (mục 7).
   Nguồn: [Luật 91/2025/QH15 toàn văn](https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Luat-Bao-ve-du-lieu-ca-nhan-2025-so-91-2025-QH15-625628.aspx), [NĐ 356/2025/NĐ-CP](https://thuvienphapluat.vn/van-ban/Quyen-dan-su/Nghi-dinh-356-2025-ND-CP-huong-dan-Luat-Bao-ve-du-lieu-ca-nhan-687428.aspx).
2. **Ngưỡng tuổi theo văn bản (đã đọc nguyên văn):**
   - NĐ 13/2023 Điều 20 khoản 2 (đã hết hiệu lực): xử lý dữ liệu trẻ em "phải có sự đồng ý của trẻ em trong trường hợp trẻ em **từ đủ 7 tuổi trở lên** và có sự đồng ý của cha, mẹ hoặc người giám hộ"; bên xử lý "phải **xác minh tuổi** của trẻ em"; khoản 3: phải ngừng/xóa không thể khôi phục khi hết mục đích hoặc cha mẹ rút đồng ý. [Toàn văn NĐ 13](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-13-2023-nd-cp-bao-ve-du-lieu-ca-nhan-119230516104357809.htm).
   - **Luật 91/2025 Điều 24 (hiện hành):** người đại diện theo pháp luật thay mặt trẻ em thực hiện quyền của chủ thể dữ liệu; "xử lý dữ liệu cá nhân của trẻ em nhằm **công bố, tiết lộ thông tin về đời sống riêng tư, bí mật cá nhân** của trẻ em từ đủ 07 tuổi trở lên thì phải có sự đồng ý của trẻ em và người đại diện theo pháp luật"; phải ngừng xử lý khi người đã đồng ý rút lại hoặc cơ quan có thẩm quyền yêu cầu. Điều 9: đồng ý phải tự nguyện, biết rõ loại dữ liệu/mục đích/bên kiểm soát/quyền, **theo từng mục đích**, im lặng ≠ đồng ý.
   - Tôi **không tìm thấy** điều khoản của NĐ 356/2025 nêu ngưỡng tuổi hay cách xác minh tuổi/đồng ý của cha mẹ (tìm "trẻ em" trong bản đã tải: không khớp). **Chưa xác minh** có văn bản hướng dẫn khác không. → **[cần xác nhận với luật sư]**: Điều 24 Luật 91 có đòi đồng ý của cha mẹ cho tài khoản học tập thông thường (không "công bố đời sống riêng tư") hay chỉ khi công bố; và dưới 18/16 tuổi ai là "người đại diện theo pháp luật" (Bộ luật Dân sự — chưa đọc).
3. **Google không phải ≥13 ở Việt Nam mà là ≥15.** Trang Google "Age requirements on Google Accounts": mặc định 13, **Vietnam: 15+** để tự quản lý tài khoản Google; trẻ nhỏ hơn dùng Family Link do cha mẹ quản lý. [Nguồn](https://support.google.com/accounts/answer/1350409). Học sinh lớp 6–9 (11–15 tuổi) phần lớn **không đủ tuổi** tự có Google Account.
4. **Hệ quả thiết kế:** học sinh thường không thể (và không nên) tự đăng ký. Thiết kế khuyến nghị: **phụ huynh (người lớn) tạo tài khoản, tạo hồ sơ con không có email/mật khẩu** (Phương án B). Giải quyết đồng thời: đồng ý của cha mẹ, giới hạn tuổi Google, và giảm dữ liệu của trẻ.

## 1. Mục tiêu — tài khoản để làm gì

**Tài khoản dùng cho (giá trị tối thiểu):**
- Đồng bộ tiến độ/lịch sử làm bài giữa các thiết bị (hiện chỉ `device_hash` ẩn danh).
- Chuỗi ngày học, bài đã làm, bài làm sai để ôn lại.
- Phụ huynh xem tiến độ của con.
- (Sau) tên hiển thị cố định trong Luyện tập nhóm. **Không đưa vào phạm vi này** — phòng giữ tên tạm/không tài khoản (xem mục 8.1).

**Vẫn ẩn danh, không cần đăng nhập:** xem mọi trang SEO, làm mọi đề, chấm điểm, Luyện tập nhóm, tiến độ trên thiết bị (`localStorage`). Đăng nhập chỉ là lời mời tùy chọn ("Lưu tiến độ"); không chặn nội dung nào. Khi đăng nhập lần đầu: hỏi có muốn **nhập tiến độ ẩn danh trên máy này** vào hồ sơ không (không tự động).

**Phạm vi nhỏ nhất đề xuất:** tài khoản phụ huynh + tối đa N hồ sơ con (nickname, lớp) + lưu kết quả bài làm theo hồ sơ + xem/xuất/xóa. Không: chat, ảnh, xếp hạng công khai, thanh toán, thông báo marketing.

## 2. Các phương án (chỉ email+mật khẩu và Google)

| | A. Học sinh tự đăng ký email+mật khẩu (phụ huynh nhập email <16) | **B. Tài khoản phụ huynh + hồ sơ con** | C. Chỉ Google cho ≥15/phụ huynh | D. Magic-link (không mật khẩu) |
|---|---|---|---|---|
| Ai đăng ký | Học sinh | Phụ huynh (email+mật khẩu **hoặc** Google) | Người có Google, VN ≥15 | Ai có email |
| Dữ liệu trẻ lưu | Email trẻ/phụ huynh, tên, tiến độ | Chỉ nickname + lớp + tiến độ; email là của **người lớn** | Email+tên Google của người dùng | Email |
| Đồng ý cha mẹ | Phải xác minh tuổi + liên hệ phụ huynh cho từng trẻ <ngưỡng; dễ khai gian | **Có sẵn**: người đồng ý chính là người đăng ký | Trẻ <15 không có Google → loại họ | Như A |
| Rủi ro pháp lý | **Cao** (xác minh tuổi + đồng ý gián tiếp, trẻ dùng mật khẩu yếu) | **Thấp–vừa** (xác nhận luật sư) | Thấp cho ≥15, nhưng bỏ phần lớn đối tượng | Như A |
| Bảo mật/vận hành | Quên mật khẩu cho trẻ, hỗ trợ nhiều | Quản lý 1 tài khoản/gia đình | Ít nhất (không giữ mật khẩu) | Phụ thuộc gửi mail đáng tin; trẻ mở mail khó |
| Công sức | M | M (thêm bảng hồ sơ) | S | M |
| Phù hợp 11–15 tuổi | Trung bình | **Tốt** | Kém | Kém |

**Khuyến nghị: B**, với đăng nhập phụ huynh bằng email+mật khẩu hoặc Google (Google chỉ cho người lớn — chính phụ huynh — nên không vướng 15+). Học sinh ≥16 tự đăng ký **chưa hỗ trợ** (bổ sung sau bằng cùng bảng nếu cần; **[cần xác nhận với luật sư]** mốc 16/18). Magic-link (D) có thể thay mật khẩu sau; không làm đợt đầu vì cần email tin cậy sẵn (mục 4.6) và tăng bề mặt phishing.

## 3. Mô hình dữ liệu

Bảng mới, Postgres (role riêng cho phần tài khoản, tách `admin_*`). Admin và phụ huynh là **hai principal khác nhau**: bảng, cookie, route, secret HMAC khác nhau; không bao giờ dùng chung session.

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `users` | id, email (citext, unique), email_verified_at, password_hash (argon2id, nullable nếu chỉ Google), status, created_at, deleted_at | Chỉ người lớn. Không họ tên bắt buộc. |
| `identities` | id, user_id, provider (`google`), subject (`sub`), email_at_link, created_at; unique(provider, subject) | Khóa bằng `sub`, **không** bằng email. |
| `profiles` | id, user_id, nickname (2–20 ký tự, lọc từ cấm như phòng), grade, created_at, deleted_at | Hồ sơ con. **Không** email, họ tên thật, ngày sinh, ảnh, SĐT, địa chỉ. Giới hạn ≤5/tài khoản. |
| `profile_attempts` | profile_id, attempt_id (tham chiếu bảng bài làm hiện có) | Gắn kết quả vào hồ sơ; nội dung bài làm không lưu thêm. |
| `sessions` | id, user_id, token_sha256, created, last_seen, expires, rotated_from, user_agent_hash | Giống `admin_sessions` (DB giữ sha256). |
| `consents` | id, user_id, profile_id?, purpose (`account`, `child_progress`, `parent_email_notice`), policy_version, text_hash, given_at, withdrawn_at, ip_hash | Bằng chứng đồng ý theo **từng mục đích** (Luật 91 Điều 9.4a). |
| `deletion_requests` | id, user_id, requested_at, due_at, done_at, scope (`profile`/`account`) | Để chứng minh đã xóa đúng hạn. |
| `login_attempts`, `audit_log` | dùng lại bảng hiện có (HMAC key), thêm action `user.*` | Không ghi mật khẩu/token/email thô (hash). |

**Tối thiểu hóa:** không SĐT, địa chỉ, ảnh, họ tên thật (nickname gợi ý "đừng dùng tên thật"), không ngày sinh (hỏi "bạn là phụ huynh/người giám hộ ≥18 tuổi" bằng xác nhận, không lưu ngày sinh). Google chỉ nhận scope `openid email profile`, và **chỉ lưu `sub` + email**; không lưu tên/ảnh Google.
**Lưu giữ:** tài khoản/hồ sơ còn hoạt động đến khi xóa; không đăng nhập 24 tháng → email nhắc, thêm 30 ngày không phản hồi → xóa. Phiên: 30 ngày tuyệt đối, 7 ngày nhàn rỗi. `login_attempts` 30 ngày; `audit_log` về tài khoản 12 tháng (không chứa dữ liệu cá nhân thô). Con số này là đề xuất **[cần xác nhận với luật sư]**.
**Xóa:** nút "Xóa hồ sơ của con" (xóa ngay `profiles` + `profile_attempts` + consent liên quan) và "Xóa tài khoản" (xóa cứng `users`, `identities`, `sessions`, hồ sơ; giữ `deletion_requests` tối thiểu: id băm, ngày). Xong ≤72 giờ (đề xuất; thời hạn pháp định **cần xác nhận**). Trang `/xoa-du-lieu` hiện nói "không thu thập" — phải viết lại thành quy trình thật và là nơi Google/luật yêu cầu. Backup: bản xóa phải biến mất khỏi backup trong chu kỳ lưu giữ backup (ghi rõ trong Chính sách; xem [backup-offsite-r2.md](backup-offsite-r2.md)).
**Xuất dữ liệu:** `GET` JSON (tài khoản, hồ sơ, kết quả) — người dùng đã đăng nhập; giới hạn tần suất.
**Rút đồng ý:** phụ huynh rút → ngừng xử lý và xóa hồ sơ con (Luật 91 Điều 24 khoản 3; NĐ 13 Điều 20 khoản 3).
**Thông báo vi phạm:** NĐ 13 Điều 23 yêu cầu báo Bộ Công an ≤72 giờ; Luật 91/NĐ 356 có thể thay đổi — **[cần xác nhận]**; thêm bước vào runbook.

## 4. Luồng xác thực & bảo mật

Tái dùng nguyên thủy của [admin-auth.md](admin-auth.md) (`api/src/admin/crypto.ts`, `auth.ts`): argon2id (m=19456 KiB, t=2, p=1), token 32 byte với DB giữ sha256, `login_attempts` HMAC, CSRF Origin + `Sec-Fetch-Site` + `X-CSRF-Token`. **Tách** module `api/src/accounts/`, cookie `__Host-bj_user` (HttpOnly, Secure, **SameSite=Lax** để vượt qua redirect OAuth; CSRF token bắt buộc cho mọi POST), route `/api/v1/account/*`, secret `USER_SESSION_HMAC_KEY` riêng.

### 4.1 Đăng ký email
1. Form: email, mật khẩu, tick "Tôi là phụ huynh/người giám hộ, từ đủ 18 tuổi" + đồng ý Chính sách (checkbox riêng, không bật sẵn).
2. Server tạo `users` trạng thái `pending`; gửi email xác minh (token 32 byte, hash trong DB, hạn 24 giờ, dùng 1 lần). Chưa xác minh → không đăng nhập, không tạo hồ sơ con.
3. Xác minh xong → lưu `consents(purpose=account)`; đăng nhập (token phiên mới).
4. Tạo hồ sơ con → màn **đồng ý của phụ huynh** riêng (mục 7.3) → `consents(purpose=child_progress)`.
Phản hồi đăng ký/quên mật khẩu luôn giống nhau dù email tồn tại hay không (chống dò tài khoản).

### 4.2 Mật khẩu
Tối thiểu 10 ký tự, tối đa 128, không bắt ký tự đặc biệt, chặn mật khẩu phổ biến (danh sách cục bộ, không dịch vụ ngoài) — theo ASVS 2.1. Không hint, không câu hỏi bảo mật. Đổi mật khẩu/đặt lại → hủy mọi phiên khác. Đặt lại qua token email như 4.1.

### 4.3 Giới hạn, khóa
5 lần sai/15 phút/IP và 10 lần/giờ/tài khoản → 429 + `Retry-After` (như admin). Khóa tài khoản **mềm** (không khóa cứng như admin, vì khóa-DoS lên phụ huynh): sau 10 lần sai, phải qua Turnstile + chờ 15 phút. Gửi email (đăng ký/đặt lại): 3/giờ/địa chỉ, 10/giờ/IP. Dummy hash cho email không tồn tại (đã có ở admin).

### 4.4 Phiên
Mỗi đăng nhập cấp token mới, hủy token cũ (chống session fixation). "Đăng xuất mọi thiết bị" = hủy hết `sessions` của user. Đổi mật khẩu/liên kết Google → hủy phiên khác.

### 4.5 Google (OpenID Connect, code flow + PKCE)
- Server tạo `state` (ràng buộc cookie phiên tạm, hạn 10 phút), `nonce`, `code_verifier` (PKCE S256); redirect đến Google; callback kiểm `state`, đổi code ở server, kiểm chữ ký `id_token`, `aud`, `iss`, `exp`, `nonce`. Client secret chỉ ở server (`GOOGLE_CLIENT_SECRET[_FILE]`).
- Scope: chỉ `openid email profile`. Theo Google đây là scope không nhạy cảm; không cần xác minh scope nhạy cảm nhưng cần **brand verification** khi publish ([Google](https://developers.google.com/identity/verification/authentication-policy-compliance)).
- **Liên kết & chống chiếm tài khoản:** chỉ coi email Google là đã xác minh khi `email_verified=true`. Đăng nhập Google lần đầu: nếu đã có `users` cùng email **chưa** liên kết Google → **không tự gộp**; yêu cầu đăng nhập bằng mật khẩu (hoặc xác minh qua email) rồi mới liên kết trong trang Tài khoản. Khóa danh tính bằng `sub`. Không cho gỡ phương thức đăng nhập cuối cùng.
- Tài khoản tạo bằng Google vẫn phải qua bước tick "tôi là phụ huynh ≥18" và đồng ý Chính sách trước khi có hồ sơ (Google không chứng minh tuổi ≥18 hay quan hệ phụ huynh).

### 4.6 Bot/lạm dụng và email
- **Cloudflare Turnstile** (miễn phí, không giới hạn lượt thử thách, WCAG 2.2 AAA; free tối đa 20 widget, 10 hostname/widget): [bảng gói](https://developers.cloudflare.com/turnstile/plans/). Đánh đổi: gọi script Cloudflare (bên thứ ba; cần CSP + ghi vào Chính sách), chỉ đặt trên form đăng ký/đặt lại/đăng nhập sau nhiều lần sai, **không** đặt trên trang làm bài. Phương án thay: chỉ rate limit + hạn mức email (không bên thứ ba) — chấp nhận được nếu mới có ít người dùng. Khuyến nghị: bắt đầu **không Turnstile**, bật khi thấy lạm dụng (cờ cấu hình) — **[quyết định #6]**.
- **Gửi email** (cần cho xác minh/đặt lại; SPF + DKIM + DMARC trên `meducation.vn` hoặc subdomain gửi riêng như `mail.beejunior.meducation.vn`). Giá theo các trang so sánh năm 2026 (thay đổi nhanh, **kiểm lại trước khi chọn**):

| Dịch vụ | Gói miễn phí | Trả phí | Ghi chú |
|---|---|---|---|
| Brevo | 300 email/ngày | từ ~$9/tháng | dùng chung hạ tầng với marketing; đặt vào hộp thư kém hơn chuyên dụng ([so sánh](https://lettr.com/blog/best-transactional-email-services)) |
| Resend | 3.000/tháng, 100/ngày | $20/50k | DX tốt; cần xác minh domain mới gửi cho người khác ([Brevo blog](https://brevo.com/blog/best-transactional-email-api)) |
| Amazon SES | credit AWS cho tài khoản mới | ~$0,10–0,16/1.000 | rẻ nhất; sandbox đến khi AWS duyệt; tự xử lý bounce |
| Mailtrap | 4.000/tháng, 150/ngày | $15–20 | |
| SMTP máy chủ tự gửi | $0 | — | **Không khuyến nghị**: IP dùng chung dễ vào spam, rủi ro cho mail đặt lại mật khẩu |

Khối lượng dự kiến thấp (xác minh + đặt lại) nên **gói miễn phí đủ**. Khuyến nghị tạm: Resend hoặc Brevo free (chủ chọn; **không chọn dịch vụ trả phí** khi chưa duyệt). Dịch vụ gửi mail là **bên xử lý dữ liệu ở nước ngoài** → ghi vào Chính sách; chuyển dữ liệu ra nước ngoài **[cần xác nhận với luật sư]** (NĐ 356 có hồ sơ chuyển dữ liệu xuyên biên giới — chưa đọc chi tiết).

### 4.7 Ánh xạ ASVS L2 (rút gọn, tính năng này)
V2 Authentication (2.1 mật khẩu, 2.2 chống brute force, 2.5 đặt lại, 2.8 OTP/token một lần) · V3 Session (3.2 token ngẫu nhiên/hash, 3.3 hết hạn, 3.4 cờ cookie, 3.7 chống CSRF) · V4 Access control (mọi truy vấn lọc theo `user_id` của phiên: IDOR hồ sơ con) · V5 Validation · V7 Logging (không log bí mật/PII) · V8 Data protection (xóa/xuất, tối thiểu hóa) · V9 Communications (TLS) · V13 API · V14 Config (secret ở `.env`/file). Cập nhật [pentest-asvs-l1.md](pentest-asvs-l1.md) → L2 trong S-U4. **Không** có MFA đợt đầu (ASVS L2 2.8 khuyến nghị cho tài khoản nhạy cảm; tài khoản chỉ chứa nickname+tiến độ, rủi ro thấp — ghi nhận khoảng trống).

## 5. Việc chủ phải làm: Google Cloud (không Facebook)

Không cần trước S-U1/S-U2 (chỉ cần khi bắt đầu S-U3). Không gửi bí mật qua chat; client secret tạo ra → bỏ vào `.env` trên server (quyền 600).

1. Đăng nhập Google Cloud Console bằng tài khoản sở hữu BeeJunior (ưu tiên tài khoản tổ chức, không cá nhân dùng chung). Tạo **hai project**: `beejunior-staging` và `beejunior-prod` (chính sách Google yêu cầu tách test/production: [OAuth policy](https://developers.google.com/identity/verification/authentication-policy-compliance)).
2. *Google Auth Platform → Branding*: tên "BeeJunior", logo, email hỗ trợ, **trang chủ công khai** (`https://beejunior.meducation.vn`), **URL Chính sách quyền riêng tư** và **Điều khoản** (đã cập nhật theo mục 7 — phải xong trước), domain ủy quyền (xác minh bằng Google Search Console).
3. *Audience*: User type **External**. Trong lúc thử để **Testing** (tối đa 100 người dùng thử; riêng yêu cầu chỉ `openid/email/profile` thì ai cũng đăng nhập được và không hết hạn 7 ngày — [Manage App Audience](https://support.google.com/cloud/answer/15549945)). Khi sẵn sàng bấm **Publish app → In production**.
4. *Data access*: chỉ `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (không nhạy cảm).
5. *Clients*: tạo OAuth client "Web application". Origins: `https://beejunior.meducation.vn` (prod), staging riêng. Redirect URI (HTTPS bắt buộc, phải khớp chính xác): `https://beejunior.meducation.vn/api/v1/account/oauth/google/callback` (đường dẫn chính xác chốt ở S-U3). Tải client ID/secret → chuyển cho dev **qua kênh bí mật** (đưa vào `.env`, không dán vào chat/card).
6. *Brand verification*: nộp xác minh thương hiệu trong Console (cần: trang chủ, chính sách, điều khoản, domain đã xác minh). Với scope không nhạy cảm Google nêu chỉ cần brand verification; thời gian tài liệu chỉ nêu **tối đa ~10 ngày cho scope nhạy cảm** ([sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)); thời gian brand verification cho app chỉ-đăng-nhập **chưa xác minh được** — dự trù 1–2 tuần.
7. Trước khi xác minh: trang chủ không được chỉ là trang đăng nhập, có mô tả rõ BeeJunior dùng dữ liệu Google làm gì; chính sách khớp thực tế (Google API Services User Data Policy áp dụng cả khi chưa xác minh — [Google](https://support.google.com/cloud/answer/13464323)).
8. Chưa xác minh/Testing: người dùng thấy màn cảnh báo → **không mở cho công chúng** trước khi Publish + brand verified.

### 5.3 Facebook — có thể làm sau (không thuộc phạm vi)
Ghi nhận để khỏi quên: Meta yêu cầu app Live mode, `public_profile` Advanced Access, Business Verification khi xin Advanced Access, URL chính sách và callback xóa dữ liệu; app Development hiện có không phục vụ công chúng ([App Modes](https://developers.facebook.com/documentation/development/build-and-test/app-modes), [Business Verification](https://developers.facebook.com/documentation/development/release/business-verification), [Data deletion callback](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback)). Điều khoản Meta yêu cầu ≥13 tuổi (mục tham khảo; **chưa trích được đoạn nguyên văn** trong trang đã tải — chưa xác minh). Không phân tích thêm.

## 6. Tác động

### 6.1 Luyện tập nhóm
Giữ nguyên: tên tạm, token phòng, không DB. Không nhận danh tính tài khoản trong `rooms/` (tránh biến phòng thành nơi xử lý dữ liệu tài khoản và mở rộng phân tích pháp lý). Có thể sau này cho "dùng nickname hồ sơ" bằng cách trình duyệt gửi nickname như tên tạm (không gửi user id). Chưa làm.

### 6.2 SEO
`/dang-nhap`, `/dang-ky`, `/tai-khoan/*`, `/xac-minh-email`, `/dat-lai-mat-khau`: `noindex, nofollow` (meta **và** `X-Robots-Tag`), không vào sitemap, không liên kết từ nội dung; không chặn bằng `robots.txt`. Không tạo trang mỏng. Nút "Đăng nhập" ở header là link thường tới trang noindex (không ảnh hưởng LCP/CLS; đo lại Lighthouse S-U2). Trang đề/lớp/chủ đề vẫn SSG, không đọc cookie phiên ở phía server (giữ cache edge — [ADR 0005](adr/0005-ssr-in-process-snapshot-edge-cache.md)); trạng thái đăng nhập lấy phía client sau tải trang.

### 6.3 Quảng cáo
Đã chế độ trẻ em/không cá nhân hóa. Thêm: **không quảng cáo** ở trang tài khoản/đăng nhập/hồ sơ; không dùng dữ liệu tài khoản cho quảng cáo; không cookie analytics gắn user id.

### 6.4 Tài nguyên & triển khai (D8)
Cap hiện tại ≈1,12 GB (`backend-decisions.md` D8: web 384, api 160, postgres 256, worker 320, +192 rooms). Tài khoản chạy **trong `api` hiện có**, không thêm container: argon2id m=19 MiB × số đăng nhập đồng thời (đỉnh ~2–4 cùng lúc → +40–80 MB tạm; **[ước, cần đo]** → giới hạn đồng thời băm = 2, hàng đợi, 429 khi đầy; có thể phải nâng `api` 160→192 MB). Postgres: bảng nhỏ (hàng chục nghìn dòng ≈ vài chục MB), chạy được trong 256 MB; thêm role DB riêng. Redis không dùng (D2): rate limit trong Postgres như admin. Triển khai: cờ `ACCOUNTS_ENABLED` mặc định TẮT; migration chỉ thêm bảng (có `down`); deploy sau khi Chính sách mới lên; backup đã phủ DB (nhớ yêu cầu xóa/backup). Deploy do chủ/ops, ngoài giờ học.

## 7. Thay đổi bắt buộc ở site (chưa làm trong PR này)

7.1 **Chính sách quyền riêng tư** (`web/app/chinh-sach-bao-mat`): hiện nói "không thu thập dữ liệu cá nhân" → sai khi bật tài khoản. Viết lại: bên kiểm soát (**tên pháp nhân/chủ sở hữu và liên hệ — chủ cung cấp**), dữ liệu thu thập (email người lớn, nickname/lớp con, kết quả, mã Google `sub`), mục đích, không bán/chia sẻ, bên xử lý (nhà gửi email, Cloudflare, Google), nơi lưu, thời hạn, quyền (truy cập, sửa, xóa, rút đồng ý, xuất), cách thực hiện, tuổi (tài khoản chỉ dành cho người từ 18 tuổi; trẻ dùng qua hồ sơ), cookie phiên chức năng, ngày hiệu lực + số phiên bản. Cập nhật mục "Luyện tập nhóm" (cookie token phòng) cùng lúc, và thay viện dẫn "NĐ 13" bằng Luật 91/2025 + NĐ 356/2025.
7.2 **Điều khoản sử dụng**: điều kiện tài khoản, trách nhiệm phụ huynh, nickname không dùng tên thật, quyền khóa tài khoản, xóa.
7.3 **Thông báo cookie**: chỉ cookie chức năng (phiên, token phòng) → thông báo ngắn, không cần banner chấp nhận; **[cần xác nhận]** nếu thêm Turnstile (cookie/ script bên thứ ba).
7.4 **Lời đồng ý (VI), mẫu chữ:**
- Tài khoản: "☐ Tôi là cha/mẹ hoặc người giám hộ, từ đủ 18 tuổi. ☐ Tôi đã đọc và đồng ý Chính sách quyền riêng tư và Điều khoản sử dụng của BeeJunior."
- Hồ sơ con (hộp riêng, không bật sẵn): "Tôi đồng ý để BeeJunior lưu **biệt danh, lớp và kết quả luyện tập** của con tôi để đồng bộ tiến độ. BeeJunior không hỏi họ tên thật, ngày sinh, số điện thoại, địa chỉ hay ảnh của con, và không dùng dữ liệu này để quảng cáo. Tôi có thể xem, tải về, xóa hồ sơ hoặc rút đồng ý bất cứ lúc nào tại Tài khoản › Hồ sơ của con." + dòng gợi ý: "Hãy giải thích cho con và hỏi ý con trước khi tạo hồ sơ." (phản ánh yêu cầu đồng ý của trẻ ≥7 tuổi trong NĐ 13 Điều 20; Luật 91 Điều 24 giới hạn ở trường hợp công bố đời sống riêng tư — **[cần xác nhận]**; thêm dòng này là biện pháp thận trọng, không tốn kém).
7.5 **Luồng đồng ý của phụ huynh:** xác minh email của phụ huynh (có sẵn) + tick xác nhận ≥18 + hộp đồng ý riêng cho hồ sơ con. Không thu giấy tờ tùy thân hay thẻ (vi phạm tối thiểu hóa; tăng rủi ro). **Giới hạn thật:** không có cách chắc chắn kiểm tra người đăng ký đúng là phụ huynh ("xác minh tuổi" của NĐ 13 Điều 20.2 chỉ làm được ở mức tự khai + email) — **[cần xác nhận với luật sư]** mức xác minh chấp nhận được.
7.6 **`/xoa-du-lieu`**: quy trình thật (nút trong tài khoản, form yêu cầu cho người không còn đăng nhập qua email đã đăng ký, thời hạn xử lý, kết quả xác nhận). Cần kênh liên hệ thật (`/lien-he` hiện chưa có email/điện thoại — TODO của chủ).
7.7 Tài liệu repo: sửa `security.md` §"Dữ liệu trẻ em", `group-practice*.md` §Quyền riêng tư để dẫn Luật 91/NĐ 356 (làm ở S-U2, không trong PR thiết kế này).

## 8. Kế hoạch sprint

| Sprint | Nội dung | Công sức [ước] | Nghiệm thu |
|---|---|---|---|
| **S-U1** Lõi | migration các bảng mục 3; `api/src/accounts/` (đăng ký, xác minh email, đăng nhập, phiên, CSRF, rate limit, đặt lại mật khẩu, xóa/xuất); gửi email qua adapter (cổng) + SMTP giả khi test; cờ `ACCOUNTS_ENABLED` | L (~5–7 ngày) | test đơn vị + tích hợp; không rò mật khẩu/token vào log; không thể dùng cookie admin cho route người dùng và ngược lại; IDOR hồ sơ bị chặn; coverage theo `engineering-standards.md` |
| **S-U2** Giao diện | `/dang-ky`, `/dang-nhap`, `/tai-khoan`, hồ sơ con, đồng ý, `/xoa-du-lieu` thật, Chính sách + Điều khoản mới, nhập tiến độ ẩn danh | L (~5–7 ngày) | noindex đúng; Lighthouse SEO 100, A11y ≥95; tiến độ ẩn danh vẫn chạy khi tắt cờ; chủ duyệt chữ pháp lý |
| **S-U3** Google | luồng OIDC+PKCE, liên kết an toàn, tích hợp client | M (~3 ngày) + thời gian xác minh của Google | test state/nonce/PKCE sai bị từ chối; không tự gộp email trùng; scope = 3 scope |
| **S-U4** Cứng hóa | pen test ASVS L2 theo tính năng, tải (argon2 đồng thời + RAM), bot (Turnstile nếu cần), runbook vi phạm dữ liệu, kiểm xóa khỏi backup | M (~3 ngày) | báo cáo pentest không còn High; đo RSS `api` ≤ cap; checklist Definition of Done |

**Rủi ro:** (1) kết luận pháp lý sai/đổi (luật mới, hướng dẫn chưa đủ) → luật sư duyệt Chính sách trước S-U2 mở; (2) trẻ tự đăng ký bằng tài khoản của mình → không hỗ trợ, nhưng không ngăn được tự khai gian; (3) phụ huynh quên mật khẩu → hỗ trợ; (4) RAM argon2; (5) Google xác minh chậm → S-U3 có thể trễ, S-U1/2 vẫn giao được; (6) email vào spam → SPF/DKIM/DMARC + domain gửi riêng; (7) quy mô nhỏ của chủ sở hữu có thể được miễn một số nghĩa vụ (Luật 91 Điều 38) — không đoán, **cần xác nhận**.

### Quyết định chủ cần đưa ra (kèm khuyến nghị)

1. **Mô hình:** B — phụ huynh tạo tài khoản + hồ sơ con (khuyến nghị) / A / C / D. → **B**.
2. **Học sinh ≥16 tự đăng ký:** chưa hỗ trợ (khuyến nghị) / hỗ trợ ngay. → chưa.
3. **Luật sư:** thuê luật sư duyệt Chính sách + mô hình đồng ý + chuyển dữ liệu ra nước ngoài trước khi bật cho công chúng. → **có**, trước S-U2 phát hành.
4. **Pháp nhân/liên hệ** làm bên kiểm soát dữ liệu và kênh `/xoa-du-lieu` (tên, email, SĐT). → chủ cung cấp.
5. **Nhà gửi email:** Resend free hoặc Brevo free (khuyến nghị bắt đầu Resend free; chuyển SES khi vượt). Chưa chọn gói trả phí. Tên miền gửi: subdomain riêng.
6. **Turnstile:** không bật ở đợt đầu, bật khi có lạm dụng (khuyến nghị) / bật ngay.
7. **Thời hạn lưu:** 24 tháng không hoạt động + 30 ngày thông báo; xóa ≤72 giờ. → chấp nhận (sau khi luật sư xác nhận).
8. **Nhập tiến độ ẩn danh vào hồ sơ:** hỏi từng lần (khuyến nghị) / tự động.
9. **Ngân sách RAM:** cho phép nâng `api` 160→192 MB nếu đo cần. → đồng ý có điều kiện.
10. **Facebook:** hoãn (đã quyết 2/11); có thể mở lại sau.

## 9. Điều tôi chưa kiểm chứng được
- Nội dung đầy đủ NĐ 356/2025 (chỉ tìm từ khóa "trẻ em"; không thấy điều khoản riêng) và Bộ luật Dân sự (người đại diện theo pháp luật, mốc 16/18). Không có hướng dẫn chính thức về "xác minh tuổi".
- Hiệu lực của Điều 24 Luật 91 với tài khoản học tập thông thường; nghĩa vụ báo vi phạm/đánh giá tác động/chuyển dữ liệu ra nước ngoài hiện hành.
- Thời gian brand verification của Google cho app chỉ-đăng-nhập; điều khoản độ tuổi Facebook (nguyên văn); giá email có thể đã đổi.
- Bất kỳ con số RAM/thời gian nào ghi [ước] chưa được đo.
