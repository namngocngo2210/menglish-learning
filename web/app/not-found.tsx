import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/ui-kit";
import { NOT_FOUND_LINKS } from "@/lib/seo-content";
export default function NotFound() { return <PageShell title="Không tìm thấy trang"><Image unoptimized src="/brand/mascot.webp" alt="" width={512} height={348} className="h-auto w-48"/><p>Chú ong chưa tìm thấy trang này. Em hãy chọn một trang dưới đây để tiếp tục luyện tập nhé!</p><nav aria-label="Trang gợi ý"><ul className="grid gap-3 sm:grid-cols-2">{NOT_FOUND_LINKS.map(link => <li key={link.href}><Link className="inline-flex min-h-11 w-full items-center rounded-xl bg-cta px-6 py-3 font-bold text-navy! no-underline hover:bg-cta-hover" href={link.href}>{link.label}</Link></li>)}</ul></nav></PageShell>; }
