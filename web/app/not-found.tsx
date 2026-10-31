import Link from "next/link";
import { PageShell } from "@/components/ui-kit";
import { homePath } from "@/lib/routes";
export default function NotFound() { return <PageShell title="Không tìm thấy trang"><p>Trang này chưa có hoặc nội dung chưa được xuất bản.</p><Link className="inline-block min-h-11 py-2" href={homePath()}>Về trang chủ</Link></PageShell>; }
