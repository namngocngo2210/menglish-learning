import Link from "next/link";
import { DraftBanner } from "./Legal";
import { LEGAL } from "@/lib/account/legal";
import { accountPath, loginPath, resetPasswordPath } from "@/lib/account/paths";
import { contactPath, privacyPath } from "@/lib/routes";

const ul = "list-disc space-y-2 pl-6";
const a = "font-semibold text-primary underline";

/** Real deletion flow (docs/user-accounts.md 7.6). Shown instead of the anonymous-only text when ACCOUNTS_ENABLED. */
export function DeleteDataGuide() {
 return <article className="max-w-prose space-y-8 leading-relaxed">
  <DraftBanner/>
  <section className="space-y-3" aria-labelledby="xoa-tk"><h2 id="xoa-tk" className="text-xl font-bold">Xóa tài khoản hoặc hồ sơ của con</h2>
   <p>Phụ huynh đã đăng nhập tự xóa được ngay tại <Link className={a} href={accountPath()}>Tài khoản</Link>:</p>
   <ul className={ul}><li><strong>Xóa hồ sơ của con:</strong> xóa ngay hồ sơ và kết quả đã lưu; đây cũng là rút đồng ý lưu dữ liệu của con.</li><li><strong>Xóa tài khoản:</strong> xóa vĩnh viễn tài khoản, mọi hồ sơ và kết quả (cần nhập lại mật khẩu).</li><li><strong>Tải dữ liệu:</strong> xuất toàn bộ dữ liệu dạng JSON trước khi xóa.</li></ul>
   <p>Quên mật khẩu? <Link className={a} href={resetPasswordPath()}>Đặt lại mật khẩu</Link> rồi xóa như trên, hoặc <Link className={a} href={loginPath()}>đăng nhập</Link>.</p></section>
  <section className="space-y-3" aria-labelledby="xoa-email"><h2 id="xoa-email" className="text-xl font-bold">Không đăng nhập được?</h2>
   <p>Gửi email từ <strong>chính địa chỉ email đã đăng ký</strong> tới {LEGAL.contact} với tiêu đề “Yêu cầu xóa dữ liệu BeeJunior” và nêu rõ muốn xóa tài khoản hay hồ sơ nào. Đừng gửi mật khẩu hay giấy tờ tùy thân.</p>
   <p>Chúng tôi xác nhận lại bằng email và xử lý trong vòng 72 giờ <em>(thời hạn đề xuất, chờ luật sư xác nhận)</em>, rồi gửi email báo kết quả. Bản sao lưu được xóa theo chu kỳ lưu giữ sao lưu. Kênh khác: <Link className={a} href={contactPath()}>trang Liên hệ</Link>.</p></section>
  <section className="space-y-3" aria-labelledby="xoa-may"><h2 id="xoa-may" className="text-xl font-bold">Dữ liệu trên thiết bị</h2>
   <p>Kết quả làm bài khi chưa đăng nhập chỉ nằm trong trình duyệt (localStorage). Xóa bằng cách xóa dữ liệu trang web:</p>
   <ul className={ul}><li>Chrome (máy tính): Cài đặt → Quyền riêng tư và bảo mật → Xóa dữ liệu duyệt web → Cookie và dữ liệu trang web.</li><li>Safari (máy tính): Cài đặt → Quyền riêng tư → Quản lý dữ liệu trang web.</li><li>Android (Chrome): Cài đặt → Quyền riêng tư và bảo mật → Xóa dữ liệu duyệt web.</li><li>iPhone/iPad: Cài đặt → Safari → Xóa lịch sử và dữ liệu trang web.</li></ul></section>
  <section className="space-y-3" aria-labelledby="xoa-fb"><h2 id="xoa-fb" className="text-xl font-bold">Trang Facebook BeeJunior</h2><p>Dữ liệu phát sinh khi em tương tác với Trang Facebook BeeJunior do Meta xử lý. Để xóa bình luận hoặc tin nhắn, em xóa trực tiếp trên Facebook.</p><p>Xem thêm <Link className={a} href={privacyPath()}>Chính sách quyền riêng tư</Link>.</p></section>
 </article>;
}
