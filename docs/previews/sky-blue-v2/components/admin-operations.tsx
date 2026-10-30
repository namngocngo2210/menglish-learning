"use client"

import * as React from "react"
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Filter,
  Layers,
  ListPlus,
  Play,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export type OperationsView = "overview" | "sources" | "tests" | "reports"

interface AdminOperationsProps {
  view: OperationsView
  onNavigate: (view: OperationsView | "bank" | "editor") => void
}

interface SourceItem {
  id: string
  name: string
  url: string
  license: string
  attribution: string
}

interface IngestJob {
  id: string
  sourceName: string
  status: "quarantined" | "pending_review" | "approved"
  dateLabel: string
  reason: string
}

interface MixerPreset {
  id: string
  title: string
  grade: string
  skill: string
  questionCount: number
}

interface QuestionReport {
  id: string
  questionCode: string
  summary: string
  details: string
  dateLabel: string
  status: "pending" | "resolved"
}

export default function AdminOperations({
  view,
  onNavigate,
}: AdminOperationsProps) {
  // Sources View State (In-Memory MOCK)
  const [sourcesList, setSourcesList] = React.useState<SourceItem[]>([
    {
      id: "src-1",
      name: "Nội dung tự biên soạn",
      url: "",
      license: "Creative Commons BY-NC 4.0",
      attribution: "Chủ sở hữu · nội dung mẫu tự biên soạn",
    },
    {
      id: "src-2",
      name: "Nguồn cấp phép mẫu",
      url: "",
      license: "Tài liệu mở Giáo dục OER Mẫu",
      attribution: "Dự án phát triển học liệu Tiếng Anh THCS DEMO",
    },
  ])

  const [formName, setFormName] = React.useState("")
  const [formUrl, setFormUrl] = React.useState("")
  const [formLicense, setFormLicense] = React.useState("CC-BY-4.0")
  const [formAttribution, setFormAttribution] = React.useState("")
  const [configAck, setConfigAck] = React.useState<string | null>(null)

  const [jobs, setJobs] = React.useState<IngestJob[]>([
    {
      id: "JOB-DEMO-01",
      sourceName: "Nguồn cấp phép mẫu",
      status: "quarantined",
      dateLabel: "Mẫu số 01",
      reason: "Giấy phép nguồn chưa kiểm chứng bản quyền -> Tự động cách ly",
    },
    {
      id: "JOB-DEMO-02",
      sourceName: "Nội dung tự biên soạn",
      status: "pending_review",
      dateLabel: "Mẫu số 02",
      reason: "Chờ người quản trị đối chiếu văn bản gốc thủ công",
    },
  ])

  // Tests Mixer State (In-Memory MOCK)
  const [presets, setPresets] = React.useState<MixerPreset[]>([
    {
      id: "PRE-01",
      title: "Đề ôn tập giữa kì 1 - Tổng hợp",
      grade: "Lớp 7",
      skill: "Ngữ pháp & Từ vựng",
      questionCount: 30,
    },
    {
      id: "PRE-02",
      title: "Kiểm tra 15 phút Đọc hiểu chuyên đề",
      grade: "Lớp 8",
      skill: "Đọc hiểu",
      questionCount: 15,
    },
  ])

  const [presetTitle, setPresetTitle] = React.useState("")
  const [presetGrade, setPresetGrade] = React.useState("Lớp 6")
  const [presetSkill, setPresetSkill] = React.useState("Ngữ pháp")
  const [presetCount, setPresetCount] = React.useState("20")
  const [presetDialogOpen, setPresetDialogOpen] = React.useState(false)
  const [presetError, setPresetError] = React.useState("")

  // Reports View State (In-Memory MOCK)
  const [reports, setReports] = React.useState<QuestionReport[]>([
    {
      id: "REP-DEMO-01",
      questionCode: "Q-204",
      summary: "Sai đáp án câu hỏi thì Quá khứ đơn",
      details:
        "Câu hỏi mã Q-204 ghi đáp án đúng là C (went) nhưng lời giải chi tiết lại chú thích phương án B (goes). Cần chỉnh sửa lời giải.",
      dateLabel: "Mẫu phản hồi #1",
      status: "pending",
    },
    {
      id: "REP-DEMO-02",
      questionCode: "Q-315",
      summary: "Lỗi hiển thị ngữ cảnh câu hỏi Đọc hiểu Unit 3",
      details:
        "Đoạn văn đọc hiểu thiếu mất dòng thứ 3 khiến học sinh khó chọn đáp án đúng cho câu hỏi đồng nghĩa.",
      dateLabel: "Mẫu phản hồi #2",
      status: "pending",
    },
  ])

  const [selectedReport, setSelectedReport] =
    React.useState<QuestionReport | null>(null)

  // Handle Sources Form Submit (MOCK)
  const handleSaveSourceConfig = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      setConfigAck("Lỗi MOCK: Vui lòng nhập tên nguồn tài liệu.")
      return
    }
    const newSrc: SourceItem = {
      id: `src-${Date.now()}`,
      name: formName.trim(),
      url: formUrl.trim(),
      license: formLicense,
      attribution:
        formAttribution.trim() || "Bản quyền biên soạn mẫu (Tự khai báo)",
    }
    setSourcesList((prev) => [newSrc, ...prev])
    setFormName("")
    setFormUrl("")
    setFormAttribution("")
    setConfigAck("Đã lưu cấu hình nguồn mẫu vào bộ nhớ DEMO thành công.")
  }

  // Handle Mock Crawl Trigger
  const handleTriggerTestCrawl = () => {
    const newJob: IngestJob = {
      id: `JOB-DEMO-${Math.floor(100 + Math.random() * 900)}`,
      sourceName: formName.trim() || "Nguồn mẫu vừa tạo",
      status: "quarantined",
      dateLabel: "Đợt chạy thử MOCK mới nhất",
      reason:
        "Đưa vào kiểm dịch (Quarantine): Đòi hỏi chủ biên phê duyệt thủ công trước khi chuyển thành bản nháp.",
    }
    setJobs((prev) => [newJob, ...prev])
  }

  // Handle Preset Save (MOCK)
  const handleSavePreset = () => {
    if (!presetTitle.trim()) {
      setPresetError("Vui lòng nhập tên bộ đề mẫu.")
      return
    }
    const count = parseInt(presetCount, 10)
    if (isNaN(count) || count < 5 || count > 50) {
      setPresetError("Số lượng câu hỏi mẫu phải từ 5 đến 50 câu.")
      return
    }
    setPresetError("")
    const newPreset: MixerPreset = {
      id: `PRE-${Math.floor(10 + Math.random() * 90)}`,
      title: presetTitle.trim(),
      grade: presetGrade,
      skill: presetSkill,
      questionCount: count,
    }
    setPresets((prev) => [...prev, newPreset])
    setPresetTitle("")
    setPresetDialogOpen(false)
  }

  // Mark Report as Resolved (MOCK)
  const handleMarkResolved = (id: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "resolved" as const } : r
      )
    )
    if (selectedReport && selectedReport.id === id) {
      setSelectedReport({ ...selectedReport, status: "resolved" })
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* =========================================================================
          VIEW 1: OVERVIEW (Tổng quan nội dung)
         ========================================================================= */}
      {view === "overview" && (
        <section aria-labelledby="overview-heading" className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-sky-100 pb-4">
            <div className="flex items-center gap-2">
              <h1
                id="overview-heading"
                className="text-2xl font-bold tracking-tight text-sky-950 sm:text-3xl"
              >
                Tổng quan nội dung
              </h1>
              <Badge
                variant="outline"
                className="border-sky-300 bg-sky-50 text-sky-800"
              >
                Góc tiếng Anh (Tên tạm)
              </Badge>
            </div>
            <p className="text-base leading-relaxed text-sky-800">
              Không gian quản trị biên tập độc lập cho một chủ biên (MOCK). Mọi
              thông tin là dữ liệu mẫu minh họa DEMO, không sử dụng xác thực thật
              hay lưu trữ vĩnh viễn.
            </p>
          </div>

          {/* Metric Cards - Explicitly DEMO fixtures */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-sky-200 bg-white shadow-sm hover:border-sky-300 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="text-sky-700 font-medium">
                  Bản nháp DEMO
                </CardDescription>
                <CardTitle className="text-3xl font-extrabold text-sky-950">
                  14{" "}
                  <span className="text-sm font-normal text-sky-600">câu</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-sky-700">
                Nội dung tự biên soạn đang soạn thảo mẫu.
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-white shadow-sm hover:border-sky-300 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="text-sky-700 font-medium">
                  Chờ duyệt DEMO
                </CardDescription>
                <CardTitle className="text-3xl font-extrabold text-sky-950">
                  6{" "}
                  <span className="text-sm font-normal text-sky-600">mục</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-sky-700">
                Chờ chủ biên duyệt trước khi phát hành.
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-white shadow-sm hover:border-sky-300 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="text-sky-700 font-medium">
                  Nguồn mẫu DEMO
                </CardDescription>
                <CardTitle className="text-3xl font-extrabold text-sky-950">
                  2{" "}
                  <span className="text-sm font-normal text-sky-600">
                    nguồn
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-sky-700">
                Cấu hình cấp phép và cách ly an toàn.
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-white shadow-sm hover:border-sky-300 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="text-sky-700 font-medium">
                  Báo lỗi DEMO
                </CardDescription>
                <CardTitle className="text-3xl font-extrabold text-sky-950">
                  2{" "}
                  <span className="text-sm font-normal text-sky-600">
                    phản hồi
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-sky-700">
                Góp ý nội dung câu hỏi từ học sinh mẫu.
              </CardContent>
            </Card>
          </div>

          {/* Pending Actions Navigation Links */}
          <Card className="border-sky-200 bg-sky-50/50">
            <CardHeader>
              <CardTitle className="text-lg text-sky-950 flex items-center gap-2">
                <Sliders className="size-5 text-sky-700" aria-hidden="true" />
                Lối tắt thao tác nhanh (MOCK)
              </CardTitle>
              <CardDescription className="text-sky-800">
                Chuyển nhanh đến các phân hệ biên tập và kiểm định nội dung:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  className="min-h-[44px] h-auto justify-start border-sky-300 bg-white text-sky-900 hover:bg-sky-100 whitespace-normal text-left py-3"
                  onClick={() => onNavigate("bank")}
                >
                  <BookOpen
                    className="size-4 shrink-0 mr-2 text-sky-600"
                    aria-hidden="true"
                  />
                  <span>Ngân hàng câu hỏi</span>
                </Button>

                <Button
                  variant="outline"
                  className="min-h-[44px] h-auto justify-start border-sky-300 bg-white text-sky-900 hover:bg-sky-100 whitespace-normal text-left py-3"
                  onClick={() => onNavigate("editor")}
                >
                  <FileEdit
                    className="size-4 shrink-0 mr-2 text-sky-600"
                    aria-hidden="true"
                  />
                  <span>Soạn thảo & Biên tập</span>
                </Button>

                <Button
                  variant="outline"
                  className="min-h-[44px] h-auto justify-start border-sky-300 bg-white text-sky-900 hover:bg-sky-100 whitespace-normal text-left py-3"
                  onClick={() => onNavigate("sources")}
                >
                  <Layers
                    className="size-4 shrink-0 mr-2 text-sky-600"
                    aria-hidden="true"
                  />
                  <span>Cấu hình nguồn & Kiểm dịch</span>
                </Button>

                <Button
                  variant="outline"
                  className="min-h-[44px] h-auto justify-start border-sky-300 bg-white text-sky-900 hover:bg-sky-100 whitespace-normal text-left py-3"
                  onClick={() => onNavigate("reports")}
                >
                  <AlertCircle
                    className="size-4 shrink-0 mr-2 text-sky-600"
                    aria-hidden="true"
                  />
                  <span>Xử lý báo lỗi nội dung</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Manual Publishing Pipeline Cards */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-sky-950">
              Quy trình xuất bản thủ công nghiêm ngặt (Manual Publishing)
            </h2>
            <p className="text-sm text-sky-800">
              Cam kết kiến trúc: Tuyệt đối không tự động phát hành (Never
              Autopublish). Mọi học liệu từ nguồn ngoài đều phải trải qua kiểm
              dịch và chữ ký duyệt thủ công của chủ biên.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="border-amber-200 bg-amber-50/40">
                <CardHeader className="pb-3">
                  <Badge className="w-fit bg-amber-100 text-amber-800 border-amber-300">
                    Bước 1
                  </Badge>
                  <CardTitle className="text-base text-amber-950 flex items-center gap-2">
                    <ShieldAlert
                      className="size-4 text-amber-600"
                      aria-hidden="true"
                    />
                    Khu vực kiểm dịch (Quarantine)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-amber-900 leading-relaxed">
                  Dữ liệu nhập thô được cô lập hoàn toàn. Kiểm tra bản quyền,
                  giấy phép nguồn mở và quét an toàn cấu trúc trước khi tạo bản
                  nháp.
                </CardContent>
              </Card>

              <Card className="border-sky-200 bg-sky-50/40">
                <CardHeader className="pb-3">
                  <Badge className="w-fit bg-sky-100 text-sky-800 border-sky-300">
                    Bước 2
                  </Badge>
                  <CardTitle className="text-base text-sky-950 flex items-center gap-2">
                    <FileText
                      className="size-4 text-sky-600"
                      aria-hidden="true"
                    />
                    Chủ biên thẩm định thủ công
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-sky-900 leading-relaxed">
                  Kiểm tra độ chính xác ngữ pháp, chuẩn kiến thức THCS (lớp 6-9)
                  và tính phù hợp sư phạm của ngữ liệu trước khi gắn cờ chờ
                  duyệt.
                </CardContent>
              </Card>

              <Card className="border-emerald-200 bg-emerald-50/40">
                <CardHeader className="pb-3">
                  <Badge className="w-fit bg-emerald-100 text-emerald-800 border-emerald-300">
                    Bước 3
                  </Badge>
                  <CardTitle className="text-base text-emerald-950 flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 text-emerald-600"
                      aria-hidden="true"
                    />
                    Xuất bản công khai có kiểm soát
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-emerald-900 leading-relaxed">
                  Chỉ khi có xác nhận chủ biên, đề thi và câu hỏi mới hiển thị
                  cho học sinh luyện tập. Không có tác vụ chạy ngầm tự xuất bản.
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Local Sample Activity - No fake live timestamps */}
          <Card className="border-sky-200">
            <CardHeader>
              <CardTitle className="text-base text-sky-950 flex items-center gap-2">
                <Clock className="size-4 text-sky-700" aria-hidden="true" />
                Nhật ký hoạt động mẫu gần đây (DEMO)
              </CardTitle>
              <CardDescription className="text-sky-800">
                Dữ liệu mẫu tĩnh mô phỏng các hoạt động biên tập nội bộ. Không sử
                dụng đồng hồ thời gian thực tế.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-md bg-sky-50/60 border border-sky-100">
                  <span className="text-sm font-medium text-sky-950">
                    Biên tập viên cập nhật giải thích câu hỏi Q-204 (Thì quá khứ
                    đơn)
                  </span>
                  <Badge
                    variant="secondary"
                    className="w-fit text-xs bg-sky-100 text-sky-800"
                  >
                    Đợt mẫu #01
                  </Badge>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-md bg-sky-50/60 border border-sky-100">
                  <span className="text-sm font-medium text-sky-950">
                    Kiểm duyệt đưa 1 gói câu hỏi vào khu vực cách ly an toàn
                  </span>
                  <Badge
                    variant="secondary"
                    className="w-fit text-xs bg-amber-100 text-amber-800"
                  >
                    Đợt mẫu #02
                  </Badge>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-md bg-sky-50/60 border border-sky-100">
                  <span className="text-sm font-medium text-sky-950">
                    Phê duyệt xuất bản thủ công đề ôn tập lớp 7 (Giữa kỳ 1)
                  </span>
                  <Badge
                    variant="secondary"
                    className="w-fit text-xs bg-emerald-100 text-emerald-800"
                  >
                    Đợt mẫu #03
                  </Badge>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* =========================================================================
          VIEW 2: SOURCES (Cấu hình nguồn & Kiểm dịch)
         ========================================================================= */}
      {view === "sources" && (
        <section aria-labelledby="sources-heading" className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-sky-100 pb-4">
            <h1
              id="sources-heading"
              className="text-2xl font-bold tracking-tight text-sky-950 sm:text-3xl"
            >
              Cấu hình nguồn tài liệu & Kiểm dịch (MOCK)
            </h1>
            <p className="text-base leading-relaxed text-sky-800">
              Quản lý giấy phép, nguồn trích dẫn và các tác vụ nạp dữ liệu mẫu.
              Không thực hiện truy vấn mạng hay thu thập thực tế.
            </p>
          </div>

          {/* SSRF Security Warning Alert */}
          <Alert className="border-sky-200 bg-sky-50 text-sky-950">
            <ShieldAlert
              className="size-5 text-sky-700"
              aria-hidden="true"
            />
            <AlertTitle className="font-semibold text-sky-950">
              Cảnh báo an toàn dữ liệu: Ngăn chặn SSRF & Thu thập ngoài luồng
            </AlertTitle>
            <AlertDescription className="text-sky-800 mt-1 leading-relaxed">
              Nguyên mẫu thiết kế này tuyệt đối không gửi request HTTP ra
              Internet. Trường URL chỉ lưu trữ thông tin nhận diện mẫu, tránh các
              lỗ hổng SSRF (Server-Side Request Forgery) và ngăn chặn việc tự
              động sao chép học liệu chưa qua thẩm định.
            </AlertDescription>
          </Alert>

          {/* Source Config Form */}
          <Card className="border-sky-200">
            <CardHeader>
              <CardTitle className="text-lg text-sky-950">
                Thêm cấu hình nguồn mẫu mới
              </CardTitle>
              <CardDescription className="text-sky-800">
                Khai báo thông tin pháp lý và tác quyền trước khi đưa vào danh
                sách nạp thử nghiệm.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSourceConfig} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="source-name"
                      className="text-sm font-medium text-sky-950"
                    >
                      Tên nguồn tài liệu mẫu{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="source-name"
                      placeholder="Ví dụ: Đề cương tự biên soạn Unit 1"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="min-h-[44px] border-sky-300"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="source-url"
                      className="text-sm font-medium text-sky-950"
                    >
                      Địa chỉ tham chiếu mẫu (Không fetch mạng)
                    </Label>
                    <Input
                      id="source-url"
                      type="text"
                      placeholder="https://vi-du-nguon-mau.local/tailieu (Mô phỏng)"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      className="min-h-[44px] border-sky-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="source-license"
                      className="text-sm font-medium text-sky-950"
                    >
                      Giấy phép bản quyền (Bắt buộc)
                    </Label>
                    <Select
                      value={formLicense}
                      onValueChange={setFormLicense}
                    >
                      <SelectTrigger
                        id="source-license"
                        className="min-h-[44px] border-sky-300 bg-white"
                      >
                        <SelectValue placeholder="Chọn giấy phép" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC-BY-4.0">
                          Creative Commons Ghi nhận 4.0 (CC BY 4.0)
                        </SelectItem>
                        <SelectItem value="CC-BY-NC-4.0">
                          Phi thương mại 4.0 (CC BY-NC 4.0)
                        </SelectItem>
                        <SelectItem value="OER-EDU">
                          Tài nguyên Giáo dục Mở (OER Giảng dạy)
                        </SelectItem>
                        <SelectItem value="INTERNAL-AUTH">
                          Nội dung tự biên soạn (Bản quyền nội bộ)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="source-attrib"
                      className="text-sm font-medium text-sky-950"
                    >
                      Ghi nhận tác giả / Nguồn dẫn (Attribution)
                    </Label>
                    <Input
                      id="source-attrib"
                      placeholder="Ví dụ: Thầy cô Tổ Tiếng Anh THCS biên soạn"
                      value={formAttribution}
                      onChange={(e) => setFormAttribution(e.target.value)}
                      className="min-h-[44px] border-sky-300"
                    />
                  </div>
                </div>

                {configAck && (
                  <div className="rounded-md bg-sky-100 p-3 text-sm font-medium text-sky-900 border border-sky-200">
                    {configAck}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    type="submit"
                    className="min-h-[44px] bg-sky-700 hover:bg-sky-800 text-white font-medium"
                  >
                    Lưu cấu hình mẫu (MOCK)
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTriggerTestCrawl}
                    className="min-h-[44px] border-sky-300 text-sky-900 hover:bg-sky-50"
                  >
                    <Play
                      className="size-4 mr-2 text-sky-600"
                      aria-hidden="true"
                    />
                    Chạy thử (MOCK) - Thêm vào kiểm dịch
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Configured Sources List */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-sky-950">
              Danh sách nguồn học liệu mẫu đã cấu hình
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sourcesList.map((src) => (
                <Card key={src.id} className="border-sky-200 bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base text-sky-950">
                        {src.name}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className="bg-sky-100 text-sky-800"
                      >
                        {src.license}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-sky-800">
                    <p>
                      <strong className="text-sky-950">Ghi nhận:</strong>{" "}
                      {src.attribution}
                    </p>
                    <p className="text-xs text-sky-600 truncate">
                      {src.url ? `URL: ${src.url}` : "Không có liên kết mạng ngoài (Nội bộ)"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Ingest and Quarantine Jobs Table */}
          <Card className="border-sky-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg text-sky-950">
                  Nhật ký các đợt nạp & Khu vực kiểm dịch mẫu
                </CardTitle>
                <CardDescription className="text-sky-800">
                  Mọi gói dữ liệu nạp thử đều bị cách ly để chủ biên kiểm tra
                  trực tiếp trước khi xuất bản.
                </CardDescription>
              </div>

              {/* Sample Quarantine Details Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-[44px] border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                  >
                    <ShieldAlert
                      className="size-4 mr-2 text-amber-600"
                      aria-hidden="true"
                    />
                    Chi tiết lỗi kiểm dịch mẫu
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-sky-950">
                      Cơ chế cách ly tự động (Quarantine Policy)
                    </DialogTitle>
                    <DialogDescription className="text-sky-800">
                      Bảo đảm không bao giờ xuất bản tự động khi chưa qua phê duyệt
                      chủ biên.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2 text-sm text-sky-900 leading-relaxed">
                    <p>
                      <strong>Nguyên tắc vận hành:</strong> Khi một đợt nạp học
                      liệu được khởi tạo, hệ thống ngay lập tức gắn nhãn{" "}
                      <span className="font-semibold text-amber-700">
                        Đã cách ly (Quarantined)
                      </span>
                      .
                    </p>
                    <p>
                      <strong>Lý do kiểm dịch phổ biến:</strong>
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sky-800">
                      <li>Giấy phép nguồn chưa được đối chiếu bản gốc.</li>
                      <li>
                        Định dạng câu hỏi chứa ký tự lạ hoặc thẻ HTML chưa được
                        làm sạch.
                      </li>
                      <li>
                        Mức độ nhận biết câu hỏi chưa phân định rõ theo chuẩn
                        lớp 6-9.
                      </li>
                    </ul>
                    <p className="text-xs text-sky-700 italic border-t pt-2">
                      Chỉ có chủ biên có thể chuyển trạng thái từ Kiểm dịch sang
                      Bản nháp hoặc Xuất bản trong chế độ thẩm định thủ công.
                    </p>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button className="min-h-[44px] bg-sky-700 hover:bg-sky-800 text-white">
                        Đã hiểu quy tắc
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              <p className="text-xs text-sky-700 mb-2">
                Bảng dữ liệu có thể cuộn ngang trên màn hình nhỏ.
              </p>
              <div
                role="region"
                aria-label="Danh sách các đợt nạp học liệu"
                tabIndex={0}
                className="overflow-x-auto rounded-md border border-sky-100 focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
              >
                <Table>
                  <TableHeader className="bg-sky-50">
                    <TableRow>
                      <TableHead className="text-sky-950 font-semibold">
                        Mã đợt nạp
                      </TableHead>
                      <TableHead className="text-sky-950 font-semibold">
                        Nguồn học liệu
                      </TableHead>
                      <TableHead className="text-sky-950 font-semibold">
                        Trạng thái kiểm dịch
                      </TableHead>
                      <TableHead className="text-sky-950 font-semibold">
                        Lý do / Hướng dẫn
                      </TableHead>
                      <TableHead className="text-sky-950 font-semibold">
                        Thời điểm
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium text-sky-950 whitespace-nowrap">
                          {job.id}
                        </TableCell>
                        <TableCell className="text-sky-900 font-medium">
                          {job.sourceName}
                        </TableCell>
                        <TableCell>
                          {job.status === "quarantined" && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-900"
                            >
                              Đã cách ly (Quarantine)
                            </Badge>
                          )}
                          {job.status === "pending_review" && (
                            <Badge
                              variant="outline"
                              className="border-sky-300 bg-sky-50 text-sky-900"
                            >
                              Chờ chủ biên duyệt
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-sky-800 max-w-xs">
                          {job.reason}
                        </TableCell>
                        <TableCell className="text-xs text-sky-600 whitespace-nowrap">
                          {job.dateLabel}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* =========================================================================
          VIEW 3: TESTS (Bộ đề mẫu & Bộ trộn đề mẫu)
         ========================================================================= */}
      {view === "tests" && (
        <section aria-labelledby="tests-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100 pb-4">
            <div>
              <h1
                id="tests-heading"
                className="text-2xl font-bold tracking-tight text-sky-950 sm:text-3xl"
              >
                Quản lý đề thi & Cấu hình bộ trộn (MOCK)
              </h1>
              <p className="text-base leading-relaxed text-sky-800">
                Thử nghiệm cấu trúc đề thi mẫu cho học sinh THCS (Lớp 6–9).
                Không kết nối thuật toán máy chủ ngầm.
              </p>
            </div>

            {/* Create Preset Dialog */}
            <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
              <DialogTrigger asChild>
                <Button className="min-h-[44px] bg-sky-700 hover:bg-sky-800 text-white font-medium">
                  <PlusCircle
                    className="size-4 mr-2"
                    aria-hidden="true"
                  />
                  Tạo cấu hình bộ trộn (MOCK)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-sky-950">
                    Thêm cấu hình trộn đề mẫu (Mixer Preset)
                  </DialogTitle>
                  <DialogDescription className="text-sky-800">
                    Định cấu hình số lượng và khối lớp cho đề luyện tập mẫu.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="preset-title"
                      className="text-sm font-medium text-sky-950"
                    >
                      Tên cấu hình bộ đề{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="preset-title"
                      placeholder="Ví dụ: Đề tổng kết học kì 1 Lớp 7"
                      value={presetTitle}
                      onChange={(e) => setPresetTitle(e.target.value)}
                      className="min-h-[44px] border-sky-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="preset-grade"
                        className="text-sm font-medium text-sky-950"
                      >
                        Khối lớp
                      </Label>
                      <Select
                        value={presetGrade}
                        onValueChange={setPresetGrade}
                      >
                        <SelectTrigger
                          id="preset-grade"
                          className="min-h-[44px] border-sky-300 bg-white"
                        >
                          <SelectValue placeholder="Chọn khối lớp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lớp 6">Lớp 6</SelectItem>
                          <SelectItem value="Lớp 7">Lớp 7</SelectItem>
                          <SelectItem value="Lớp 8">Lớp 8</SelectItem>
                          <SelectItem value="Lớp 9">Lớp 9</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="preset-skill"
                        className="text-sm font-medium text-sky-950"
                      >
                        Kỹ năng trọng tâm
                      </Label>
                      <Select
                        value={presetSkill}
                        onValueChange={setPresetSkill}
                      >
                        <SelectTrigger
                          id="preset-skill"
                          className="min-h-[44px] border-sky-300 bg-white"
                        >
                          <SelectValue placeholder="Chọn kỹ năng" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ngữ pháp">Ngữ pháp</SelectItem>
                          <SelectItem value="Từ vựng">Từ vựng</SelectItem>
                          <SelectItem value="Đọc hiểu">Đọc hiểu</SelectItem>
                          <SelectItem value="Ngữ pháp & Từ vựng">
                            Ngữ pháp & Từ vựng
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="preset-count"
                      className="text-sm font-medium text-sky-950"
                    >
                      Số lượng câu hỏi mẫu (Từ 5 đến 50 câu)
                    </Label>
                    <Input
                      id="preset-count"
                      type="number"
                      min={5}
                      max={50}
                      value={presetCount}
                      onChange={(e) => setPresetCount(e.target.value)}
                      className="min-h-[44px] border-sky-300"
                    />
                  </div>

                  {presetError && (
                    <p className="text-sm font-medium text-destructive">
                      {presetError}
                    </p>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose asChild>
                    <Button
                      variant="outline"
                      className="min-h-[44px] border-sky-300 text-sky-900"
                    >
                      Hủy bỏ
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleSavePreset}
                    className="min-h-[44px] bg-sky-700 hover:bg-sky-800 text-white"
                  >
                    Lưu cấu hình (MOCK)
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabs for Fixed Tests vs Mixer Presets */}
          <Tabs defaultValue="presets" className="w-full">
            <TabsList className="bg-sky-100 p-1 border border-sky-200">
              <TabsTrigger
                value="presets"
                className="min-h-[40px] px-4 text-sky-900 data-[state=active]:bg-white data-[state=active]:text-sky-950 font-medium"
              >
                Cấu hình bộ trộn mẫu (Presets)
              </TabsTrigger>
              <TabsTrigger
                value="fixed"
                className="min-h-[40px] px-4 text-sky-900 data-[state=active]:bg-white data-[state=active]:text-sky-950 font-medium"
              >
                Đề thi mẫu cố định (Fixed DEMO)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {presets.map((item) => (
                  <Card key={item.id} className="border-sky-200 bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-bold text-sky-950">
                          {item.title}
                        </CardTitle>
                        <Badge className="bg-sky-700 text-white">
                          {item.grade}
                        </Badge>
                      </div>
                      <CardDescription className="text-sky-700">
                        Chuyên đề: {item.skill}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-sky-900">
                        <span>Số lượng câu hỏi mẫu:</span>
                        <span className="font-bold">{item.questionCount} câu</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-sky-700">
                          <span>Phân bố mức độ mẫu (SAMPLE):</span>
                          <span>40% NB - 40% TH - 20% VD</span>
                        </div>
                        <Progress value={80} className="h-2 bg-sky-100" />
                      </div>
                    </CardContent>
                    <CardFooter className="border-t border-sky-100 pt-3 flex justify-between items-center text-xs text-sky-600">
                      <span>Cấu hình cục bộ (In-memory)</span>
                      <span className="font-semibold text-sky-800">
                        Mã: {item.id}
                      </span>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {/* Deterministic Sample Preview Notice */}
              <Card className="border-sky-200 bg-sky-50/50">
                <CardHeader>
                  <CardTitle className="text-base text-sky-950 flex items-center gap-2">
                    <Sliders
                      className="size-4 text-sky-700"
                      aria-hidden="true"
                    />
                    Xem trước bố cục sinh đề tất định (Deterministic SAMPLE)
                  </CardTitle>
                  <CardDescription className="text-sky-800">
                    Bản trình diễn này minh họa cách các câu hỏi được phân bổ
                    theo tỉ lệ chuẩn sư phạm. Không áp dụng thuật toán ngẫu nhiên
                    phía máy chủ.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-sky-900">
                  <div className="p-3 bg-white rounded border border-sky-200 space-y-2">
                    <p className="font-medium text-sky-950">
                      Ví dụ ma trận đề thi chuẩn THCS (30 câu):
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-sky-800">
                      <li>Nhận biết (12 câu): Ngữ âm và nhận diện thì động từ.</li>
                      <li>Thông hiểu (12 câu): Điền từ đoạn văn và từ đồng nghĩa.</li>
                      <li>Vận dụng (6 câu): Đọc hiểu suy luận và viết lại câu.</li>
                    </ul>
                  </div>
                  <p className="text-xs text-sky-600">
                    * Mọi thông số mang tính chất minh họa giao diện cho hội
                    đồng thẩm định thiết kế.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fixed" className="space-y-4 pt-4">
              <Card className="border-sky-200">
                <CardHeader>
                  <CardTitle className="text-base text-sky-950">
                    Danh mục đề thi mẫu cố định
                  </CardTitle>
                  <CardDescription className="text-sky-800">
                    Các bộ đề đã được thẩm định hoàn tất và sẵn sàng cho học
                    sinh luyện tập mẫu.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg border border-sky-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-sky-950">
                          Đề thi kiểm tra 45 phút học kì 1 - Tiếng Anh 7
                        </h3>
                        <p className="text-xs text-sky-700 mt-1">
                          Gồm 40 câu trắc nghiệm bao quát Unit 1 đến Unit 6.
                          Đầy đủ đáp án và lời giải chi tiết.
                        </p>
                      </div>
                      <Badge className="w-fit bg-emerald-600 text-white">
                        Đã duyệt phát hành
                      </Badge>
                    </div>

                    <div className="p-4 rounded-lg border border-sky-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-sky-950">
                          Đề ôn luyện chuyên sâu Ngữ pháp lớp 8
                        </h3>
                        <p className="text-xs text-sky-700 mt-1">
                          25 câu chuyên đề câu điều kiện loại 1 và thì hiện tại
                          hoàn thành.
                        </p>
                      </div>
                      <Badge className="w-fit bg-emerald-600 text-white">
                        Đã duyệt phát hành
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      )}

      {/* =========================================================================
          VIEW 4: REPORTS (Báo lỗi nội dung)
         ========================================================================= */}
      {view === "reports" && (
        <section aria-labelledby="reports-heading" className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-sky-100 pb-4">
            <h1
              id="reports-heading"
              className="text-2xl font-bold tracking-tight text-sky-950 sm:text-3xl"
            >
              Xử lý phản hồi & Báo lỗi câu hỏi (MOCK)
            </h1>
            <p className="text-base leading-relaxed text-sky-800">
              Tiếp nhận ý kiến góp ý về nội dung câu hỏi, chính tả và tính chính
              xác khoa học từ người học.
            </p>
          </div>

          <div className="space-y-4">
            {reports.map((report) => (
              <Card
                key={report.id}
                className={`border-sky-200 transition-colors ${
                  report.status === "resolved" ? "bg-sky-50/30" : "bg-white"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-sky-300 font-mono text-xs text-sky-900 bg-sky-50"
                      >
                        {report.questionCode}
                      </Badge>
                      <CardTitle className="text-base font-bold text-sky-950">
                        {report.summary}
                      </CardTitle>
                    </div>

                    {report.status === "pending" ? (
                      <Badge className="bg-amber-600 text-white">
                        Đang chờ xử lý
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-600 text-white">
                        Đã xử lý (MOCK)
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-sky-600">
                    Mã phản hồi: {report.id} • {report.dateLabel}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-sky-900 leading-relaxed">
                    {report.details}
                  </p>
                </CardContent>

                <CardFooter className="border-t border-sky-100 pt-3 flex flex-wrap gap-2 justify-end">
                  {/* Report Detail Dialog */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedReport(report)}
                        className="min-h-[44px] border-sky-300 text-sky-900 hover:bg-sky-50"
                      >
                        Xem chi tiết báo cáo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-sky-950 flex items-center gap-2">
                          <AlertCircle
                            className="size-5 text-sky-700"
                            aria-hidden="true"
                          />
                          Chi tiết phản hồi {report.questionCode}
                        </DialogTitle>
                        <DialogDescription className="text-sky-800">
                          Bản ghi nhận báo lỗi nội dung câu hỏi từ học sinh.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-2 text-sm text-sky-950">
                        <div className="rounded-md bg-sky-50 p-3 border border-sky-200">
                          <p className="font-semibold text-sky-900 mb-1">
                            Vấn đề phản ánh:
                          </p>
                          <p className="text-sky-800 leading-relaxed">
                            {report.details}
                          </p>
                        </div>

                        <div className="space-y-1 text-xs text-sky-700">
                          <p>
                            <strong>Trạng thái xử lý:</strong>{" "}
                            {report.status === "pending"
                              ? "Chờ biên tập viên rà soát"
                              : "Đã khắc phục trong phiên soạn thảo"}
                          </p>
                          <p>
                            <strong>Hành động đề xuất:</strong> Mở trực tiếp câu
                            hỏi trong Trình biên tập để cập nhật đáp án chuẩn.
                          </p>
                        </div>
                      </div>

                      <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        {report.status === "pending" && (
                          <Button
                            type="button"
                            onClick={() => handleMarkResolved(report.id)}
                            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2
                              className="size-4 mr-2"
                              aria-hidden="true"
                            />
                            Đánh dấu xử lý (MOCK)
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onNavigate("editor")}
                          className="min-h-[44px] border-sky-300 text-sky-900"
                        >
                          <FileEdit
                            className="size-4 mr-2 text-sky-600"
                            aria-hidden="true"
                          />
                          Mở trong trình biên tập
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {report.status === "pending" && (
                    <Button
                      onClick={() => handleMarkResolved(report.id)}
                      className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Đánh dấu xử lý (MOCK)
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => onNavigate("editor")}
                    className="min-h-[44px] border-sky-300 text-sky-900 hover:bg-sky-50"
                  >
                    Mở trình biên tập
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
