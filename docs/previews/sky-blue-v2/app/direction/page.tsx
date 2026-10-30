import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Quote,
  PenLine,
  ChevronRight,
} from "lucide-react";

export default function DirectionHomePage() {
  return (
    <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
      {/* 1. Static Artifact Banner */}
      <aside
        aria-label="Thông báo trạng thái thiết kế"
        className="w-full bg-[#111a2b] text-[#fff7ed] text-xs font-semibold tracking-wider uppercase py-2.5 px-4 text-center border-b border-[#1b2a4a] flex items-center justify-center gap-2"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-[#f5691a] animate-pulse" aria-hidden="true" />
        <span>BẢN THIẾT KẾ · HƯỚNG CAM/NAVY · CHƯA TRIỂN KHAI</span>
        <span className="hidden sm:inline text-slate-400 font-normal">| Demo tĩnh mẫu</span>
      </aside>

      {/* 2. Quiet Clean Navbar */}
      <header className="w-full border-b border-[#fff3eb] bg-white/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fff7ed] border border-[#f5691a]/30 flex items-center justify-center text-[#c2410c]">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-[#111a2b] tracking-tight">
                  Góc tiếng Anh
                </span>
                <Badge variant="outline" className="text-[10px] uppercase border-[#a23f00]/30 text-[#a23f00] bg-[#fff7ed] px-1.5 py-0">
                  Tên tạm
                </Badge>
              </div>
              <p className="text-[11px] text-[#1b2a4a]/70">Khối THCS 6–9 · Không yêu cầu tài khoản</p>
            </div>
          </div>

          <nav aria-label="Điều hướng mẫu" className="hidden md:flex items-center gap-6 text-sm font-medium text-[#1b2a4a]">
            <span className="cursor-default hover:text-[#c2410c] transition-colors">Đọc hiểu cốt lõi</span>
            <span className="cursor-default hover:text-[#c2410c] transition-colors">Ngữ pháp lập luận</span>
            <span className="cursor-default hover:text-[#c2410c] transition-colors">Viết câu & đoạn</span>
            <span className="text-xs text-[#a23f00] bg-[#fff3eb] px-2.5 py-1 rounded-full font-semibold border border-[#a23f00]/20">
              MẪU THIẾT KẾ
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">Dành cho học sinh:</span>
            <span className="inline-flex items-center text-xs font-semibold text-[#111a2b] bg-[#f9f9ff] px-3 py-1.5 rounded-md border border-slate-200">
              Tự do luyện tập
            </span>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <main className="flex-1">
        <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24 border-b border-orange-100/60 overflow-hidden bg-gradient-to-b from-white via-[#fffdfa] to-[#f9f9ff]">
          {/* Typographic Asymmetric Decoration */}
          <div
            aria-hidden="true"
            className="absolute right-0 top-1/2 -translate-y-1/2 select-none pointer-events-none font-black text-[180px] sm:text-[260px] lg:text-[340px] text-[#fff3eb]/70 leading-none -z-0 tracking-tighter"
          >
            6–9
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

              {/* Left Column: Hero Editorial Copy */}
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fff7ed] border border-[#f5691a]/30 mb-5">
                  <span className="w-2 h-2 rounded-full bg-[#f5691a]" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#a23f00]">
                    THCS LỚP 6–9 · KHÔNG CẦN ĐĂNG NHẬP
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[66px] font-extrabold text-[#111a2b] tracking-tight leading-[1.08] mb-6">
                  Rèn năng lực đọc &amp; viết với{" "}
                  <span className="relative inline-block text-[#111a2b]">
                    độ chắc chắn
                    <span
                      aria-hidden="true"
                      className="absolute left-0 -bottom-1 sm:-bottom-2 w-full h-2.5 sm:h-3.5 bg-[#f5691a]/25 -rotate-1 rounded"
                    />
                  </span>{" "}
                  từng ngữ liệu.
                </h1>

                <p className="text-base sm:text-lg text-[#1b2a4a]/85 leading-relaxed max-w-2xl mb-8 font-normal">
                  Không chạy theo điểm số ảo hay hình minh họa hoạt hình. Định hướng tập trung giải nghĩa văn bản gốc, truy vết dữ kiện suy luận và cấu trúc câu rõ ràng cho học sinh cấp hai.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto">
                  <Button
                    className="min-h-[46px] px-6 text-sm sm:text-base font-semibold bg-[#c2410c] hover:bg-[#a23f00] text-white shadow-sm flex items-center justify-center gap-2 rounded-md"
                  >
                    <span>Mở bài đọc mẫu ngay</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>

                  <Button
                    variant="outline"
                    className="min-h-[46px] px-5 text-sm sm:text-base font-medium text-[#111a2b] border-[#1b2a4a]/20 hover:bg-[#fff7ed] hover:border-[#f5691a]/40 rounded-md"
                  >
                    <span>Xem cấu trúc 4 khối lớp</span>
                    <ChevronRight className="w-4 h-4 ml-1 text-[#a23f00]" aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200/80 w-full flex flex-wrap items-center gap-6 text-xs text-[#1b2a4a]/75">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#c2410c]" aria-hidden="true" />
                    <span>Học liệu đối chiếu song ngữ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#c2410c]" aria-hidden="true" />
                    <span>Bài tập trắc nghiệm giải thích chi tiết</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#a23f00]">MẪU THIẾT KẾ</span>
                  </div>
                </div>
              </div>

              {/* Right Column: DOM-based Annotated Learning Workbook Motif */}
              <div className="lg:col-span-5 w-full">
                <Card className="border-2 border-[#1b2a4a]/15 shadow-xl bg-white overflow-hidden relative">
                  {/* Workbook Header */}
                  <div className="bg-[#111a2b] text-white px-4 py-3 flex items-center justify-between border-b border-[#1b2a4a]">
                    <div className="flex items-center gap-2">
                      <Quote className="w-4 h-4 text-[#f5691a]" aria-hidden="true" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#fff7ed]">
                        Văn bản thực hành · Trích đoạn Lớp 8 (MẪU)
                      </span>
                    </div>
                    <span className="text-[11px] bg-[#f5691a]/20 text-[#fff7ed] px-2 py-0.5 rounded border border-[#f5691a]/40 font-mono">
                      Passage #08-B
                    </span>
                  </div>

                  <CardContent className="p-5 sm:p-6 space-y-4 text-sm">
                    {/* Micro English passage */}
                    <div className="border-l-2 border-[#c2410c] pl-3 py-1 bg-[#fffdfa]">
                      <p className="text-[#111a2b] font-serif italic text-base leading-relaxed">
                        “Urban green corridors do not merely provide shade; they serve as critical thermal buffers that lower ambient city temperatures by up to three degrees.”
                      </p>
                    </div>

                    {/* Highlighted Inference DOM Callout */}
                    <div className="bg-[#fff7ed] p-3.5 rounded-md border border-[#f5691a]/30 relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase text-[#a23f00] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#c2410c]" aria-hidden="true" />
                          Điểm suy luận (Inference Focus)
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Kỹ năng phân tích</span>
                      </div>
                      <p className="text-xs text-[#111a2b] leading-relaxed">
                        Cụm từ <strong className="font-semibold text-[#c2410c]">“not merely... they serve as”</strong> báo hiệu lập luận bổ sung cấp tiến: hành lang cây xanh không chỉ mang tính thẩm mỹ mà là cấu phần hạ tầng khí hậu chủ động.
                      </p>
                    </div>

                    {/* Margin Annotation Mock */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      <div className="p-2.5 rounded border border-slate-200 bg-[#f9f9ff]">
                        <span className="text-[10px] font-bold text-[#1b2a4a] block uppercase mb-1">
                          Từ vựng cốt lõi
                        </span>
                        <p className="text-xs text-[#111a2b] font-medium">thermal buffer (n)</p>
                        <p className="text-[11px] text-slate-600">vùng đệm điều hòa nhiệt</p>
                      </div>

                      <div className="p-2.5 rounded border border-slate-200 bg-[#f9f9ff]">
                        <span className="text-[10px] font-bold text-[#1b2a4a] block uppercase mb-1">
                          Thời lượng gợi ý
                        </span>
                        <p className="text-xs text-[#111a2b] font-medium">10 - 15 phút</p>
                        <p className="text-[11px] text-slate-600">tự học, không áp lực tốc độ</p>
                      </div>
                    </div>

                    {/* Visual Mock Indicator */}
                    <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 text-[#a23f00] font-medium">
                        <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                        Ghi chú biên tập của giáo viên
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Dữ liệu mẫu 2026</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </section>

        {/* 4. Lower Fold: Grade Chooser as Horizontal Numbered Rail 6-9 */}
        <section className="py-12 sm:py-16 bg-white border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#a23f00]">
                  Lộ trình học trực tiếp
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111a2b] tracking-tight mt-1">
                  Chọn khối lớp để bắt đầu luyện tập
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-xs sm:text-right">
                Toàn bộ nội dung mở công khai. Không bắt buộc đăng nhập tài khoản.
              </p>
            </div>

            {/* Horizontal Numbered Rail (not 4 boxed cards) */}
            <div
              role="region"
              aria-label="Thanh chọn khối lớp 6 đến 9"
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-2 bg-[#f9f9ff] rounded-xl border border-slate-200/80"
            >
              {[
                {
                  grade: "06",
                  title: "Lớp 6: Làm quen ngữ liệu",
                  desc: "Nhận biết cấu trúc câu đơn & từ vựng ngữ cảnh tự nhiên.",
                  status: "Sẵn sàng",
                },
                {
                  grade: "07",
                  title: "Lớp 7: Mở rộng đoạn văn",
                  desc: "Liên kết ý và phát hiện thông tin chi tiết qua bài ngắn.",
                  status: "Sẵn sàng",
                },
                {
                  grade: "08",
                  title: "Lớp 8: Suy luận & Luận điểm",
                  desc: "Phân tích ẩn ý tác giả, từ vựng học thuật cơ bản.",
                  status: "Trọng tâm",
                  featured: true,
                },
                {
                  grade: "09",
                  title: "Lớp 9: Chắc chắn tuyển sinh",
                  desc: "Hoàn thiện ngữ pháp tổng hợp và đọc hiểu văn bản dài.",
                  status: "Sẵn sàng",
                },
              ].map((item) => (
                <div
                  key={item.grade}
                  tabIndex={0}
                  role="button"
                  aria-label={`Khối lớp ${item.grade}: ${item.title}`}
                  className={`p-4 rounded-lg flex flex-col justify-between transition-all min-h-[140px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#c2410c] ${
                    item.featured
                      ? "bg-white border-2 border-[#c2410c] shadow-md"
                      : "bg-white/70 border border-slate-200/60 hover:bg-white hover:border-[#1b2a4a]/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                        item.featured ? "text-[#c2410c]" : "text-[#111a2b]"
                      }`}
                    >
                      {item.grade}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        item.featured
                          ? "bg-[#fff7ed] text-[#a23f00] border border-[#f5691a]/30"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#111a2b] mb-1 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-normal">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Editorial Skill Menu: Reading, Grammar, Writing MCQ */}
        <section className="py-14 sm:py-18 bg-[#f9f9ff]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-[#a23f00]">
                Cấu trúc rèn luyện
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111a2b] tracking-tight mt-1">
                Ba kỹ năng nền tảng được biên soạn nhất quán
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Mỗi bài luyện đều đi kèm bài giải thích chi tiết lý do đúng/sai, không chỉ đưa ra đáp án đơn thuần.
              </p>
            </div>

            {/* Editorial Structured Rows */}
            <div className="space-y-4">
              {[
                {
                  code: "SKILL-R",
                  name: "Đọc hiểu ngữ liệu & Suy luận dữ kiện",
                  meta: "Reading Comprehension",
                  example: "Tìm thông tin gián tiếp, nhận biết thái độ tác giả và ý nghĩa theo ngữ cảnh.",
                  time: "Thời lượng: 12–15 phút / bài",
                  tag: "MẪU BÀI 1",
                },
                {
                  code: "SKILL-G",
                  name: "Ngữ pháp thực dụng & Cấu trúc câu",
                  meta: "Applied Grammar in Context",
                  example: "Học ngữ pháp qua câu văn thực tế, phân biệt thì và cấu trúc mệnh đề tương phản.",
                  time: "Thời lượng: 8–10 phút / chuyên đề",
                  tag: "MẪU BÀI 2",
                },
                {
                  code: "SKILL-W",
                  name: "Trắc nghiệm viết & Lập luận diễn đạt",
                  meta: "Writing MCQ & Sentence Combining",
                  example: "Sắp xếp trật tự ý, kết hợp hai câu đơn thành câu phức gãy gọn và chính xác.",
                  time: "Thời lượng: 10–12 phút / bài tập",
                  tag: "MẪU BÀI 3",
                },
              ].map((row) => (
                <div
                  key={row.code}
                  className="bg-white p-5 sm:p-6 rounded-lg border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#1b2a4a]/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-[#c2410c] bg-[#fff7ed] px-2 py-0.5 rounded border border-[#f5691a]/25">
                        {row.code}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">| {row.meta}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {row.tag}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#111a2b] tracking-tight">
                      {row.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
                      {row.example}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">{row.time}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] px-4 font-semibold text-[#a23f00] border-[#a23f00]/30 hover:bg-[#fff7ed] rounded-md flex items-center gap-1"
                    >
                      <span>Xem thử mẫu</span>
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 6. Static Design Footer */}
      <footer className="w-full bg-[#111a2b] text-[#f9f9ff] py-10 border-t border-[#1b2a4a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#1b2a4a]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-base text-white">Góc tiếng Anh</span>
                <span className="text-[10px] uppercase bg-[#fff3eb]/10 text-[#fff7ed] px-2 py-0.5 rounded font-mono">
                  Tên tạm · Bản thiết kế
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Bản xem trước giao diện đại diện hướng Cam / Navy dành cho học sinh THCS 6–9. Không chứa hệ thống xác thực người dùng hay kết nối cơ sở dữ liệu.
              </p>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p>Mã thiết kế: <span className="font-mono text-slate-200">PREVIEW-SKY-V2-DIR</span></p>
              <p>Trạng thái: <span className="text-[#f5691a] font-semibold">Chưa triển khai chính thức</span></p>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>© 2026 Bản xem trước thiết kế mẫu học tập THCS. Mọi số liệu và văn bản hiển thị là dữ liệu minh họa.</p>
            <p>Font cục bộ: Be Vietnam Pro · Thiết kế tĩnh xuất khẩu Next.js</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
