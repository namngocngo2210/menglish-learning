'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import StudentHome from '@/components/student-home';
import { BookOpen } from 'lucide-react';

export default function PartialStudentPage() {
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);

  const handleBrowse = (gradeOrSkill: string) => {
    setSelectedNotice(`Bạn chọn lớp ${gradeOrSkill}. Bộ lọc đầy đủ đang hoàn thiện trong bản v2.`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900">
      {/* Top Standalone Partial Sky Banner */}
      <div className="bg-sky-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>
            <strong className="font-bold uppercase tracking-wider bg-sky-800/80 px-2 py-0.5 rounded mr-2 text-[11px]">
              Bản thử nghiệm PARTIAL v2
            </strong>
            Lát cắt xem trước giao diện học sinh (Student Home Slice) · Chưa kết nối cơ sở dữ liệu.
          </span>
          <span className="text-sky-100 text-xs">Dữ liệu mẫu minh họa độc lập (DEMO)</span>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-sky-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight block leading-tight">
                Góc tiếng Anh
              </span>
              <span className="text-[11px] text-slate-500 font-medium block leading-none">
                Tên tạm · Dành cho THCS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/partial-admin/"
              className="inline-flex items-center min-h-[44px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <span className="mr-1.5 text-amber-700 font-semibold">[MOCK]</span>
              Khu vực quản trị
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Visible Notice Triggered on Browse */}
        {selectedNotice && (
          <div
            role="status"
            className="mb-6 p-4 rounded-2xl border border-sky-300 bg-sky-50 text-sky-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
              <span>{selectedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNotice(null)}
              className="min-h-[44px] px-3 py-1 text-xs font-semibold text-sky-800 hover:text-sky-950 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg shrink-0"
            >
              Đóng thông báo
            </button>
          </div>
        )}

        {/* Student Home View */}
        <StudentHome onBrowse={handleBrowse} />

        {/* Partial Slice Notice Banner at Bottom */}
        <section className="mt-14 p-4 rounded-2xl bg-sky-100/50 border border-sky-200 text-xs text-sky-900 space-y-1">
          <p className="font-semibold text-sky-950">
            Lưu ý: Đây là lát cắt giao diện độc lập (Partial Slice) phục vụ xem trước thiết kế.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Các tính năng xác thực tài khoản, phân quyền, lưu trữ đám mây và hệ thống bài thi thật không hoạt động ở bản mẫu này. Mọi hành động đều xử lý trên bộ nhớ cục bộ mô phỏng (Mock).
          </p>
        </section>
      </main>
    </div>
  );
}
