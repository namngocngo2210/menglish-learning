"use client"

import * as React from "react"
import {
  BookOpen,
  Menu,
  LockKeyhole,
  ShieldCheck,
  LayoutDashboard,
  Database,
  FileEdit,
  Inbox,
  FileCheck,
  BarChart3,
  LogOut,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  UserCheck,
} from "lucide-react"

import StudentViews, { type StudentView } from "./student-views"
import AdminContent from "./admin-content"
import AdminOperations, { type OperationsView } from "./admin-operations"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DemoEdgeState = "normal" | "loading" | "empty" | "error" | "429"

type AppView =
  | "home"
  | "browser"
  | "quiz"
  | "results"
  | "admin-login"
  | "admin-overview"
  | "admin-bank"
  | "admin-editor"
  | "admin-sources"
  | "admin-tests"
  | "admin-reports"

const VALID_VIEWS: readonly AppView[] = [
  "home",
  "browser",
  "quiz",
  "results",
  "admin-login",
  "admin-overview",
  "admin-bank",
  "admin-editor",
  "admin-sources",
  "admin-tests",
  "admin-reports",
] as const

const STUDENT_VIEWS: readonly StudentView[] = ["home", "browser", "quiz", "results"] as const

interface AdminNavItem {
  id: AppView
  label: string
  sublabel: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
}

const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    id: "admin-overview",
    label: "Tổng quan điều hành",
    sublabel: "Chỉ số & tiến độ kiểm duyệt",
    icon: LayoutDashboard,
  },
  {
    id: "admin-bank",
    label: "Ngân hàng câu hỏi",
    sublabel: "Kho ngữ liệu THCS lớp 6–9",
    icon: Database,
  },
  {
    id: "admin-editor",
    label: "Soạn thảo & biên tập",
    sublabel: "Chỉnh sửa câu hỏi & lời giải",
    icon: FileEdit,
  },
  {
    id: "admin-sources",
    label: "Nguồn tiếp nhận & Kiểm duyệt",
    sublabel: "Cách ly dữ liệu -> Phê duyệt",
    icon: Inbox,
  },
  {
    id: "admin-tests",
    label: "Bộ đề luyện tập",
    sublabel: "Cấu trúc ma trận bài thi",
    icon: FileCheck,
  },
  {
    id: "admin-reports",
    label: "Báo cáo chất lượng",
    sublabel: "Độ khó & phản hồi học sinh",
    icon: BarChart3,
  },
] as const

function isStudentView(view: AppView): view is StudentView {
  return (STUDENT_VIEWS as readonly string[]).includes(view)
}

function normalizeHash(hash: string): AppView {
  const cleaned = hash.replace(/^#/, "") as AppView
  if (VALID_VIEWS.includes(cleaned)) {
    return cleaned
  }
  return "home"
}

export default function PreviewApp() {
  const [currentView, setCurrentView] = React.useState<AppView>("home")
  const [isClient, setIsClient] = React.useState(false)
  const [edgeState, setEdgeState] = React.useState<DemoEdgeState>("normal")
  const [mobileStudentMenuOpen, setMobileStudentMenuOpen] = React.useState(false)
  const [mobileAdminMenuOpen, setMobileAdminMenuOpen] = React.useState(false)

  const mainHeadingRef = React.useRef<HTMLHeadingElement>(null)

  // Initialize hash navigation and listen to browser back/forward buttons
  React.useEffect(() => {
    setIsClient(true)
    const initialView = normalizeHash(window.location.hash)
    setCurrentView(initialView)

    const handleHashChange = () => {
      const nextView = normalizeHash(window.location.hash)
      setCurrentView(nextView)
      setEdgeState("normal")
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => {
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [])

  // Safely update hash without hydration discrepancies
  const navigateTo = React.useCallback(
    (view: AppView) => {
      setEdgeState("normal")
      setCurrentView(view)
      if (typeof window !== "undefined") {
        window.location.hash = `#${view}`
      }
      // Accessible focus update after view switch
      setTimeout(() => {
        mainHeadingRef.current?.focus()
      }, 50)
    },
    []
  )

  // Map admin hash routes to corresponding subview props
  const getAdminOperationsView = (view: AppView): OperationsView => {
    switch (view) {
      case "admin-sources":
        return "sources"
      case "admin-tests":
        return "tests"
      case "admin-reports":
        return "reports"
      case "admin-overview":
      default:
        return "overview"
    }
  }

  const getAdminContentView = (view: AppView): "bank" | "editor" => {
    return view === "admin-editor" ? "editor" : "bank"
  }

  // Active student subview (preserves state across student navigation)
  const activeStudentView: StudentView = isStudentView(currentView) ? currentView : "home"

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-accent selection:text-accent-foreground">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-11 flex items-center justify-center font-medium text-sm"
      >
        Chuyển thẳng đến nội dung chính
      </a>

      {/* Persistent sky blue design preview top banner */}
      <header
        role="region"
        aria-label="Thông tin bản thiết kế mẫu"
        className="bg-secondary/90 border-b border-border/80 px-4 py-2.5 text-xs text-secondary-foreground shadow-xs sticky top-0 z-40 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="default"
              className="bg-primary text-primary-foreground font-semibold px-2 py-0.5 text-[11px] uppercase tracking-wider rounded-sm min-h-6 flex items-center"
            >
              BẢN THIẾT KẾ V2 · Chưa triển khai
            </Badge>
            <span className="text-secondary-foreground font-medium hidden sm:inline">
              Góc tiếng Anh (Tên tạm) · Không có backend · Không thu thập dữ liệu
            </span>
            <span className="text-muted-foreground text-[11px]">
              {currentView.startsWith("admin-") ? "Mô phỏng Quản trị" : "Dành cho Học sinh"}
            </span>
          </div>

          {/* Interactive demo edge state switch */}
          <div className="flex items-center gap-2 ml-auto">
            <label
              htmlFor="demo-state-select"
              className="text-xs font-medium text-foreground whitespace-nowrap cursor-pointer"
            >
              Trạng thái demo:
            </label>
            <Select
              value={edgeState}
              onValueChange={(val) => setEdgeState(val as DemoEdgeState)}
            >
              <SelectTrigger
                id="demo-state-select"
                aria-label="Chọn trạng thái mô phỏng"
                size="sm"
                className="bg-card text-card-foreground border-border min-h-[44px] text-xs font-medium px-2.5 py-1 min-w-[140px] focus:ring-2 focus:ring-ring"
              >
                <SelectValue placeholder="Trạng thái demo" />
              </SelectTrigger>
              <SelectContent align="end" className="bg-card text-card-foreground">
                <SelectItem value="normal" className="text-xs">
                  Bình thường (Đầy đủ)
                </SelectItem>
                <SelectItem value="loading" className="text-xs">
                  Đang tải dữ liệu (Loading)
                </SelectItem>
                <SelectItem value="empty" className="text-xs">
                  Danh sách rỗng (Empty)
                </SelectItem>
                <SelectItem value="error" className="text-xs">
                  Lỗi hệ thống (Error)
                </SelectItem>
                <SelectItem value="429" className="text-xs">
                  Giới hạn tần suất (429)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Top Main Navigation for Public Student Views */}
      {!currentView.startsWith("admin-") && (
        <nav
          role="navigation"
          aria-label="Điều hướng chính học sinh"
          className="border-b border-border bg-card/95 backdrop-blur-md sticky top-[41px] z-30 shadow-xs"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            {/* Branding with neutral title and tentative badge */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo("home")}
                className="flex items-center gap-2.5 rounded-lg p-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-h-11"
                aria-label="Về trang chủ Góc tiếng Anh"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-lg text-foreground tracking-tight leading-none">
                      Góc tiếng Anh
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border bg-muted/50 rounded-sm"
                    >
                      Tên tạm
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Học tập & Luyện tập THCS (Lớp 6–9)
                  </span>
                </div>
              </button>
            </div>

            {/* Desktop horizontal navigation tabs */}
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant={currentView === "home" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigateTo("home")}
                aria-current={currentView === "home" ? "page" : undefined}
                className="min-h-11 px-3.5 font-medium text-sm rounded-lg transition-colors"
              >
                Trang chủ
              </Button>
              <Button
                variant={currentView === "browser" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigateTo("browser")}
                aria-current={currentView === "browser" ? "page" : undefined}
                className="min-h-11 px-3.5 font-medium text-sm rounded-lg transition-colors"
              >
                Khám phá câu hỏi
              </Button>
              <Button
                variant={currentView === "quiz" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigateTo("quiz")}
                aria-current={currentView === "quiz" ? "page" : undefined}
                className="min-h-11 px-3.5 font-medium text-sm rounded-lg transition-colors"
              >
                Luyện tập trắc nghiệm
              </Button>
              <Button
                variant={currentView === "results" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigateTo("results")}
                aria-current={currentView === "results" ? "page" : undefined}
                className="min-h-11 px-3.5 font-medium text-sm rounded-lg transition-colors"
              >
                Kết quả học tập
              </Button>
            </div>

            {/* Owner preview switch button & Mobile menu */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTo("admin-login")}
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary min-h-11 px-3 text-xs sm:text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                aria-label="Xem không gian quản trị mẫu dành cho người sở hữu"
              >
                <LockKeyhole className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>Admin mẫu</span>
              </Button>

              {/* Mobile hamburger drawer sheet */}
              <div className="md:hidden">
                <Sheet open={mobileStudentMenuOpen} onOpenChange={setMobileStudentMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 min-w-11 p-2 rounded-lg text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Mở menu chuyển trang học sinh"
                    >
                      <Menu className="w-6 h-6" aria-hidden="true" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[85vw] max-w-xs flex flex-col p-0">
                    <SheetHeader className="p-4 border-b border-border text-left">
                      <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />
                        Góc tiếng Anh
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground">
                        Menu chuyển đổi màn hình học sinh THCS (Lớp 6–9)
                      </SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
                      <SheetClose asChild>
                        <Button
                          variant={currentView === "home" ? "secondary" : "ghost"}
                          onClick={() => navigateTo("home")}
                          className="justify-start min-h-11 text-sm font-medium w-full text-left"
                        >
                          Trang chủ học sinh
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button
                          variant={currentView === "browser" ? "secondary" : "ghost"}
                          onClick={() => navigateTo("browser")}
                          className="justify-start min-h-11 text-sm font-medium w-full text-left"
                        >
                          Khám phá câu hỏi & Đề thi
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button
                          variant={currentView === "quiz" ? "secondary" : "ghost"}
                          onClick={() => navigateTo("quiz")}
                          className="justify-start min-h-11 text-sm font-medium w-full text-left"
                        >
                          Luyện tập trực tuyến
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button
                          variant={currentView === "results" ? "secondary" : "ghost"}
                          onClick={() => navigateTo("results")}
                          className="justify-start min-h-11 text-sm font-medium w-full text-left"
                        >
                          Kết quả & Phân tích cá nhân
                        </Button>
                      </SheetClose>
                      <div className="my-2 border-t border-border pt-2">
                        <SheetClose asChild>
                          <Button
                            variant="outline"
                            onClick={() => navigateTo("admin-login")}
                            className="justify-start min-h-11 text-sm font-medium w-full text-left text-primary border-primary/30"
                          >
                            <LockKeyhole className="w-4 h-4 mr-2" aria-hidden="true" />
                            Chuyển sang Admin mẫu
                          </Button>
                        </SheetClose>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main content router container */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col min-w-0 outline-none"
      >
        {/* Render simulated edge states when selected in preview bar */}
        {edgeState !== "normal" ? (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
            {edgeState === "loading" && (
              <Card className="p-6 border border-border shadow-xs bg-card">
                <div className="flex items-center gap-3 mb-6">
                  <Skeleton className="h-9 w-9 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3 bg-muted" />
                    <Skeleton className="h-4 w-1/4 bg-muted" />
                  </div>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full rounded-lg bg-muted" />
                  <Skeleton className="h-28 w-full rounded-lg bg-muted" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Skeleton className="h-20 rounded-lg bg-muted" />
                    <Skeleton className="h-20 rounded-lg bg-muted" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setEdgeState("normal")}
                    className="min-h-11"
                  >
                    Hủy mô phỏng tải
                  </Button>
                </div>
              </Card>
            )}

            {edgeState === "empty" && (
              <Card className="text-center py-12 px-4 border border-dashed border-border bg-card">
                <CardHeader>
                  <div className="w-16 h-16 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto mb-3">
                    <Inbox className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    Chưa có mục nào được tìm thấy
                  </CardTitle>
                  <CardDescription className="max-w-md mx-auto text-sm text-muted-foreground mt-2">
                    Không có nội dung mẫu nào phù hợp với bộ lọc hiện tại trong kho lưu trữ thử nghiệm.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="justify-center pt-2">
                  <Button
                    onClick={() => setEdgeState("normal")}
                    className="min-h-11 px-5 font-medium rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                    Đặt lại trạng thái bình thường
                  </Button>
                </CardFooter>
              </Card>
            )}

            {edgeState === "error" && (
              <Alert
                variant="destructive"
                className="border-destructive/40 bg-destructive/10 text-destructive-foreground p-6 rounded-xl max-w-2xl mx-auto shadow-sm"
              >
                <AlertCircle className="w-6 h-6 text-destructive shrink-0" aria-hidden="true" />
                <div className="ml-3">
                  <AlertTitle className="text-base font-bold text-destructive">
                    Lỗi mô phỏng truy xuất dữ liệu mẫu
                  </AlertTitle>
                  <AlertDescription className="text-sm mt-1 text-foreground/80 leading-relaxed">
                    Đã xảy ra sự cố giả lập trong quá trình nạp nội dung. Đây là màn hình kiểm thử khả năng xử lý lỗi của giao diện, không ảnh hưởng đến dữ liệu thực.
                  </AlertDescription>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setEdgeState("normal")}
                      className="min-h-11 bg-card hover:bg-muted text-foreground border-border font-medium"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                      Thử lại ngay
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            {edgeState === "429" && (
              <Card className="border-border bg-card p-6 max-w-xl mx-auto text-center shadow-xs">
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-7 h-7" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg font-bold text-foreground">
                  429 · Giới hạn tần suất truy cập
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Hệ thống tạm thời nhận quá nhiều yêu cầu đồng thời. Vui lòng đợi 30 giây (mô phỏng cố định, không có bộ đếm thời gian thực trên máy chủ).
                </CardDescription>
                <div className="mt-6 flex justify-center gap-3">
                  <Button
                    onClick={() => setEdgeState("normal")}
                    className="min-h-11 px-5 font-medium rounded-lg"
                  >
                    Bỏ qua mô phỏng 429
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          /* Normal content flow: Student views or Admin shell */
          <>
            {/* Student Views: Kept mounted across student sub-views to preserve state */}
            {isStudentView(currentView) && (
              <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
                <h1 ref={mainHeadingRef} className="sr-only" tabIndex={-1}>
                  Góc tiếng Anh - Giao diện học sinh THCS
                </h1>
                <StudentViews
                  view={activeStudentView}
                  onNavigate={(v: StudentView) => navigateTo(v)}
                />
              </div>
            )}

            {/* Standalone Admin Login Concept Screen */}
            {currentView === "admin-login" && (
              <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-muted/20">
                <Card className="max-w-md w-full bg-card border border-border shadow-md rounded-2xl overflow-hidden">
                  <div className="bg-secondary/70 p-6 border-b border-border text-center">
                    <div className="w-14 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                      <LockKeyhole className="w-7 h-7" aria-hidden="true" />
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-card text-foreground font-semibold px-2.5 py-1 text-xs uppercase tracking-wide border-border mb-2"
                    >
                      MỘT CHỦ SỞ HỮU · MÔ PHỎNG (MOCK)
                    </Badge>
                    <CardTitle
                      ref={mainHeadingRef}
                      tabIndex={-1}
                      className="text-xl font-bold text-foreground outline-none"
                    >
                      Cửa sổ Đăng nhập Quản trị
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      Mô phỏng trải nghiệm quản trị một chủ duy nhất, không dùng mật khẩu hoặc token lưu trữ.
                    </CardDescription>
                  </div>

                  <CardContent className="p-6 space-y-4">
                    <Alert className="bg-secondary/40 border-secondary text-foreground text-xs leading-relaxed p-3.5 rounded-lg">
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                      <div className="ml-2">
                        <p className="font-semibold text-primary">Nguyên tắc bảo vệ dữ liệu:</p>
                        <p className="mt-0.5 text-muted-foreground">
                          Không nhập thông tin thật. Đây chỉ là mô phỏng, không có xác thực hay bảo vệ tuyến. Không yêu cầu mật khẩu hay khóa riêng tư.
                        </p>
                      </div>
                    </Alert>

                    <div className="p-4 rounded-xl border border-dashed border-border bg-muted/30 text-center space-y-2">
                      <UserCheck className="w-8 h-8 text-muted-foreground mx-auto" aria-hidden="true" />
                      <div className="text-sm font-semibold text-foreground">
                        Tài khoản: Chủ sở hữu (Owner Mock)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Không lưu cookie, không ghi nhận thông tin đăng nhập, không có quản trị viên phụ.
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Button
                        type="button"
                        onClick={() => navigateTo("admin-overview")}
                        className="w-full min-h-11 font-semibold text-sm rounded-lg shadow-sm"
                      >
                        Đăng nhập mẫu (MOCK)
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigateTo("home")}
                        className="w-full min-h-11 font-medium text-sm text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                        Quay lại giao diện học sinh
                      </Button>
                    </div>
                  </CardContent>

                  <CardFooter className="px-6 py-3 bg-muted/40 border-t border-border text-[11px] text-muted-foreground text-center flex justify-center">
                    Mô hình xét duyệt: Tiếp nhận cách ly -&gt; Chủ sở hữu phê duyệt -&gt; Công bố
                  </CardFooter>
                </Card>
              </div>
            )}

            {/* Admin Shell Layout with Desktop Sidebar & Mobile Drawer */}
            {currentView.startsWith("admin-") && currentView !== "admin-login" && (
              <div className="flex-1 flex min-w-0 bg-muted/15">
                {/* Desktop Admin Sidebar (248px width panel) */}
                <aside
                  role="region"
                  aria-label="Thanh điều hướng quản trị một chủ sở hữu"
                  className="hidden lg:flex flex-col w-[248px] shrink-0 border-r border-border bg-card shadow-xs"
                >
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                        Q
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground truncate">
                          Quản trị nội dung
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Một chủ sở hữu
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Module navigation links */}
                  <nav className="p-3 flex-1 flex flex-col gap-1 overflow-y-auto">
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      6 Phân hệ quản lý
                    </div>
                    {ADMIN_NAV_ITEMS.map((item) => {
                      const Icon = item.icon
                      const isActive = currentView === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all min-h-11 ${
                            isActive
                              ? "bg-secondary text-secondary-foreground font-semibold shadow-xs"
                              : "text-foreground/80 hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              isActive ? "text-primary font-bold" : "text-muted-foreground"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold leading-tight truncate">
                              {item.label}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                              {item.sublabel}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </nav>

                  {/* Sidebar bottom info & exit actions */}
                  <div className="p-3 border-t border-border bg-muted/20 space-y-2">
                    <div className="p-2.5 rounded-lg bg-card border border-border text-[11px] leading-tight text-muted-foreground">
                      <span className="font-semibold text-foreground block mb-0.5">
                        Quy trình phê duyệt:
                      </span>
                      Dữ liệu mới luôn được cách ly tạm thời, chỉ xuất bản khi có xác nhận của chủ sở hữu.
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateTo("admin-login")}
                      className="w-full justify-start text-xs text-muted-foreground hover:text-destructive min-h-11"
                    >
                      <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                      Thoát mẫu quản trị
                    </Button>
                  </div>
                </aside>

                {/* Admin Main Work Area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Top administrative sub-header */}
                  <div className="bg-card border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Mobile Admin Drawer trigger */}
                      <div className="lg:hidden">
                        <Sheet open={mobileAdminMenuOpen} onOpenChange={setMobileAdminMenuOpen}>
                          <SheetTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-11 min-w-11 p-2 border-border"
                              aria-label="Mở danh sách phân hệ quản trị"
                            >
                              <Menu className="w-5 h-5 text-foreground" aria-hidden="true" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="w-[85vw] max-w-xs flex flex-col p-0">
                            <SheetHeader className="p-4 border-b border-border text-left">
                              <SheetTitle className="text-base font-bold text-foreground">
                                Phân hệ quản trị mẫu
                              </SheetTitle>
                              <SheetDescription className="text-xs text-muted-foreground">
                                Quản lý một chủ sở hữu · Không có tài khoản phụ
                              </SheetDescription>
                            </SheetHeader>
                            <div className="p-3 flex-1 flex flex-col gap-1 overflow-y-auto">
                              {ADMIN_NAV_ITEMS.map((item) => {
                                const Icon = item.icon
                                const isActive = currentView === item.id
                                return (
                                  <SheetClose asChild key={item.id}>
                                    <button
                                      type="button"
                                      onClick={() => navigateTo(item.id)}
                                      className={`flex items-center gap-2.5 p-3 rounded-lg text-left min-h-11 w-full ${
                                        isActive
                                          ? "bg-secondary text-secondary-foreground font-semibold"
                                          : "text-foreground hover:bg-muted"
                                      }`}
                                    >
                                      <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                                      <span className="text-xs">{item.label}</span>
                                    </button>
                                  </SheetClose>
                                )
                              })}
                            </div>
                            <div className="p-4 border-t border-border">
                              <SheetClose asChild>
                                <Button
                                  variant="outline"
                                  onClick={() => navigateTo("home")}
                                  className="w-full min-h-11 text-xs justify-center"
                                >
                                  Về trang học sinh
                                </Button>
                              </SheetClose>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>

                      {/* Breadcrumbs for orientation */}
                      <nav aria-label="Đường dẫn phân hệ" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => navigateTo("home")}
                          className="hover:text-primary transition-colors focus-visible:ring-1 focus-visible:ring-ring rounded p-1"
                        >
                          Học sinh
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="text-foreground font-medium">Quản trị mẫu</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="text-primary font-semibold truncate">
                          {ADMIN_NAV_ITEMS.find((n) => n.id === currentView)?.label ?? "Tổng quan"}
                        </span>
                      </nav>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateTo("home")}
                        className="text-xs text-muted-foreground hover:text-foreground min-h-11 px-3"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                        Về trang học sinh
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateTo("admin-login")}
                        className="text-xs border-border text-foreground hover:bg-muted min-h-11 px-3"
                      >
                        Thoát mẫu
                      </Button>
                    </div>
                  </div>

                  {/* Notification banner on mock authorization */}
                  <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 text-[11px] text-primary flex items-center justify-between">
                    <span>
                      Khu vực quản trị mô phỏng — Mọi thao tác lưu, xóa hoặc chỉnh sửa chỉ phản ánh trên bộ nhớ mẫu tạm thời.
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-card border-primary/30 text-primary shrink-0 ml-2">
                      Một chủ sở hữu
                    </Badge>
                  </div>

                  {/* Admin Child View Router */}
                  <div className="p-4 sm:p-6 lg:p-8 flex-1 min-w-0">
                    <h2 ref={mainHeadingRef} className="sr-only" tabIndex={-1}>
                      {ADMIN_NAV_ITEMS.find((n) => n.id === currentView)?.label ?? "Khu vực điều hành"}
                    </h2>

                    {currentView === "admin-bank" || currentView === "admin-editor" ? (
                      <AdminContent
                        view={getAdminContentView(currentView)}
                        onNavigate={(v: "bank" | "editor") =>
                          navigateTo(v === "editor" ? "admin-editor" : "admin-bank")
                        }
                      />
                    ) : (
                      <AdminOperations
                        view={getAdminOperationsView(currentView)}
                        onNavigate={(v: OperationsView | "bank" | "editor") => {
                          if (v === "bank") navigateTo("admin-bank")
                          else if (v === "editor") navigateTo("admin-editor")
                          else navigateTo(`admin-${v}` as AppView)
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Accessible public footer */}
      <footer className="border-t border-border bg-card/80 py-6 px-4 text-xs text-muted-foreground mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-foreground font-semibold">
              <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>Góc tiếng Anh · Bản xem trước thiết kế V2</span>
            </div>
            <p className="max-w-xl text-[11px] leading-relaxed">
              Dành cho học sinh khối THCS (Lớp 6–9). Toàn bộ nội dung và số liệu là dữ liệu mẫu demo, không áp dụng tuyển sinh hay thu thập thông tin người dùng thực tế.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <span className="text-muted-foreground">Không có cookie</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">Không lưu trữ mật khẩu</span>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={() => navigateTo("admin-login")}
              className="text-primary hover:underline font-medium p-1 min-h-11 inline-flex items-center"
            >
              Mô phỏng Quản trị
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
