import Link from "next/link";
import type { ReactNode } from "react";
import { DRAFT_NOTICE, LEGAL } from "@/lib/account/legal";
import { deleteDataPath, termsPath } from "@/lib/account/paths";
import { contactPath, privacyPath } from "@/lib/routes";

const h2 = "text-xl font-bold";
const S = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => <section aria-labelledby={id} className="space-y-3"><h2 id={id} className={h2}>{title}</h2>{children}</section>;
const ul = "list-disc space-y-2 pl-6";

export function DraftBanner() {
 return <p role="note" className="rounded-xl border-2 border-red-700/50 bg-red-50 p-4 font-semibold text-red-900">{DRAFT_NOTICE} Các mục trong ngoặc vuông [ … ] do chủ sở hữu cung cấp.</p>;
}
const Meta = () => <p className="text-sm text-navy-soft">Phiên bản {LEGAL.version} · Ngày hiệu lực: {LEGAL.effective}</p>;

/** Draft of docs/user-accounts.md 7.1. Shown only when ACCOUNTS_ENABLED; replace after the lawyer review. */
export function PrivacyPolicyDraft() {
 return <article className="max-w-prose space-y-8 leading-relaxed">
  <DraftBanner/><Meta/>
  <S id="ai" title="1. Ai chịu trách nhiệm về dữ liệu"><p>Bên kiểm soát dữ liệu: {LEGAL.entity}. Liên hệ về quyền riêng tư và yêu cầu xóa dữ liệu: {LEGAL.contact}.</p></S>
  <S id="khong-tai-khoan" title="2. Dùng BeeJunior không cần tài khoản"><p>Xem mọi trang, làm mọi đề, chấm điểm và Luyện tập nhóm đều không cần đăng nhập. Kết quả làm bài lưu trong trình duyệt của em (localStorage) và có thể xóa bằng cách xóa dữ liệu trang web. Tài khoản chỉ là tùy chọn để lưu và đồng bộ tiến độ.</p></S>
  <S id="du-lieu" title="3. Dữ liệu khi có tài khoản"><ul className={ul}>
   <li><strong>Phụ huynh/người giám hộ:</strong> email, mật khẩu (chỉ lưu dạng băm), thời điểm xác minh và đăng nhập, bằng chứng đồng ý (phiên bản chính sách, thời điểm).</li>
   <li><strong>Hồ sơ của con:</strong> biệt danh, lớp và kết quả luyện tập. BeeJunior không hỏi họ tên thật, ngày sinh, số điện thoại, địa chỉ hay ảnh.</li>
   <li><strong>Đăng nhập bằng Google (khi tính năng được bật):</strong> chỉ mã định danh Google (<code>sub</code>) và email; không lưu tên hay ảnh Google.</li>
   <li><strong>Kỹ thuật:</strong> bản băm của địa chỉ IP và trình duyệt để chống lạm dụng, nhật ký thao tác tài khoản (không chứa mật khẩu hay mã).</li></ul></S>
  <S id="muc-dich" title="4. Mục đích và cam kết"><p>Dữ liệu chỉ dùng để cung cấp tài khoản, đồng bộ tiến độ và bảo mật. BeeJunior không bán hay chia sẻ dữ liệu để quảng cáo, không dùng dữ liệu tài khoản cho quảng cáo và không có quảng cáo ở trang tài khoản.</p></S>
  <S id="xu-ly" title="5. Bên xử lý và nơi lưu"><ul className={ul}><li>Nhà gửi email (xác minh, đặt lại mật khẩu): {LEGAL.emailProvider}.</li><li>Cloudflare, nếu được dùng cho chuyển tiếp hoặc chống bot: [CHỦ XÁC NHẬN].</li><li>Google, chỉ khi bạn chọn đăng nhập bằng Google.</li><li>Nơi lưu và việc chuyển dữ liệu ra nước ngoài: [CHỦ XÁC NHẬN VỚI LUẬT SƯ].</li></ul></S>
  <S id="thoi-han" title="6. Thời hạn lưu"><p>Giữ đến khi bạn xóa. Tài khoản không đăng nhập 24 tháng sẽ được nhắc qua email, sau thêm 30 ngày không phản hồi sẽ bị xóa. Phiên đăng nhập hết hạn sau 7 ngày không dùng hoặc 30 ngày. Nhật ký đăng nhập giữ 30 ngày, nhật ký thao tác tài khoản 12 tháng. <em>(Đề xuất, chờ luật sư xác nhận.)</em></p></S>
  <S id="quyen" title="7. Quyền của bạn"><p>Bạn có thể xem, sửa, tải về, xóa dữ liệu và rút đồng ý bất cứ lúc nào tại <Link className="underline" href="/tai-khoan">Tài khoản</Link>. Rút đồng ý cho hồ sơ của con sẽ xóa hồ sơ đó. Cách xóa chi tiết ở <Link className="underline" href={deleteDataPath()}>Hướng dẫn xóa dữ liệu</Link>; yêu cầu xóa được xử lý trong vòng 72 giờ <em>(đề xuất, chờ xác nhận)</em>. Bản sao lưu được xóa theo chu kỳ lưu giữ sao lưu.</p></S>
  <S id="tuoi" title="8. Độ tuổi"><p>Tài khoản chỉ dành cho người từ đủ 18 tuổi (cha/mẹ hoặc người giám hộ). Trẻ em sử dụng qua hồ sơ do phụ huynh tạo và đồng ý riêng.</p></S>
  <S id="cookie" title="9. Cookie"><p>BeeJunior chỉ dùng cookie chức năng: cookie phiên đăng nhập (khi bạn đăng nhập) và token phòng trong Luyện tập nhóm. Không có cookie phân tích hay quảng cáo cá nhân hóa; quảng cáo (nếu có) là không cá nhân hóa.</p></S>
  <S id="nhom" title="10. Luyện tập nhóm"><p>Không cần tài khoản và không có chat. BeeJunior chỉ lưu tên hiển thị tạm thời trong phòng và đáp án đã chọn; phòng tự xóa sau khi kết thúc và không ghi vào cơ sở dữ liệu. Một cookie token chức năng giữ chỗ của bạn trong phòng.</p></S>
  <S id="luat" title="11. Căn cứ pháp luật"><p>Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP. <em>(Chờ luật sư xác nhận.)</em></p></S>
  <S id="lien-he" title="12. Liên hệ"><p>{LEGAL.contact} · <Link className="underline" href={contactPath()}>Trang Liên hệ</Link> · <Link className="underline" href={termsPath()}>Điều khoản sử dụng</Link>.</p></S>
 </article>;
}

/** Draft of docs/user-accounts.md 7.2. */
export function TermsDraft() {
 return <article className="max-w-prose space-y-8 leading-relaxed">
  <DraftBanner/><Meta/>
  <S id="chung" title="1. Phạm vi"><p>Điều khoản này áp dụng cho tài khoản phụ huynh trên BeeJunior do {LEGAL.entity} vận hành. Việc xem trang và luyện tập không cần tài khoản.</p></S>
  <S id="tai-khoan" title="2. Điều kiện tài khoản"><ul className={ul}><li>Người đăng ký là cha/mẹ hoặc người giám hộ từ đủ 18 tuổi, dùng email của chính mình.</li><li>Cung cấp thông tin đúng và giữ bí mật mật khẩu; bạn chịu trách nhiệm về hoạt động dưới tài khoản của mình.</li></ul></S>
  <S id="phu-huynh" title="3. Trách nhiệm của phụ huynh"><ul className={ul}><li>Chỉ tạo hồ sơ cho con của mình hoặc người bạn giám hộ, sau khi giải thích và hỏi ý con.</li><li>Biệt danh không dùng tên thật và không chứa thông tin cá nhân hay nội dung không phù hợp với trẻ em.</li><li>Tối đa 5 hồ sơ cho mỗi tài khoản.</li></ul></S>
  <S id="khoa" title="4. Khóa tài khoản"><p>BeeJunior có thể khóa hoặc xóa tài khoản vi phạm điều khoản, lạm dụng hệ thống hoặc gây rủi ro cho người dùng khác.</p></S>
  <S id="xoa" title="5. Xóa tài khoản"><p>Bạn có thể xóa tài khoản bất cứ lúc nào; xem <Link className="underline" href={deleteDataPath()}>Hướng dẫn xóa dữ liệu</Link> và <Link className="underline" href={privacyPath()}>Chính sách quyền riêng tư</Link>.</p></S>
  <S id="khac" title="6. Thay đổi và liên hệ"><p>Điều khoản có thể thay đổi; thay đổi quan trọng sẽ được thông báo và có thể cần bạn đồng ý lại. Liên hệ: {LEGAL.contact}. Luật áp dụng và cách giải quyết tranh chấp: [CHỦ XÁC NHẬN VỚI LUẬT SƯ].</p></S>
 </article>;
}

/** Short functional-cookie notice (7.3): no banner, nothing to accept. */
export function CookieNotice() {
 return <p className="mt-1 text-sm">BeeJunior chỉ dùng cookie chức năng (phiên đăng nhập, phòng nhóm), không cookie quảng cáo cá nhân hóa. <Link href={privacyPath()} className="font-bold text-surface! underline">Chi tiết</Link></p>;
}
