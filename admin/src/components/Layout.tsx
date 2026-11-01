import {
  BarChart3,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Flag,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as Cog,
  SlidersHorizontal,
  Globe,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Me } from "../lib/api";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "./ui";

const NAV = [
  ["", "Tổng quan", LayoutDashboard],
  ["review", "Hàng đợi duyệt", ClipboardCheck],
  ["sources", "Nguồn", Globe],
  ["crawl", "Crawl", FlaskConical],
  ["tests", "Đề", FileText],
  ["presets", "Preset trộn đề", SlidersHorizontal],
  ["reports", "Báo cáo sai", Flag],
  ["audit", "Nhật ký", History],
  ["settings", "Bảo mật 2FA", Cog],
] as const;

export function Layout({
  me,
  page,
  onLogout,
  children,
}: {
  me: Me;
  page: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = page === "questions" || page === "passages" ? "review" : page;
  const logout = async (): Promise<void> => {
    await api("POST", "/auth/logout", {}).catch(() => undefined);
    onLogout();
  };
  return (
    <div className="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-cta focus:p-3"
      >
        Bỏ qua điều hướng
      </a>
      <header className="flex items-center justify-between bg-ink px-4 py-2 text-white md:hidden">
        <span className="flex items-center gap-2 font-bold">
          <BarChart3 aria-hidden className="size-5 text-cta" /> BeeJunior Admin
        </span>
        <Button
          variant="primary"
          aria-expanded={open}
          aria-controls="nav"
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Menu aria-hidden className="size-5" /> Menu
        </Button>
      </header>
      <nav
        id="nav"
        aria-label="Điều hướng chính"
        className={cn("bg-ink p-3 text-white md:block md:min-h-screen", open ? "block" : "hidden")}
      >
        <p className="mb-3 hidden items-center gap-2 px-2 text-lg font-bold md:flex">
          <BarChart3 aria-hidden className="size-5 text-cta" /> BeeJunior Admin
        </p>
        <ul className="flex flex-col gap-1">
          {NAV.map(([key, text, Icon]) => (
            <li key={key}>
              <a
                href={`#/${key}`}
                aria-current={active === key ? "page" : undefined}
                onClick={() => {
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 text-white no-underline hover:bg-white/10",
                  active === key && "bg-cta font-bold text-ink hover:bg-cta",
                )}
              >
                <Icon aria-hidden className="size-5" /> {text}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-white/20 px-2 pt-3 text-sm">
          <p className="mb-2 break-all text-white/80">{me.email}</p>
          <Button onClick={() => void logout()} className="w-full">
            <LogOut aria-hidden className="size-4" /> Đăng xuất
          </Button>
        </div>
      </nav>
      <main id="main" tabIndex={-1} className="min-w-0 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
