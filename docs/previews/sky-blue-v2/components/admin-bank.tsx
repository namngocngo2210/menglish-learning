"use client"

import React, { useState, useId } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  BookOpen,
  Search,
  FileEdit,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Eye,
  Filter,
  Check,
} from "lucide-react"

export interface BankItem {
  id: string
  type: "question" | "passage"
  title: string
  content: string
  grade: "6" | "7" | "8" | "9"
  status: "draft" | "quarantine" | "review" | "published"
  options?: string[]
  answer?: string
  explanation?: string
  license: string
  author: string
}

const INITIAL_ITEMS: BankItem[] = [
  {
    id: "demo-q1",
    type: "question",
    grade: "6",
    title: "Thì quá khứ đơn (Past Simple) - Động từ có quy tắc",
    content: "Choose the correct verb form: 'She ______ (visit) Ha Long Bay last summer.'",
    options: ["A. visits", "B. visited", "C. has visited", "D. was visiting"],
    answer: "B. visited",
    explanation: "Dấu hiệu 'last summer' biểu thị hành động đã kết thúc tại mốc thời gian xác định trong quá khứ, dùng thì Quá khứ đơn (Past Simple).",
    status: "published",
    license: "Bản quyền mẫu CC BY-SA 4.0 (Tự biên soạn)",
    author: "Chủ biên Góc tiếng Anh",
  },
  {
    id: "demo-q2",
    type: "question",
    grade: "7",
    title: "Liên từ đối lập (Conjunctions) - Quan hệ tương phản",
    content: "Complete the sentence: 'Nam was very tired, ______ he still completed all his English exercises.'",
    options: ["A. so", "B. but", "C. because", "D. although"],
    answer: "B. but",
    explanation: "Hai mệnh đề thể hiện sự tương phản: dù mệt nhưng Nam vẫn hoàn thành bài tập, dùng liên từ 'but'.",
    status: "review",
    license: "Nội dung soạn mẫu sư phạm THCS",
    author: "Cộng tác viên nội dung (Chờ duyệt)",
  },
  {
    id: "demo-q3",
    type: "question",
    grade: "9",
    title: "Câu điều kiện loại 2 (Conditional Type 2) - Giả định",
    content: "Choose the correct option: 'If I ______ a bird, I would fly around the world.'",
    options: ["A. am", "B. was", "C. were", "D. would be"],
    answer: "C. were",
    explanation: "Câu điều kiện loại 2 diễn tả giả định không có thật ở hiện tại. Động từ 'to be' chia là 'were' cho tất cả các ngôi theo chuẩn ngữ pháp học đường.",
    status: "draft",
    license: "Bản thảo độc quyền nội bộ (Chưa công bố)",
    author: "Chủ biên (Đang phác thảo)",
  },
  {
    id: "demo-p1",
    type: "passage",
    grade: "8",
    title: "Làng gốm Bát Tràng (Bat Trang Ceramic Heritage)",
    content: "Bat Trang is a 500-year-old traditional porcelain and pottery village situated on the bank of the Red River in Hanoi. Artisans blend ancient firing techniques with contemporary styles to craft renowned ceramics. Students often visit the kilns to practice shaping clay and learn about Vietnamese cultural heritage.",
    answer: "Gồm 3 câu hỏi trắc nghiệm đọc hiểu (Main idea, Vocabulary, Context).",
    explanation: "Bài đọc rèn luyện từ vựng chủ đề Heritage và kỹ năng Skimming/Scanning cho học sinh lớp 8.",
    status: "published",
    license: "Văn bản mẫu tự biên soạn giáo dục",
    author: "Tổ biên soạn THCS",
  },
  {
    id: "demo-p2",
    type: "passage",
    grade: "9",
    title: "Lối sống xanh tại đô thị biển (Eco-friendly Living)",
    content: "Da Nang has launched community initiatives encouraging youth to reduce single-use plastic along its central beaches. Local schools organize weekend clean-up campaigns, turning collected plastic debris into useful school items. These hands-on activities foster environmental awareness and practical English communication.",
    answer: "Gồm 4 câu hỏi đọc hiểu suy luận và liên hệ thực tế.",
    explanation: "Chủ đề bám sát chương trình tiếng Anh lớp 9 mới (Unit: Our Communities / Green Living).",
    status: "quarantine",
    license: "Tài liệu nạp mẫu cần thẩm định bản quyền",
    author: "Nạp từ nguồn mở (Quarantine - Cần rà soát)",
  },
]

export default function AdminBank({ onEdit }: { onEdit: () => void }) {
  const [items, setItems] = useState<BankItem[]>(INITIAL_ITEMS)
  const [searchQuery, setSearchQuery] = useState("")
  const [gradeFilter, setGradeFilter] = useState<string>("all")
  const [selectedReviewItem, setSelectedReviewItem] = useState<BankItem | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const searchInputId = useId()
  const gradeSelectId = useId()

  const handleResetFilters = () => {
    setSearchQuery("")
    setGradeFilter("all")
  }

  const handleApproveMock = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "published" } : item))
    )
    setSelectedReviewItem(null)
    setFeedbackMessage(
      "Đã duyệt mẫu thành công: Mục đã chuyển sang trạng thái 'Đã xuất bản' (MOCK: Không gửi yêu cầu lên máy chủ)."
    )
    setTimeout(() => setFeedbackMessage(null), 5000)
  }

  const filterItems = (itemList: BankItem[]) => {
    return itemList.filter((item) => {
      const matchGrade = gradeFilter === "all" || item.grade === gradeFilter
      const query = searchQuery.toLowerCase().trim()
      const matchSearch =
        query === "" ||
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query)
      return matchGrade && matchSearch
    })
  }

  const renderStatusBadge = (status: BankItem["status"]) => {
    switch (status) {
      case "published":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-medium">
            Đã xuất bản
          </Badge>
        )
      case "review":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 font-medium">
            Chờ duyệt
          </Badge>
        )
      case "quarantine":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100 font-medium">
            Cách ly kiểm duyệt
          </Badge>
        )
      case "draft":
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100 font-medium">
            Bản nháp
          </Badge>
        )
    }
  }

  const questionsList = filterItems(items.filter((i) => i.type === "question"))
  const passagesList = filterItems(items.filter((i) => i.type === "passage"))
  const reviewQueueList = filterItems(
    items.filter((i) => i.status === "review" || i.status === "quarantine")
  )

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-8 text-center sm:p-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700 mb-3">
        <Search className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-sky-950 sm:text-lg">
        Không tìm thấy nội dung mẫu phù hợp
      </h3>
      <p className="mt-1 max-w-md text-sm text-slate-600 break-words">
        Không có mục nào khớp với từ khóa tìm kiếm hoặc khối lớp đang chọn. Hãy thử điều chỉnh lại bộ lọc.
      </p>
      <Button
        variant="outline"
        onClick={handleResetFilters}
        className="mt-4 min-h-[44px] min-w-[44px] h-auto whitespace-normal border-sky-300 text-sky-800 hover:bg-sky-100"
      >
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        Đặt lại bộ lọc (MOCK)
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Informational Alert for Protected Route Mock */}
      <Alert className="border-sky-200 bg-sky-50/80 text-sky-950 shadow-sm">
        <ShieldCheck className="h-5 w-5 text-sky-700" aria-hidden="true" />
        <AlertTitle className="text-sm font-bold text-sky-900">
          Chế độ xem trước giao diện quản trị (MOCK ONLY)
        </AlertTitle>
        <AlertDescription className="text-xs text-sky-800 leading-relaxed break-words">
          Không có xác thực hay tuyến bảo vệ thực tế trên máy chủ. Mọi dữ liệu chỉ hoạt động trong bộ nhớ cục bộ, tuân thủ nguyên tắc chủ biên rà soát thủ công trước khi xuất bản.
        </AlertDescription>
      </Alert>

      {feedbackMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <AlertTitle className="text-sm font-semibold text-emerald-900">
            Thông báo trạng thái
          </AlertTitle>
          <AlertDescription className="text-xs text-emerald-800 break-words">
            {feedbackMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Card className="border-sky-100 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-7">
              <Label htmlFor={searchInputId} className="text-xs font-semibold text-slate-700 block mb-1.5">
                Tìm kiếm câu hỏi / bài đọc
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id={searchInputId}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập tiêu đề, nội dung hoặc tác giả..."
                  className="pl-9 min-h-[44px] border-sky-200 focus-visible:ring-sky-500 text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <Label htmlFor={gradeSelectId} className="text-xs font-semibold text-slate-700 block mb-1.5">
                Khối lớp (THCS)
              </Label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger id={gradeSelectId} className="min-h-[44px] border-sky-200 focus:ring-sky-500 text-sm">
                  <SelectValue placeholder="Chọn khối lớp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả các lớp (6–9)</SelectItem>
                  <SelectItem value="6">Lớp 6</SelectItem>
                  <SelectItem value="7">Lớp 7</SelectItem>
                  <SelectItem value="8">Lớp 8</SelectItem>
                  <SelectItem value="9">Lớp 9</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="w-full min-h-[44px] min-w-[44px] h-auto whitespace-normal border-sky-200 text-slate-700 hover:bg-sky-50 text-xs sm:text-sm font-medium"
              >
                <Filter className="mr-1.5 h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                Đặt lại
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-sky-100/70 p-1 min-h-[48px]">
          <TabsTrigger
            value="questions"
            className="min-h-[40px] text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-sky-900 sm:text-sm"
          >
            Câu hỏi ({questionsList.length})
          </TabsTrigger>
          <TabsTrigger
            value="passages"
            className="min-h-[40px] text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-sky-900 sm:text-sm"
          >
            Bài đọc ({passagesList.length})
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="min-h-[40px] text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-sky-900 sm:text-sm"
          >
            Chờ duyệt ({reviewQueueList.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Questions */}
        <TabsContent value="questions" className="mt-4 space-y-4">
          {questionsList.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid gap-4">
              {questionsList.map((item) => (
                <Card key={item.id} className="border-sky-100 bg-white shadow-sm transition hover:border-sky-200">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800 font-semibold">
                          Lớp {item.grade}
                        </Badge>
                        {renderStatusBadge(item.status)}
                      </div>
                      <span className="text-xs text-slate-500 break-words">{item.license}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-sky-950 mt-2 break-words">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-800 mt-1 break-words">
                      {item.content}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-4 sm:px-5 py-2">
                    {item.options && (
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 mt-2">
                        {item.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`rounded-md border p-2 text-xs font-medium break-words ${
                              opt.startsWith(item.answer?.charAt(0) || "")
                                ? "border-emerald-300 bg-emerald-50/60 text-emerald-900"
                                : "border-slate-100 bg-slate-50/50 text-slate-700"
                            }`}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.explanation && (
                      <p className="mt-2 text-xs text-slate-600 bg-sky-50/50 p-2.5 rounded-md border border-sky-100 break-words">
                        <strong className="text-sky-900 font-semibold">Giải thích mẫu: </strong>
                        {item.explanation}
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-50 bg-slate-50/40 p-4">
                    <span className="text-xs text-slate-600 break-words">Tác giả: {item.author}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onEdit}
                        className="min-h-[44px] min-w-[44px] h-auto whitespace-normal border-sky-200 text-sky-900 hover:bg-sky-50 text-xs sm:text-sm"
                      >
                        <FileEdit className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Chỉnh sửa (MOCK)
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Passages */}
        <TabsContent value="passages" className="mt-4 space-y-4">
          {passagesList.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid gap-4">
              {passagesList.map((item) => (
                <Card key={item.id} className="border-sky-100 bg-white shadow-sm transition hover:border-sky-200">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800 font-semibold">
                          Lớp {item.grade}
                        </Badge>
                        {renderStatusBadge(item.status)}
                      </div>
                      <span className="text-xs text-slate-500 break-words">{item.license}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-sky-950 mt-2 break-words">
                      {item.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="px-4 sm:px-5 py-2">
                    <div className="rounded-lg border border-sky-100 bg-sky-50/30 p-3.5 text-xs sm:text-sm leading-relaxed text-slate-800 break-words">
                      {item.content}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="font-medium text-sky-900">Chi tiết đính kèm: {item.answer}</span>
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-50 bg-slate-50/40 p-4">
                    <span className="text-xs text-slate-600 break-words">Nguồn gốc: {item.author}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onEdit}
                      className="min-h-[44px] min-w-[44px] h-auto whitespace-normal border-sky-200 text-sky-900 hover:bg-sky-50 text-xs sm:text-sm"
                    >
                      <FileEdit className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Chỉnh sửa (MOCK)
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Review Queue */}
        <TabsContent value="review" className="mt-4 space-y-4">
          <Alert className="border-amber-200 bg-amber-50/70 text-amber-950 shadow-sm">
            <AlertCircle className="h-5 w-5 text-amber-700" aria-hidden="true" />
            <AlertTitle className="text-sm font-bold text-amber-900">
              Quy trình kiểm duyệt thủ công của chủ biên (Strict Owner Review)
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-800 leading-relaxed break-words">
              Mọi tài liệu nạp vào hệ thống hoặc đề xuất mới bắt buộc phải trải qua cách ly (Quarantine/Review) và chỉ được xuất bản sau khi chủ biên xác nhận thủ công. Không bao giờ tự động xuất bản (No Autopublish).
            </AlertDescription>
          </Alert>

          {reviewQueueList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-sky-100 bg-white p-8 text-center sm:p-12 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-3">
                <Check className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                Hàng đợi kiểm duyệt đang trống
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Tất cả câu hỏi và bài đọc mẫu đã được xử lý hoặc được lọc ra.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {reviewQueueList.map((item) => (
                <Card key={item.id} className="border-amber-200/80 bg-white shadow-sm">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800 font-semibold">
                          Lớp {item.grade}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.type === "question" ? "Câu hỏi" : "Bài đọc"}
                        </Badge>
                        {renderStatusBadge(item.status)}
                      </div>
                      <span className="text-xs text-slate-500 break-words">{item.license}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-sky-950 mt-2 break-words">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-700 mt-1 line-clamp-2 break-words">
                      {item.content}
                    </CardDescription>
                  </CardHeader>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-100/50 bg-amber-50/20 p-4">
                    <span className="text-xs text-slate-600 break-words">Nguồn nạp: {item.author}</span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setSelectedReviewItem(item)}
                      className="min-h-[44px] min-w-[44px] h-auto whitespace-normal bg-sky-600 text-white hover:bg-sky-700 text-xs sm:text-sm font-medium"
                    >
                      <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Xem và duyệt (MOCK)
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedReviewItem} onOpenChange={(open) => !open && setSelectedReviewItem(null)}>
        <DialogContent className="max-w-2xl bg-white p-5 sm:p-6 text-slate-900 border-sky-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-sky-100 text-sky-800">
                Lớp {selectedReviewItem?.grade}
              </Badge>
              {selectedReviewItem && renderStatusBadge(selectedReviewItem.status)}
            </div>
            <DialogTitle className="text-lg font-bold text-sky-950 break-words">
              Xem và kiểm duyệt: {selectedReviewItem?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Yêu cầu bắt buộc: Chủ biên xem xét trực tiếp nội dung sư phạm, tính bản quyền và độ chính xác trước khi xuất bản.
            </DialogDescription>
          </DialogHeader>

          {selectedReviewItem && (
            <div className="space-y-4 my-2 text-sm">
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nội dung hiển thị
                </Label>
                <div className="mt-1 rounded-md border border-slate-200 bg-slate-50/60 p-3 leading-relaxed break-words text-slate-900">
                  {selectedReviewItem.content}
                </div>
              </div>

              {selectedReviewItem.options && (
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Phương án lựa chọn
                  </Label>
                  <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {selectedReviewItem.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border text-xs font-medium break-words ${
                          opt.startsWith(selectedReviewItem.answer?.charAt(0) || "")
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReviewItem.explanation && (
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Đáp án & Hướng dẫn giải chi tiết
                  </Label>
                  <div className="mt-1 p-3 rounded-md border border-sky-100 bg-sky-50 text-xs text-sky-950 leading-relaxed break-words">
                    <p className="font-semibold text-sky-900 mb-1">
                      Đáp án chính xác: {selectedReviewItem.answer}
                    </p>
                    <p>{selectedReviewItem.explanation}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 bg-slate-50 p-3 rounded-md border border-slate-200 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 block">Nguồn gốc / Bản quyền:</span>
                  <span className="text-slate-600 break-words">{selectedReviewItem.license}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block">Người phụ trách nạp:</span>
                  <span className="text-slate-600 break-words">{selectedReviewItem.author}</span>
                </div>
              </div>

              <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-900">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-sky-700 shrink-0" aria-hidden="true" />
                  Xác nhận quy trình:
                </p>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Bấm &apos;Duyệt mẫu (MOCK)&apos; sẽ cập nhật trạng thái mục này thành &apos;Đã xuất bản&apos; trên giao diện thử nghiệm hiện tại. Hệ thống không tự ý tải lên backend thực tế.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedReviewItem(null)}
              className="min-h-[44px] min-w-[44px] h-auto whitespace-normal border-slate-200 text-slate-700 hover:bg-slate-100 text-sm"
            >
              Đóng
            </Button>
            <Button
              type="button"
              onClick={() => selectedReviewItem && handleApproveMock(selectedReviewItem.id)}
              className="min-h-[44px] min-w-[44px] h-auto whitespace-normal bg-sky-600 text-white hover:bg-sky-700 text-sm font-medium"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Duyệt mẫu (MOCK)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
