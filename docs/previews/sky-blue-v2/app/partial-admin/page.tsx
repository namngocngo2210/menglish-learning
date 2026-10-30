'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  BarChart3,
  AlertCircle,
  Menu,
  ArrowLeft,
  Shield,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import AdminOperations from '@/components/admin-operations';

type OperationsView = 'overview' | 'sources' | 'tests' | 'reports';

interface NavItem {
  id: OperationsView;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'sources', label: 'Nguồn tài liệu', icon: FileText },
  { id: 'tests', label: 'Đề thi & kiểm tra', icon: CheckSquare },
  { id: 'reports', label: 'Báo cáo & thống kê', icon: BarChart3 },
];

export default function PartialAdminPage() {
  const [currentView, setCurrentView] = useState<OperationsView>('overview');
  const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleNavigate = (target: OperationsView | 'bank' | 'editor') => {
    if (target === 'bank' || target === 'editor') {
      setUnsupportedNotice('Màn hình biên tập chưa có trong slice PARTIAL này');
    } else {
      setCurrentView(target);
      setUnsupportedNotice(null);
    }
  };

  const renderNavButtons = (onItemClick?: () => void) => (
    <nav className="flex flex-col gap-1.5 p-3" aria-label="Danh mục quản trị">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <Button
            key={item.id}
            variant={isActive ? 'default' : 'ghost'}
            className={`min-h-[44px] w-full justify-start gap-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
              isActive
                ? 'bg-sky-600 text-white shadow-sm hover:bg-sky-700'
                : 'text-slate-700 hover:bg-sky-50 hover:text-sky-900'
            }`}
            onClick={() => {
              handleNavigate(item.id);
              if (onItemClick) onItemClick();
            }}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
      {/* Sky Blue Preview Banner */}
      <aside
        className="border-b border-sky-200 bg-sky-100 px-4 py-2.5 text-center text-xs font-semibold text-sky-900"
        aria-label="Thông báo trạng thái bản dựng xem trước"
      >
        <span className="mr-2 inline-block rounded bg-sky-200/80 px-2 py-0.5 font-bold uppercase tracking-wide text-sky-950">
          BẢN THIẾT KẾ V2 · PARTIAL · Chưa triển khai
        </span>
        <span className="text-sky-800">
          Mô phỏng giao diện quản trị viên một chủ sở hữu (Mock) — Chưa có xác thực thực tế.
        </span>
      </aside>

      {/* Top Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Sheet Navigation */}
          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] border-slate-300 text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label="Mở menu quản trị"
                >
                  <Menu className="h-5 w-5" aria-hidden={true} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-white p-0">
                <SheetHeader className="border-b border-slate-100 p-4 text-left">
                  <SheetTitle className="text-base font-bold text-sky-950">Góc tiếng Anh</SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    Bảng điều khiển quản trị (Tên tạm · Bản thử nghiệm)
                  </SheetDescription>
                </SheetHeader>
                {renderNavButtons(() => setSheetOpen(false))}
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-sky-950">Góc tiếng Anh</span>
              <Badge variant="outline" className="border-sky-300 bg-sky-50 text-xs font-normal text-sky-800">
                Tên tạm
              </Badge>
            </div>
            <span className="hidden text-xs text-slate-500 sm:inline">Phân hệ quản trị nội dung THCS (Lớp 6–9)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="hidden items-center gap-1.5 border-amber-200 bg-amber-50 text-amber-900 sm:inline-flex">
            <Shield className="h-3 w-3" aria-hidden={true} />
            <span>Admin Mock</span>
          </Badge>

          <Button asChild variant="ghost" size="sm" className="min-h-[44px] text-xs text-slate-600 hover:text-sky-900 focus-visible:ring-2 focus-visible:ring-sky-500">
            <Link href="/" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" aria-hidden={true} />
              <span>Trang chủ đang hoàn thiện</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {/* Desktop Sidebar */}
        <aside
          className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
          aria-label="Thanh điều hướng chính"
        >
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Phân hệ quản lý
            </h2>
          </div>
          {renderNavButtons()}
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {unsupportedNotice && (
            <Alert
              className="mb-6 flex items-start justify-between border-amber-300 bg-amber-50 text-amber-950 shadow-sm"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" aria-hidden={true} />
                <div>
                  <AlertTitle className="text-sm font-semibold">Thông báo thành phần đang hoàn thiện</AlertTitle>
                  <AlertDescription className="text-sm text-amber-800">
                    {unsupportedNotice}
                  </AlertDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-700 hover:bg-amber-100"
                onClick={() => setUnsupportedNotice(null)}
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" aria-hidden={true} />
              </Button>
            </Alert>
          )}

          <AdminOperations view={currentView} onNavigate={handleNavigate} />
        </main>
      </div>
    </div>
  );
}
