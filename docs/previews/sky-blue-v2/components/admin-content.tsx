"use client"

import React from "react"
import AdminBank from "./admin-bank"
import AdminEditor from "./admin-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldCheck, BookOpen, FileEdit } from "lucide-react"

export interface AdminContentProps {
  view: "bank" | "editor"
  onNavigate: (view: "bank" | "editor") => void
}

export default function AdminContent({ view, onNavigate }: AdminContentProps) {
  return (
    <div className="min-h-screen bg-sky-50/40 text-slate-900 antialiased">
      {/* Top Navigation Bar with Neutral Branding & Single-Owner Mock Indicator */}
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-sky-950 sm:text-lg">
                  Góc tiếng Anh
                </span>
                <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800 text-xs font-normal">
                  Tên tạm
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                Không gian quản trị nội dung THCS (Lớp 6–9) • Bản xem trước MOCK
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-sky-100 text-sky-900 border-sky-200 hover:bg-sky-100 px-3 py-1 text-xs font-medium">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
              Chủ biên đơn lẻ (Mock Auth)
            </Badge>

            <nav aria-label="Điều hướng quản trị" className="flex items-center gap-1 border-l border-sky-200 pl-2">
              <Button
                variant={view === "bank" ? "default" : "outline"}
                size="sm"
                onClick={() => onNavigate("bank")}
                aria-current={view === "bank" ? "page" : undefined}
                className={`min-h-[44px] min-w-[44px] h-auto whitespace-normal text-xs font-medium sm:text-sm ${
                  view === "bank"
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "border-sky-200 text-slate-700 hover:bg-sky-50"
                }`}
              >
                <BookOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Ngân hàng câu hỏi
              </Button>
              <Button
                variant={view === "editor" ? "default" : "outline"}
                size="sm"
                onClick={() => onNavigate("editor")}
                aria-current={view === "editor" ? "page" : undefined}
                className={`min-h-[44px] min-w-[44px] h-auto whitespace-normal text-xs font-medium sm:text-sm ${
                  view === "editor"
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "border-sky-200 text-slate-700 hover:bg-sky-50"
                }`}
              >
                <FileEdit className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Soạn thảo mẫu
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Workspace View */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {view === "bank" ? (
          <AdminBank onEdit={() => onNavigate("editor")} />
        ) : (
          <AdminEditor onBack={() => onNavigate("bank")} />
        )}
      </main>
    </div>
  )
}
