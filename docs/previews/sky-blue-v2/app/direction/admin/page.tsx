import React from "react"
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Search,
  BookOpen,
  Menu,
  Sparkles,
  Filter,
  Check,
  AlertTriangle,
  FolderArchive,
  BarChart3,
  ExternalLink,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const metadata = {
  title: "Admin Kiểm Duyệt · Góc tiếng Anh (Tên tạm)",
  description: "Bản thiết kế giao diện duyệt bài đơn chủ sở hữu dành cho Góc tiếng Anh",
}

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#111a2b] antialiased flex flex-col md:flex-row">
      {/* Mobile Slim Navy Header */}
      <header className="md:hidden bg-[#111a2b] text-white px-4 py-3 flex items-center justify-between border-b border-[#1b2a4a] sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight text-white text-base">Góc tiếng Anh</span>
          <span className="text-[11px] bg-[#1b2a4a] text-orange-200 px-1.5 py-0.5 rounded font-mono">Tên tạm</span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] min-w-[44px] h-11 w-11 p-0 border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-orange-400"
          aria-label="Menu mẫu điều hướng quản trị"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </Button>
      </header>

      {/* Desktop Navy Sidebar */}
      <aside
        className="hidden md:flex md:w-64 flex-col bg-[#111a2b] text-white shrink-0 border-r border-[#1b2a4a]"
        aria-label="Điều hướng chính quản trị viên"
      >
        <div className="p-5 border-b border-[#1b2a4a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#c2410c] text-white font-bold flex items-center justify-center text-sm">
              GA
            </div>
            <div>
              <div className="font-bold text-white text-base leading-tight">Góc tiếng Anh</div>
              <div className="text-xs text-orange-200/80 font-mono">Tên tạm · Bản mẫu</div>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-300 bg-[#1b2a4a] px-2.5 py-1 rounded-full border border-white/10">
            <Lock className="w-3 h-3 text-orange-400" aria-hidden="true" />
            <span>Đơn chủ sở hữu (Single Owner)</span>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 text-sm font-medium" aria-label="Danh mục tác vụ">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Không gian quản trị</div>
          <a
            href="#overview"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1b2a4a] focus-visible:ring-2 focus-visible:ring-orange-400 min-h-[44px]"
          >
            <Layers className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Tổng quan kho đề</span>
          </a>
          <a
            href="#review-queue"
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#c2410c] text-white font-semibold focus-visible:ring-2 focus-visible:ring-white min-h-[44px]"
            aria-current="page"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-orange-200" aria-hidden="true" />
              <span>Hàng đợi kiểm duyệt</span>
            </div>
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-mono">3</span>
          </a>
          <a
            href="#bank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1b2a4a] focus-visible:ring-2 focus-visible:ring-orange-400 min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Ngân hàng bài đọc 6–9</span>
          </a>
          <a
            href="#quarantine"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1b2a4a] focus-visible:ring-2 focus-visible:ring-orange-400 min-h-[44px]"
          >
            <FolderArchive className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Khu cách ly ngữ liệu</span>
          </a>
          <a
            href="#sources"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1b2a4a] focus-visible:ring-2 focus-visible:ring-orange-400 min-h-[44px]"
          >
            <ExternalLink className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Nguồn cấp mở (Open OER)</span>
          </a>
          <a
            href="#reports"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1b2a4a] focus-visible:ring-2 focus-visible:ring-orange-400 min-h-[44px]"
          >
            <BarChart3 className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Độ phù hợp từ vựng</span>
          </a>
        </nav>

        <div className="p-4 border-t border-[#1b2a4a] text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Quy tắc xuất bản:</p>
          <p className="leading-relaxed">Cách ly tự động → Chủ sở hữu duyệt tay → Mới hiển thị cho học sinh.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Compliance Notice Banner */}
        <Alert className="border-orange-200 bg-[#fff7ed] text-[#a23f00] rounded-xl shadow-sm">
          <ShieldAlert className="h-5 w-5 text-[#c2410c]" aria-hidden="true" />
          <AlertTitle className="text-sm font-bold text-[#c2410c] tracking-tight">
            BẢN THIẾT KẾ CAM/NAVY · CHƯA TRIỂN KHAI — Admin mẫu · Không có xác thực thật
          </AlertTitle>
          <AlertDescription className="text-xs text-[#a23f00] mt-1 leading-relaxed">
            Môi trường duyệt bài một người (Single Owner Mock). Không thu thập mật khẩu, không phiên làm việc, dữ liệu
            hoàn toàn mẫu thử nghiệm. Mọi nút lệnh đều ở chế độ mô phỏng giao diện.
          </AlertDescription>
        </Alert>

        {/* Top Header & Priority */}
        <div className="space-y-1.5 border-b border-slate-200 pb-5">
          <div className="text-xs font-bold tracking-wider text-[#c2410c] uppercase">KHÔNG GIAN CỦA CHỦ SỞ HỮU</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111a2b] tracking-tight wrap-balance">
            Nội dung tốt, bắt đầu từ một lượt duyệt.
          </h1>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
            Ưu tiên hôm nay: Duyệt kỹ ngữ liệu khoa học thường thức lớp 7–8, xác nhận giấy phép sử dụng tự do và kiểm
            định thang đo từ vựng B1 trước khi chuyển trạng thái sang bài luyện tập công khai.
          </p>
        </div>

        {/* Restrained Typographic Metric Strip */}
        <section aria-labelledby="metrics-heading" className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h2 id="metrics-heading" className="sr-only">
            Chỉ số quy trình kiểm duyệt (Dữ liệu mẫu)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="pt-2 md:pt-0 md:px-3">
              <span className="text-xs text-slate-500 font-medium block">Đang cách ly chờ duyệt</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#111a2b]">03</span>
                <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Cần đọc tay</span>
              </div>
              <span className="text-[11px] text-slate-400">Ngữ liệu nhập trong 24h</span>
            </div>

            <div className="pt-2 md:pt-0 md:px-3">
              <span className="text-xs text-slate-500 font-medium block">Đã duyệt tuần này</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#111a2b]">18</span>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Hoàn tất</span>
              </div>
              <span className="text-[11px] text-slate-400">Sẵn sàng phục vụ học sinh</span>
            </div>

            <div className="pt-2 md:pt-0 md:px-3">
              <span className="text-xs text-slate-500 font-medium block">Tỷ lệ từ vựng chuẩn B1</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#111a2b]">94.2%</span>
                <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">Khớp lứa tuổi</span>
              </div>
              <span className="text-[11px] text-slate-400">Theo chuẩn Cambridge A2–B1</span>
            </div>

            <div className="pt-2 md:pt-0 md:px-3">
              <span className="text-xs text-slate-500 font-medium block">Giấy phép minh bạch</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#111a2b]">100%</span>
                <span className="text-xs text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">CC / Giáo viên soạn</span>
              </div>
              <span className="text-[11px] text-slate-400">Không có ngữ liệu vi phạm</span>
            </div>
          </div>
        </section>

        {/* Core Editorial Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Review Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Focal Review Card */}
            <Card className="border-2 border-orange-300/80 bg-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#c2410c]" />
              <CardHeader className="pb-3 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="bg-[#fff7ed] text-[#c2410c] border border-orange-200 hover:bg-[#fff7ed]">
                    Tiêu điểm duyệt tay số 1
                  </Badge>
                  <span className="text-xs font-mono text-slate-500">Mã bài: DOC-2026-ENG7-08</span>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-[#111a2b] mt-1">
                  The Wonders of the Can Gio Mangrove Biosphere
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  <span>
                    Khối lớp: <strong className="text-slate-800">Lớp 7–8</strong>
                  </span>
                  <span>
                    Độ dài: <strong className="text-slate-800">328 từ</strong>
                  </span>
                  <span>
                    Bản quyền: <strong className="text-slate-800">Creative Commons BY-SA 4.0</strong>
                  </span>
                  <span>
                    Nguồn gốc: <strong className="text-slate-800">Biên soạn dựa trên tài liệu UNESCO</strong>
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm text-slate-700">
                <div className="p-4 bg-[#f9f9ff] rounded-lg border border-slate-200 leading-relaxed font-serif text-base text-[#1b2a4a]">
                  <p className="mb-3">
                    Mangrove forests are extraordinary coastal ecosystems that thrive in salty, tidal waters where most
                    plants cannot survive. In Vietnam, the Can Gio Mangrove Biosphere Reserve serves as the essential
                    &quot;green lung&quot; of Ho Chi Minh City, protecting communities from coastal storms while filtering river
                    water naturally.
                  </p>
                  <p>
                    These forests provide a safe nursery for hundreds of species of fish, crabs, and migratory birds.
                    When students study mangroves, they learn not only biological vocabulary such as &quot;aerial roots&quot; and
                    &quot;biodiversity&quot;, but also understand how youth action helps restore green coastlines.
                  </p>
                </div>

                <div className="bg-[#fff3eb] border border-orange-200/70 p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#a23f00]">
                    <CheckCircle2 className="w-4 h-4 text-[#c2410c]" aria-hidden="true" />
                    <span>Kết quả sàng lọc kỹ thuật ban đầu (Quarantine Pass):</span>
                  </div>
                  <ul className="text-xs text-[#a23f00] space-y-1 list-disc list-inside">
                    <li>Không chứa quảng cáo, không liên kết ngoài độc hại, không câu hỏi nhạy cảm.</li>
                    <li>Từ vựng mức B1 chiếm 14.8%, giải thích sẵn 4 thuật ngữ khó kèm ví dụ ngữ cảnh.</li>
                    <li>Có 4 câu hỏi đọc hiểu rèn kỹ năng suy luận (Inference) và tìm ý chính (Main Idea).</li>
                  </ul>
                </div>
              </CardContent>

              <CardFooter className="bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-xs text-slate-500 italic">
                  * Trạng thái hiện tại: Chờ chủ sở hữu nhấn xác nhận xuất bản.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    Biên tập chú giải (Mock)
                  </Button>
                  <Button
                    type="button"
                    className="min-h-[44px] text-xs font-bold bg-[#c2410c] hover:bg-[#a23f00] text-white shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    Phê duyệt &amp; Xuất bản (Mock)
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Ingestion & Review Queue Table */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-[#111a2b]">
                      Hàng đợi nhập liệu &amp; Duyệt nội dung
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Quy trình bắt buộc: Cách ly nhập liệu → Chủ sở hữu kiểm tra thủ công → Đưa vào kho luyện tập.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
                    3 mục đang chờ
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="w-full text-xs">
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="font-semibold text-slate-700 w-[40%]">Tên bài đọc / Ngữ liệu</TableHead>
                        <TableHead className="font-semibold text-slate-700">Khối &amp; Độ dài</TableHead>
                        <TableHead className="font-semibold text-slate-700">Nguồn &amp; Bản quyền</TableHead>
                        <TableHead className="font-semibold text-slate-700">Tiến trình</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Thao tác mẫu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      <TableRow className="hover:bg-slate-50/80">
                        <TableCell className="font-medium text-[#111a2b] py-3">
                          <div>Clean Ocean Inventions by Teenagers</div>
                          <span className="text-[11px] text-slate-500">Chủ đề: Môi trường &amp; Đổi mới sáng tạo</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-semibold text-slate-700">Lớp 8</span>
                          <div className="text-[11px] text-slate-500">285 từ</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-slate-700">Open Science Digest</span>
                          <div className="text-[11px] text-emerald-700 font-mono">CC BY 4.0</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className="bg-amber-100 text-amber-800 text-[11px] hover:bg-amber-100 font-normal">
                            Đang đọc soát từ vựng
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px] text-xs text-[#c2410c] hover:bg-orange-50 font-semibold"
                          >
                            Xem xét (Mock)
                          </Button>
                        </TableCell>
                      </TableRow>

                      <TableRow className="hover:bg-slate-50/80">
                        <TableCell className="font-medium text-[#111a2b] py-3">
                          <div>The History of Vietnamese Traditional Kites</div>
                          <span className="text-[11px] text-slate-500">Chủ đề: Văn hóa dân gian &amp; Vật lý gió</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-semibold text-slate-700">Lớp 6–7</span>
                          <div className="text-[11px] text-slate-500">210 từ</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-slate-700">Giáo viên biên soạn</span>
                          <div className="text-[11px] text-slate-600 font-mono">Bản quyền mở nội bộ</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className="bg-blue-100 text-blue-800 text-[11px] hover:bg-blue-100 font-normal">
                            Kiểm tra câu hỏi suy luận
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px] text-xs text-[#c2410c] hover:bg-orange-50 font-semibold"
                          >
                            Xem xét (Mock)
                          </Button>
                        </TableCell>
                      </TableRow>

                      <TableRow className="hover:bg-slate-50/80">
                        <TableCell className="font-medium text-[#111a2b] py-3">
                          <div>How Artificial Satellites Map Rainforests</div>
                          <span className="text-[11px] text-slate-500">Chủ đề: Công nghệ vũ trụ &amp; Trái Đất</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-semibold text-slate-700">Lớp 9</span>
                          <div className="text-[11px] text-slate-500">360 từ</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-slate-700">NASA Earth Observatory</span>
                          <div className="text-[11px] text-emerald-700 font-mono">Public Domain (US)</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className="bg-amber-100 text-amber-800 text-[11px] hover:bg-amber-100 font-normal">
                            Rà soát định dạng câu hỏi
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px] text-xs text-[#c2410c] hover:bg-orange-50 font-semibold"
                          >
                            Xem xét (Mock)
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aside Column: Pipeline & Safety Principles (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Strict Pipeline Card */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#111a2b] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#c2410c]" aria-hidden="true" />
                  Quy trình cách ly 3 bước
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Không bao giờ tự động phát hành ra trang học sinh.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>1. Cách ly kỹ thuật (Quarantine)</span>
                    <span className="text-emerald-700 font-bold">100% Đạt</span>
                  </div>
                  <Progress value={100} className="h-2 bg-slate-100" />
                  <p className="text-slate-500 text-[11px]">
                    Lọc bỏ mã độc, kiểm tra tính toàn vẹn liên kết và kiểm định độ dài tối thiểu.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>2. Chủ sở hữu thẩm định tay</span>
                    <span className="text-[#c2410c] font-bold">Đang xử lý</span>
                  </div>
                  <Progress value={65} className="h-2 bg-slate-100" />
                  <p className="text-slate-500 text-[11px]">
                    Đọc từng câu, kiểm tra tính chuẩn xác ngữ pháp và đảm bảo văn phong thân thiện lứa tuổi 11–15.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>3. Gắn nhãn &amp; Công khai</span>
                    <span className="text-slate-400">Chờ duyệt xong</span>
                  </div>
                  <Progress value={0} className="h-2 bg-slate-100" />
                  <p className="text-slate-500 text-[11px]">
                    Sau khi nhấn duyệt, bài xuất hiện trong bộ đề luyện tập công khai mà học sinh không cần đăng nhập.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Editorial Standard Card */}
            <Card className="bg-[#fff7ed] border-orange-200 text-[#a23f00] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#c2410c] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#c2410c]" aria-hidden="true" />
                  Cam kết bản quyền &amp; Trách nhiệm
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed">
                <p>
                  <strong>Chỉ một người duyệt:</strong> Mọi bài đọc đưa vào hệ thống đều do chính chủ sở hữu đọc và chịu
                  trách nhiệm sư phạm. Không có tài khoản nhân viên hay lời mời cộng tác viên.
                </p>
                <p>
                  <strong>Nguồn mở minh bạch:</strong> Ưu tiên tư liệu khoa học Creative Commons hoặc bài do giáo viên tự
                  viết. Ghi rõ giấy phép và đường dẫn gốc trong từng bài học.
                </p>
                <div className="pt-2 border-t border-orange-200/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-600">Phiên bản giao diện: 2.1-preview</span>
                  <Badge variant="outline" className="text-[10px] border-orange-300 text-[#c2410c] bg-white">
                    Mẫu thử nghiệm
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
