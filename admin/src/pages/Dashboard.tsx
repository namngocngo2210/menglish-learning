import { ClipboardCheck, Flag, FlaskConical, History } from "lucide-react";
import { PageTitle } from "../components/ui";

const LINKS = [
  ["#/review", "Duyệt nội dung", "Hàng đợi cách ly → nháp → chờ duyệt → đăng", ClipboardCheck],
  ["#/crawl", "Crawl & lỗi", "Tạo job, xem kết quả và lỗi", FlaskConical],
  ["#/reports", "Báo cáo sai", "Câu học sinh báo sai đáp án", Flag],
  ["#/audit", "Nhật ký", "Mọi thao tác của chủ site", History],
] as const;

export function Dashboard() {
  return (
    <>
      <PageTitle>Tổng quan</PageTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {LINKS.map(([href, title, text, Icon]) => (
          <li key={href}>
            <a
              href={href}
              className="flex min-h-11 items-start gap-3 rounded-xl border border-line bg-white p-4 no-underline hover:bg-warm"
            >
              <Icon aria-hidden className="mt-1 size-6 text-primary" />
              <span>
                <strong className="block text-ink">{title}</strong>
                <span className="text-sm text-ink-soft">{text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
