"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  Eye,
  FileText,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AdminEditorProps {
  onBack: () => void;
}

interface QuestionDraft {
  title: string;
  grade: string;
  skill: string;
  difficulty: string;
  passage: string;
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
  source: string;
  license: string;
}

const INITIAL_DRAFT: QuestionDraft = {
  title: "Đọc hiểu: Vườn cộng đồng xanh (Community Garden)",
  grade: "7",
  skill: "reading",
  difficulty: "medium",
  passage:
    "Community gardens in town offer fresh vegetables and a peaceful place for residents to connect with nature. Students from nearby schools often volunteer on weekends to plant flowers, water tomatoes, and learn about sustainable living.",
  stem: "According to the passage, why do students volunteer at the community garden on weekends?",
  optionA: "To sell fresh vegetables for commercial school funds",
  optionB: "To plant flowers, water plants, and study sustainable living",
  optionC: "To organize sports events for town residents",
  optionD: "To prepare meals for local city restaurants",
  correctAnswer: "B",
  explanation:
    "Đoạn văn có câu: 'Students from nearby schools often volunteer on weekends to plant flowers, water tomatoes, and learn about sustainable living.' Đáp án B phản ánh chính xác nội dung này.",
  source: "Tổ Ngữ liệu Khảo thí - Góc tiếng Anh (Tự biên soạn)",
  license: "CC BY-NC 4.0 (Phi thương mại, có ghi nhận tác giả)",
};

export default function AdminEditor({ onBack }: AdminEditorProps) {
  const [draft, setDraft] = useState<QuestionDraft>(INITIAL_DRAFT);
  const [status, setStatus] = useState<"draft" | "in_review">("draft");
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>({
    type: "info",
    title: "Chế độ mô phỏng quản trị (MOCK)",
    message:
      "Tất cả thao tác chỉ lưu cục bộ trong bộ nhớ trình duyệt, không gửi tới máy chủ thật.",
  });

  const handleFieldChange = (
    field: keyof QuestionDraft,
    value: string
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const validateDraft = (): string[] => {
    const errors: string[] = [];
    if (!draft.title.trim()) errors.push("Tiêu đề bài tập");
    if (!draft.passage.trim()) errors.push("Đoạn văn đọc hiểu");
    if (!draft.stem.trim()) errors.push("Câu hỏi (stem)");
    if (!draft.optionA.trim()) errors.push("Lựa chọn A");
    if (!draft.optionB.trim()) errors.push("Lựa chọn B");
    if (!draft.optionC.trim()) errors.push("Lựa chọn C");
    if (!draft.optionD.trim()) errors.push("Lựa chọn D");
    if (!draft.explanation.trim()) errors.push("Giải thích chi tiết");
    if (!draft.source.trim()) errors.push("Nguồn trích dẫn");
    if (!draft.license.trim()) errors.push("Giấy phép bản quyền");
    return errors;
  };

  const handleSaveDraft = () => {
    setFeedback({
      type: "success",
      title: "Lưu bản nháp thành công [MOCK]",
      message:
        "Bản nháp đã được cập nhật trong bộ nhớ phiên làm việc. Trạng thái giữ nguyên 'Bản nháp'.",
    });
  };

  const handleSendReview = () => {
    const errors = validateDraft();
    if (errors.length > 0) {
      setFeedback({
        type: "error",
        title: "Chưa đủ điều kiện gửi duyệt [MOCK]",
        message: `Vui lòng điền đầy đủ các mục bắt buộc: ${errors.join(", ")}.`,
      });
      return;
    }

    setStatus("in_review");
    setFeedback({
      type: "success",
      title: "Đã gửi kiểm duyệt [MOCK]",
      message:
        "Câu hỏi đã chuyển vào hàng đợi kiểm duyệt (Chờ duyệt). Không tự động công bố khi chưa có phê duyệt của quản trị viên.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 backdrop-blur-sm shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 sm:py-0 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="min-h-[44px] px-3.5 border-sky-200 text-sky-900 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg flex items-center gap-2 shrink-0"
              aria-label="Quay lại ngân hàng câu hỏi"
            >
              <ArrowLeft className="w-4 h-4 text-sky-700" aria-hidden="true" />
              <span className="hidden sm:inline font-medium">Ngân hàng</span>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                  Góc tiếng Anh
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 border-sky-300 text-sky-700 bg-sky-50 shrink-0"
                >
                  Tên tạm
                </Badge>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight break-words">
                Biên tập câu hỏi
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
            {status === "draft" ? (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 px-2.5 py-1 text-xs font-medium shrink-0"
              >
                Bản nháp (MOCK)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-sky-50 text-sky-800 border-sky-300 px-2.5 py-1 text-xs font-medium flex items-center gap-1 shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                Chờ duyệt (MOCK)
              </Badge>
            )}

            {/* Mobile View Toggle */}
            <div className="flex lg:hidden rounded-lg border border-sky-200 p-0.5 bg-sky-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md min-h-[44px] transition-colors ${
                  activeTab === "editor"
                    ? "bg-white text-sky-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={activeTab === "editor"}
              >
                Soạn thảo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md min-h-[44px] transition-colors ${
                  activeTab === "preview"
                    ? "bg-white text-sky-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={activeTab === "preview"}
              >
                Xem trước
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Status Notification */}
        {feedback && (
          <Alert
            role="status"
            aria-live="polite"
            className={`mb-6 border rounded-xl shadow-xs ${
              feedback.type === "success"
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                : feedback.type === "error"
                ? "bg-rose-50/80 border-rose-200 text-rose-950"
                : "bg-sky-50/80 border-sky-200 text-sky-950"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            ) : feedback.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-600" aria-hidden="true" />
            ) : (
              <FileText className="w-5 h-5 text-sky-600" aria-hidden="true" />
            )}
            <div className="ml-2">
              <AlertTitle className="font-semibold text-sm">
                {feedback.title}
              </AlertTitle>
              <AlertDescription className="text-xs sm:text-sm mt-0.5 opacity-90 break-words">
                {feedback.message}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Editor */}
          <div
            className={`lg:col-span-7 space-y-6 ${
              activeTab === "preview" ? "hidden lg:block" : "block"
            }`}
          >
            {/* Metadata Card */}
            <Card className="border-sky-100 shadow-xs bg-white rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  Thông tin phân loại & ngữ liệu
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Xác định khối lớp (6–9), kỹ năng học tập và văn bản đọc hiểu tiếng Anh.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="question-title" className="text-xs font-semibold text-slate-800">
                    Tiêu đề câu hỏi / bài đọc <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="question-title"
                    value={draft.title}
                    onChange={(e) => handleFieldChange("title", e.target.value)}
                    placeholder="Nhập tiêu đề nhận diện..."
                    className="min-h-[44px] border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="select-grade" className="text-xs font-semibold text-slate-800">
                      Khối lớp
                    </Label>
                    <Select
                      value={draft.grade}
                      onValueChange={(val) => handleFieldChange("grade", val)}
                    >
                      <SelectTrigger
                        id="select-grade"
                        className="min-h-[44px] border-slate-200 focus:ring-sky-500 text-sm"
                      >
                        <SelectValue placeholder="Chọn lớp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">Lớp 6 (Grade 6)</SelectItem>
                        <SelectItem value="7">Lớp 7 (Grade 7)</SelectItem>
                        <SelectItem value="8">Lớp 8 (Grade 8)</SelectItem>
                        <SelectItem value="9">Lớp 9 (Grade 9)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="select-skill" className="text-xs font-semibold text-slate-800">
                      Kỹ năng
                    </Label>
                    <Select
                      value={draft.skill}
                      onValueChange={(val) => handleFieldChange("skill", val)}
                    >
                      <SelectTrigger
                        id="select-skill"
                        className="min-h-[44px] border-slate-200 focus:ring-sky-500 text-sm"
                      >
                        <SelectValue placeholder="Kỹ năng" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reading">Đọc hiểu (Reading)</SelectItem>
                        <SelectItem value="grammar">Ngữ pháp (Grammar)</SelectItem>
                        <SelectItem value="writing">Viết (Writing)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="select-difficulty" className="text-xs font-semibold text-slate-800">
                      Độ khó
                    </Label>
                    <Select
                      value={draft.difficulty}
                      onValueChange={(val) => handleFieldChange("difficulty", val)}
                    >
                      <SelectTrigger
                        id="select-difficulty"
                        className="min-h-[44px] border-slate-200 focus:ring-sky-500 text-sm"
                      >
                        <SelectValue placeholder="Độ khó" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Nhận biết (Dễ)</SelectItem>
                        <SelectItem value="medium">Thông hiểu (Vừa)</SelectItem>
                        <SelectItem value="hard">Vận dụng (Khó)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reading-passage" className="text-xs font-semibold text-slate-800">
                    Đoạn văn đọc hiểu (Original Garden Passage) <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="reading-passage"
                    rows={4}
                    value={draft.passage}
                    onChange={(e) => handleFieldChange("passage", e.target.value)}
                    placeholder="Nội dung bài đọc tiếng Anh..."
                    className="border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg text-sm leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Stem & Options Card */}
            <Card className="border-sky-100 shadow-xs bg-white rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  Câu hỏi & 4 Phương án lựa chọn
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Soạn thảo câu hỏi trắc nghiệm khách quan với 4 lựa chọn A, B, C, D.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="question-stem" className="text-xs font-semibold text-slate-800">
                    Câu hỏi (Stem) <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="question-stem"
                    rows={2}
                    value={draft.stem}
                    onChange={(e) => handleFieldChange("stem", e.target.value)}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg text-sm"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  {(["A", "B", "C", "D"] as const).map((optKey) => {
                    const fieldName = `option${optKey}` as keyof QuestionDraft;
                    const isCorrect = draft.correctAnswer === optKey;
                    return (
                      <div
                        key={optKey}
                        className={`p-3 rounded-lg border transition-all ${
                          isCorrect
                            ? "border-sky-300 bg-sky-50/50"
                            : "border-slate-200 bg-slate-50/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Label
                            htmlFor={`opt-${optKey}`}
                            className="text-xs font-bold text-slate-800 flex items-center gap-2"
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                isCorrect
                                  ? "bg-sky-600 text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {optKey}
                            </span>
                            Lựa chọn {optKey} <span className="text-rose-500">*</span>
                          </Label>
                          {isCorrect && (
                            <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                              Đáp án đúng
                            </span>
                          )}
                        </div>
                        <Input
                          id={`opt-${optKey}`}
                          value={draft[fieldName]}
                          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                          placeholder={`Nội dung lựa chọn ${optKey}...`}
                          className="min-h-[44px] bg-white border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <Label
                    htmlFor="select-correct-answer"
                    className="text-xs font-semibold text-slate-800 block mb-1.5"
                  >
                    Chọn đáp án chính xác
                  </Label>
                  <Select
                    value={draft.correctAnswer}
                    onValueChange={(val: "A" | "B" | "C" | "D") =>
                      handleFieldChange("correctAnswer", val)
                    }
                  >
                    <SelectTrigger
                      id="select-correct-answer"
                      className="min-h-[44px] border-slate-200 focus:ring-sky-500 text-sm w-full sm:w-60"
                    >
                      <SelectValue placeholder="Chọn đáp án đúng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Đáp án A</SelectItem>
                      <SelectItem value="B">Đáp án B</SelectItem>
                      <SelectItem value="C">Đáp án C</SelectItem>
                      <SelectItem value="D">Đáp án D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Explanation & Attribution Card */}
            <Card className="border-sky-100 shadow-xs bg-white rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  Lời giải & Bản quyền ngữ liệu
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Cung cấp giải thích sư phạm rõ ràng và thông tin trích dẫn minh bạch.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="question-explanation" className="text-xs font-semibold text-slate-800">
                    Giải thích chi tiết (Pedagogical Explanation) <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="question-explanation"
                    rows={3}
                    value={draft.explanation}
                    onChange={(e) => handleFieldChange("explanation", e.target.value)}
                    placeholder="Giải thích lý do lựa chọn đáp án đúng..."
                    className="border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="source-attribution" className="text-xs font-semibold text-slate-800">
                      Nguồn trích dẫn (Attribution) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="source-attribution"
                      value={draft.source}
                      onChange={(e) => handleFieldChange("source", e.target.value)}
                      placeholder="VD: Nhóm biên soạn..."
                      className="min-h-[44px] border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="content-license" className="text-xs font-semibold text-slate-800">
                      Giấy phép (License) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="content-license"
                      value={draft.license}
                      onChange={(e) => handleFieldChange("license", e.target.value)}
                      placeholder="VD: CC BY-NC 4.0..."
                      className="min-h-[44px] border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 pb-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  className="min-h-[44px] border-sky-200 text-sky-900 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4 text-sky-700" aria-hidden="true" />
                  <span>[MOCK] Lưu bản nháp</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleSendReview}
                  className="min-h-[44px] bg-sky-600 hover:bg-sky-700 text-white font-medium focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg flex items-center gap-2 px-5"
                >
                  <Send className="w-4 h-4 text-white" aria-hidden="true" />
                  <span>[MOCK] Gửi thẩm định</span>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Right Panel: Live Student Preview Card */}
          <div
            className={`lg:col-span-5 sticky top-24 space-y-4 ${
              activeTab === "editor" ? "hidden lg:block" : "block"
            }`}
          >
            <Card className="border-sky-200 shadow-sm bg-white rounded-xl overflow-hidden">
              <CardHeader className="bg-sky-50/70 border-b border-sky-100 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-sky-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-sky-600" aria-hidden="true" />
                    Xem trước trực tiếp (Live Preview)
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-sky-200 text-sky-700 font-semibold"
                  >
                    Học sinh THCS (Lớp {draft.grade})
                  </Badge>
                </div>
                <CardTitle className="text-sm font-semibold text-slate-800 mt-1 break-words">
                  {draft.title || "(Chưa có tiêu đề)"}
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4 space-y-4 text-slate-800 text-sm">
                {/* Passage preview box */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Đoạn văn đọc hiểu
                  </div>
                  <p className="text-slate-800 text-xs sm:text-sm leading-relaxed italic break-words">
                    &ldquo;{draft.passage || "Nội dung đoạn văn sẽ xuất hiện tại đây..."}&rdquo;
                  </p>
                </div>

                {/* Question Stem */}
                <div>
                  <div className="text-xs font-bold text-sky-800 uppercase tracking-wide mb-1">
                    Câu hỏi
                  </div>
                  <p className="font-medium text-slate-900 text-sm sm:text-base leading-snug break-words">
                    {draft.stem || "(Chưa nhập nội dung câu hỏi)"}
                  </p>
                </div>

                {/* Choices list */}
                <div className="space-y-2">
                  {(["A", "B", "C", "D"] as const).map((choiceKey) => {
                    const choiceText = draft[`option${choiceKey}` as keyof QuestionDraft];
                    const isCorrect = draft.correctAnswer === choiceKey;
                    return (
                      <div
                        key={choiceKey}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs sm:text-sm ${
                          isCorrect
                            ? "bg-sky-50/80 border-sky-300 text-sky-950 font-medium"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            isCorrect
                              ? "bg-sky-600 text-white"
                              : "bg-slate-100 text-slate-700 border border-slate-300"
                          }`}
                        >
                          {choiceKey}
                        </span>
                        <span className="break-words flex-1 leading-relaxed">
                          {choiceText || `(Chưa có nội dung cho lựa chọn ${choiceKey})`}
                        </span>
                        {isCorrect && (
                          <span className="text-[10px] font-semibold text-sky-700 shrink-0 self-center uppercase">
                            Đáp án
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs">
                  <div className="font-semibold text-amber-900 mb-1 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                    Hướng dẫn giải (Hiển thị sau khi làm):
                  </div>
                  <p className="text-amber-950 leading-relaxed break-words">
                    {draft.explanation || "(Chưa có giải thích)"}
                  </p>
                </div>

                {/* Metadata & Attribution footer */}
                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span>
                      <strong className="text-slate-700">Kỹ năng:</strong>{" "}
                      {draft.skill === "reading"
                        ? "Đọc hiểu"
                        : draft.skill === "grammar"
                        ? "Ngữ pháp"
                        : "Viết"}
                    </span>
                    <span>
                      <strong className="text-slate-700">Mức độ:</strong>{" "}
                      {draft.difficulty === "easy"
                        ? "Nhận biết"
                        : draft.difficulty === "medium"
                        ? "Thông hiểu"
                        : "Vận dụng"}
                    </span>
                  </div>
                  <div className="break-words">
                    <strong className="text-slate-700">Nguồn:</strong>{" "}
                    {draft.source || "(Chưa ghi nhận nguồn)"}
                  </div>
                  <div className="break-words">
                    <strong className="text-slate-700">Bản quyền:</strong>{" "}
                    {draft.license || "(Chưa chọn giấy phép)"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-3 bg-sky-50/50 border border-sky-100 rounded-lg text-xs text-sky-800 text-center">
              Mô phỏng giao diện học tập Góc tiếng Anh (THCS Lớp 6–9). Không yêu cầu đăng nhập đối với học sinh.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
