import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/ui-kit";
import { homePath } from "@/lib/routes";
export default function NotFound() { return <PageShell title="Không tìm thấy trang"><Image unoptimized src="/brand/mascot.webp" alt="" width={512} height={348} className="h-auto w-48"/><p>Chú ong chưa tìm thấy trang này. Em hãy về trang chủ để chọn một bài luyện nhé!</p><Link className="inline-flex min-h-11 items-center rounded-xl bg-cta px-6 py-3 font-bold text-navy! no-underline hover:bg-cta-hover" href={homePath()}>Về trang chủ</Link></PageShell>; }
