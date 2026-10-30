import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  ArrowRight,
  GraduationCap,
  FileText,
  Leaf,
  Target,
  CheckCircle2,
} from 'lucide-react';

interface StudentHomeProps {
  onBrowse: (grade: string) => void;
}

const GRADES = [
  {
    grade: '6',
    title: 'Lớp 6',
    badge: 'Khởi đầu THCS',
    focus: 'Làm quen ngữ pháp cơ bản, từ vựng sinh hoạt hàng ngày & câu hỏi đơn.',
  },
  {
    grade: '7',
    title: 'Lớp 7',
    badge: 'Phát triển nền tảng',
    focus: 'Mở rộng thì quá khứ, câu ghép, từ vựng chủ đề môi trường & cộng đồng.',
  },
  {
    grade: '8',
    title: 'Lớp 8',
    badge: 'Tư duy đọc hiểu',
    focus: 'Câu bị động, câu điều kiện, đoạn văn đọc hiểu phân tích thực tế.',
  },
  {
    grade: '9',
    title: 'Lớp 9',
    badge: 'Luyện tập tổng hợp',
    focus: 'Mệnh đề quan hệ, biến đổi câu gián tiếp & trắc nghiệm viết chuẩn hóa.',
  },
];

const SKILLS = [
  {
    id: 'reading',
    title: 'Reading · Đọc hiểu',
    icon: BookOpen,
    desc: 'Đoạn văn ngắn thực tế về khoa học, trường lớp và môi trường kèm chú thích từ vựng.',
    tag: 'Mẫu DEMO Đọc hiểu',
  },
  {
    id: 'grammar',
    title: 'Grammar · Ngữ pháp',
    icon: Target,
    desc: 'Chuyên đề ngữ pháp trọng tâm theo từng khối lớp với bài tập trắc nghiệm giải thích ngay.',
    tag: 'Mẫu DEMO Ngữ pháp',
  },
  {
    id: 'writing',
    title: 'Writing MCQ · Viết câu',
    icon: FileText,
    desc: 'Dạng bài sắp xếp từ, tìm lỗi sai và chọn câu đồng nghĩa phù hợp định dạng THCS.',
    tag: 'Mẫu DEMO Viết câu',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Chọn khối lớp hoặc kỹ năng',
    desc: 'Bắt đầu ngay từ lớp 6 đến lớp 9 mà không cần tài khoản, hoàn toàn chủ động theo nhịp học.',
  },
  {
    step: '02',
    title: 'Đọc bài ngữ cảnh thực tế',
    desc: 'Mỗi câu hỏi gắn liền với ngữ cảnh đời sống, trường học như dự án vườn rau, hoạt động nhóm.',
  },
  {
    step: '03',
    title: 'Xem giải thích chi tiết ngay',
    desc: 'Hiểu rõ tại sao đáp án đúng và vì sao các phương án khác chưa chính xác để nhớ lâu hơn.',
  },
];

export default function StudentHome({ onBrowse }: StudentHomeProps) {
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100/60 via-sky-50/40 to-white border border-sky-200/80 p-6 sm:p-10 lg:p-12 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-200/60 border border-sky-300 text-sky-900 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
              TIẾNG ANH THCS LỚP 6–9 · HỌC TỰ DO
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Từng bài nhỏ. Tự tin hơn mỗi ngày.
            </h1>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-2xl">
              Nền tảng tự học tiếng Anh tinh gọn cho học sinh THCS. Không cần đăng nhập, hoàn toàn miễn phí, bài tập ví dụ mẫu có giải thích rõ ràng giúp bạn làm chủ ngữ pháp và từ vựng từng bước một.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => onBrowse('6')}
                className="min-h-[44px] px-6 bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-sm transition-colors rounded-xl"
              >
                Học thử ngay Lớp 6
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                onClick={() => onBrowse('all')}
                className="min-h-[44px] px-5 border-sky-300 text-sky-900 hover:bg-sky-100/60 rounded-xl"
              >
                Xem tất cả các khối lớp
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-800">
                <CheckCircle2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Không cần tài khoản
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-800">
                <CheckCircle2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Nội dung mẫu minh họa (DEMO)
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-800">
                <CheckCircle2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Giải thích tiếng Việt dễ hiểu
              </span>
            </div>
          </div>

          {/* Right Column: Editorial sample card */}
          <div className="lg:col-span-5">
            <Card className="border-sky-200 bg-white/95 backdrop-blur-sm shadow-md shadow-sky-100/70 rounded-2xl overflow-hidden">
              <CardHeader className="bg-sky-50/70 border-b border-sky-100 p-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sky-900">
                    <Leaf className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span className="text-xs font-bold tracking-wide uppercase">School Garden Project</span>
                  </div>
                  <Badge variant="outline" className="border-sky-300 bg-sky-100/60 text-sky-800 text-[11px]">
                    Lớp 7 · Đọc & Từ vựng
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-3">
                <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                  &ldquo;The students planted vegetables in the school garden to{' '}
                  <span className="font-bold underline decoration-sky-500 decoration-2 text-sky-900">
                    ______
                  </span>{' '}
                  fresh food for the school canteen.&rdquo;
                </p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs text-emerald-950 font-medium">
                    <span>A. provide (Đúng: to-infinitive chỉ mục đích)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-600">
                    B. provided
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-600">
                    C. providing
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    #TừVựng
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    #MụcĐích
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Mẫu câu hỏi DEMO
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Grade Selection Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Chọn khối lớp để bắt đầu</h2>
            <p className="text-sm text-slate-600 mt-1">
              Nội dung bám sát từng lớp THCS với bài tập mẫu có lời giải chi tiết.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 w-fit">
            4 Khối lớp chính thức
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {GRADES.map((item) => (
            <Card
              key={item.grade}
              className="border-sky-100 hover:border-sky-300 bg-white shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-2xl"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <GraduationCap className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800 text-[11px]">
                    {item.badge}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900 pt-2">{item.title}</CardTitle>
                <CardDescription className="text-xs text-slate-600 leading-relaxed min-h-[48px]">
                  {item.focus}
                </CardDescription>
              </CardHeader>
              <CardFooter className="p-5 pt-0">
                <Button
                  onClick={() => onBrowse(item.grade)}
                  className="w-full min-h-[44px] bg-sky-50 hover:bg-sky-600 text-sky-900 hover:text-white border border-sky-200 hover:border-sky-600 transition-colors rounded-xl font-medium"
                >
                  Vào bài tập {item.title}
                  <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Skills Section */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rèn luyện theo kỹ năng</h2>
          <p className="text-sm text-slate-600 mt-1">
            Mỗi kỹ năng được phân chia rõ ràng giúp học sinh củng cố từng phần còn yếu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {SKILLS.map((skill) => {
            const Icon = skill.icon;
            return (
              <Card
                key={skill.id}
                className="border-sky-100 hover:border-sky-300 bg-white shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-2xl"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 text-[11px]">
                      {skill.tag}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900 pt-2">{skill.title}</CardTitle>
                  <CardDescription className="text-xs text-slate-600 leading-relaxed min-h-[40px]">
                    {skill.desc}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="p-5 pt-0">
                  <Button
                    onClick={() => onBrowse(skill.title)}
                    variant="outline"
                    className="w-full min-h-[44px] border-sky-200 text-sky-800 hover:bg-sky-50 rounded-xl font-medium"
                  >
                    Xem mẫu {skill.title}
                    <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 3-Step Learning Process */}
      <section className="rounded-3xl bg-sky-50/70 border border-sky-200 p-6 sm:p-10">
        <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
          <Badge variant="outline" className="border-sky-300 bg-white text-sky-800 text-xs">
            Phương pháp học tập
          </Badge>
          <h2 className="text-2xl font-bold text-slate-900">3 bước tự học đơn giản & hiệu quả</h2>
          <p className="text-sm text-slate-600">
            Không tạo áp lực điểm số, tập trung vào việc đọc hiểu bản chất và phản xạ câu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div key={step.step} className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm space-y-2">
              <span className="text-2xl font-black text-sky-600">{step.step}</span>
              <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
