import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { homePath, contactPath, privacyPath } from "@/lib/routes";
import { accountsEnabled } from "@/lib/account/flag";
import { DeleteDataGuide } from "@/components/account/DeleteDataGuide";

const deleteDataPath = "/xoa-du-lieu";
// Utility page for the Meta app review: kept out of search results (robots index:false) and out of the sitemap.
export const metadata = {
  ...buildMetadata({ title: "Hướng dẫn xóa dữ liệu", description: "Cách xóa dữ liệu đã lưu trên thiết bị và cách yêu cầu xóa dữ liệu liên quan đến BeeJunior.", path: deleteDataPath }),
  robots: { index: false, follow: true },
};
export const revalidate = 3600;
export default function DeleteDataPage() {
  if (accountsEnabled()) return <PageShell title="Hướng dẫn xóa dữ liệu"><JsonLd data={breadcrumbJsonLd([{name:"Trang chủ",path:homePath()},{name:"Hướng dẫn xóa dữ liệu",path:deleteDataPath}])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:"Hướng dẫn xóa dữ liệu"}]}/><DeleteDataGuide/></PageShell>;
  return <PageShell title="Hướng dẫn xóa dữ liệu"><JsonLd data={breadcrumbJsonLd([{name:"Trang chủ",path:homePath()},{name:"Hướng dẫn xóa dữ liệu",path:deleteDataPath}])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:"Hướng dẫn xóa dữ liệu"}]}/><article className="max-w-prose space-y-8 leading-relaxed">
    <section className="space-y-3"><h2 className="text-xl font-bold">Dữ liệu trên BeeJunior</h2><p>Phiên bản hiện tại của BeeJunior không thu thập tài khoản hay thông tin cá nhân. Kết quả làm bài chỉ được lưu trong trình duyệt của em (localStorage) và được xóa bằng cách xóa dữ liệu trang web:</p><ul className="list-disc space-y-2 pl-6"><li>Chrome (máy tính): Cài đặt → Quyền riêng tư và bảo mật → Xóa dữ liệu duyệt web → chọn Cookie và dữ liệu trang web.</li><li>Safari (máy tính): Cài đặt → Quyền riêng tư → Quản lý dữ liệu trang web → xóa dữ liệu của trang này.</li><li>Android (Chrome): Cài đặt → Quyền riêng tư và bảo mật → Xóa dữ liệu duyệt web → Cookie và dữ liệu trang web.</li><li>iPhone/iPad: Cài đặt → Safari → Xóa lịch sử và dữ liệu trang web.</li></ul></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Trang Facebook BeeJunior</h2><p>Dữ liệu phát sinh khi em tương tác với Trang Facebook BeeJunior do Meta xử lý. Để xóa bình luận hoặc tin nhắn, em xóa trực tiếp trên Facebook.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Yêu cầu xóa dữ liệu khác</h2>{/* TODO(owner): /lien-he has no email/phone yet; add the real contact channel here once it exists. */}<p>Nếu cần xóa dữ liệu khác, vui lòng liên hệ qua <Link className="underline" href={contactPath()}>trang Liên hệ</Link>. Chúng tôi xử lý trong thời gian sớm nhất.</p><p>Xem thêm <Link className="underline" href={privacyPath()}>Chính sách bảo mật</Link>.</p></section>
  </article></PageShell>;
}
