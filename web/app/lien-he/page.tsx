import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { homePath, contactPath } from "@/lib/routes";

export const metadata = buildMetadata({ title: "Liên hệ", description: "Trang liên hệ của nền tảng luyện tiếng Anh lớp 6–9. Thông tin liên hệ sẽ được bổ sung.", path: contactPath() });
export const revalidate = 3600;
export default function ContactPage() {
 return <PageShell title="Liên hệ"><JsonLd data={breadcrumbJsonLd([{name:"Trang chủ",path:homePath()},{name:"Liên hệ",path:contactPath()}])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:"Liên hệ"}]}/><article className="max-w-prose leading-relaxed"><p>Thông tin liên hệ sẽ được bổ sung.</p></article></PageShell>;
}
