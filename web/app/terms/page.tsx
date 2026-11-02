import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { TermsDraft } from "@/components/account/Legal";
import { Breadcrumbs, PageShell } from "@/components/ui-kit";
import { accountsEnabled } from "@/lib/account/flag";
import { termsPath } from "@/lib/account/paths";
import { homePath } from "@/lib/routes";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

export const dynamic = "force-static";
// Draft pending lawyer review: kept out of search results until the owner approves the text.
export const metadata = { ...buildMetadata({ title: "Điều khoản sử dụng (bản nháp)", description: "Điều khoản sử dụng tài khoản phụ huynh BeeJunior — bản nháp chờ duyệt.", path: termsPath() }), robots: { index: false, follow: true } };
export default function TermsPage() {
 if (!accountsEnabled()) notFound();
 return <PageShell title="Điều khoản sử dụng"><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: "Điều khoản sử dụng", path: termsPath() }])}/><Breadcrumbs items={[{ label: "Trang chủ", href: homePath() }, { label: "Điều khoản sử dụng" }]}/><TermsDraft/></PageShell>;
}
