'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  BookOpen,
  Flag,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const PASSAGE_TITLE = 'The Community School Garden';
const PASSAGE_CONTENT = `Our middle school garden is a vibrant living classroom. Every Tuesday afternoon, students from grades six to nine gather to plant vegetables, weed soil, and study plant biology. We grow fresh lettuce, tomatoes, and aromatic herbs using natural compost made from school cafeteria scraps. Miss Elena, our biology teacher, explains how earthworms aerate the soil and help roots absorb moisture efficiently. Working together teaches us environmental responsibility and patience. At the end of every term, the harvest is proudly shared with our school cafeteria.`;

const QUESTIONS: Question[] = [
  {
    id: 1,
    question: 'When do students usually gather to work in the school garden?',
    options: [
      'Every Tuesday afternoon',
      'Every Monday morning',
      'Every weekend after class',
      'Only during summer holidays',
    ],
    correctIndex: 0,
    explanation:
      "Đoạn văn trích dẫn rõ ràng: 'Every Tuesday afternoon, students from grades six to nine gather to plant vegetables, weed soil, and study plant biology.'",
  },
  {
    id: 2,
    question: 'What is used to nourish the plants according to the passage?',
    options: [
      'Commercial chemical fertilizers',
      'Natural compost made from cafeteria scraps',
      'Tap water mixed with artificial minerals',
      'Imported rich soil from another town',
    ],
    correctIndex: 1,
    explanation:
      "Đoạn văn nêu cụ thể: 'We grow fresh lettuce, tomatoes, and aromatic herbs using natural compost made from school cafeteria scraps.'",
  },
  {
    id: 3,
    question: 'What happens to the harvest at the end of each term?',
    options: [
      'It is sold at the local weekend market',
      'It is taken home exclusively by the teachers',
      'It is proudly shared with the school cafeteria',
      'It is stored in the science lab for next year',
    ],
    correctIndex: 2,
    explanation:
      "Đoạn văn kết luận: 'At the end of every term, the harvest is proudly shared with our school cafeteria.'",
  },
];

interface StudentQuizProps {
  results: boolean;
  onSubmit: () => void;
  onRetry: () => void;
}

export default function StudentQuiz({ results, onSubmit, onRetry }: StudentQuizProps) {
  // In-memory quiz state preserved across views
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  // Local dialog states
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState<boolean>(false);
  const [reportQuestionId, setReportQuestionId] = useState<number | null>(null);
  const [reportFeedback, setReportFeedback] = useState<string>('');
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = QUESTIONS.length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleToggleFlag = (index: number) => {
    setFlagged((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setFlagged({});
    setReportNotice(null);
    onRetry();
  };

  const handleConfirmSubmit = () => {
    setIsSubmitDialogOpen(false);
    onSubmit();
  };

  const handleSendReport = () => {
    if (reportFeedback.trim()) {
      setReportNotice(`Đã ghi nhận góp ý câu hỏi #${reportQuestionId} (Bản thử nghiệm MOCK - không gửi mạng).`);
      setReportFeedback('');
      setReportQuestionId(null);
    }
  };

  // Results calculation
  const correctCount = QUESTIONS.reduce((acc, q, idx) => {
    return selectedAnswers[idx] === q.correctIndex ? acc + 1 : acc;
  }, 0);
  const scoreOutOfTen = ((correctCount / totalQuestions) * 10).toFixed(1);

  if (results) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Results Header Card */}
        <Card className="border-sky-200 bg-sky-50/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-sky-400 bg-white text-sky-800 text-xs font-semibold">
                  Góc tiếng Anh (Tên tạm)
                </Badge>
                <Badge className="bg-sky-600 text-white hover:bg-sky-700">Kết quả bài luyện đọc</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="min-h-[44px] h-auto border-sky-300 text-sky-800 hover:bg-sky-100 flex items-center gap-2 font-medium"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Làm lại từ đầu</span>
              </Button>
            </div>
            <CardTitle className="text-2xl font-bold text-sky-950 mt-2">Tổng kết điểm số & Đáp án chi tiết</CardTitle>
            <CardDescription className="text-sky-800 text-sm">
              Xem lại các câu trả lời của bạn cùng giải thích cụ thể được trích từ đoạn văn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-sky-200 text-center shadow-xs">
                <p className="text-xs uppercase tracking-wide text-sky-700 font-semibold">Số câu đúng</p>
                <p className="text-3xl font-extrabold text-sky-900 mt-1">
                  {correctCount} / {totalQuestions}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-sky-200 text-center shadow-xs">
                <p className="text-xs uppercase tracking-wide text-sky-700 font-semibold">Điểm quy đổi hệ 10</p>
                <p className="text-3xl font-extrabold text-sky-600 mt-1">{scoreOutOfTen} / 10</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-sky-200 text-center shadow-xs">
                <p className="text-xs uppercase tracking-wide text-sky-700 font-semibold">Tỷ lệ hoàn thành</p>
                <p className="text-3xl font-extrabold text-sky-800 mt-1">
                  {Math.round((correctCount / totalQuestions) * 100)}%
                </p>
              </div>
            </div>

            {reportNotice && (
              <Alert className="border-sky-300 bg-sky-100/80 text-sky-900">
                <CheckCircle2 className="w-5 h-5 text-sky-700" aria-hidden="true" />
                <AlertTitle className="font-semibold text-sm">Thông báo hệ thống thử nghiệm</AlertTitle>
                <AlertDescription className="text-xs mt-1 text-sky-800">{reportNotice}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Detailed Question Review */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-sky-950">Giải thích chi tiết từng câu hỏi</h3>
          {QUESTIONS.map((q, idx) => {
            const userAnswer = selectedAnswers[idx];
            const isCorrect = userAnswer === q.correctIndex;
            const isUnanswered = userAnswer === undefined;

            return (
              <Card key={q.id} className="border-sky-200 shadow-xs bg-white">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sky-900">Câu hỏi {idx + 1}</span>
                      {isUnanswered ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-xs">
                          Chưa trả lời
                        </Badge>
                      ) : isCorrect ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Đúng
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-600 text-white hover:bg-rose-700 text-xs flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Chưa đúng
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReportQuestionId(q.id)}
                      className="min-h-[44px] h-auto text-xs text-sky-700 hover:text-sky-900 hover:bg-sky-100/60"
                    >
                      Báo lỗi câu này (MOCK)
                    </Button>
                  </div>
                  <CardTitle className="text-base text-gray-900 font-semibold mt-1">{q.question}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-sm">
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIdx) => {
                      const isUserChoice = userAnswer === optIdx;
                      const isActualCorrect = q.correctIndex === optIdx;

                      let rowClass = 'p-2.5 rounded-md border text-sm ';
                      if (isActualCorrect) {
                        rowClass += 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium';
                      } else if (isUserChoice && !isCorrect) {
                        rowClass += 'bg-rose-50 border-rose-300 text-rose-950';
                      } else {
                        rowClass += 'bg-gray-50/50 border-gray-200 text-gray-700';
                      }

                      return (
                        <div key={optIdx} className={rowClass}>
                          <div className="flex items-center justify-between">
                            <span>
                              <strong className="mr-2">{String.fromCharCode(65 + optIdx)}.</strong>
                              {opt}
                            </span>
                            <div className="text-xs font-semibold">
                              {isActualCorrect && <span className="text-emerald-700">✓ Đáp án chuẩn</span>}
                              {isUserChoice && !isActualCorrect && (
                                <span className="text-rose-700">✗ Bạn đã chọn</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Alert className="border-sky-200 bg-sky-50 text-sky-950 mt-3">
                    <BookOpen className="w-4 h-4 text-sky-700" aria-hidden="true" />
                    <AlertTitle className="text-xs font-bold uppercase tracking-wider text-sky-800">
                      Căn cứ từ bài đọc
                    </AlertTitle>
                    <AlertDescription className="text-xs text-sky-900 mt-1 leading-relaxed">
                      {q.explanation}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Report Issue Dialog */}
        <Dialog open={reportQuestionId !== null} onOpenChange={(open) => !open && setReportQuestionId(null)}>
          <DialogContent className="max-w-md bg-white border-sky-200">
            <DialogHeader>
              <DialogTitle className="text-sky-950">Góp ý câu hỏi #{reportQuestionId}</DialogTitle>
              <DialogDescription className="text-gray-600 text-xs">
                Mô phỏng tính năng phản hồi nội dung. Phản hồi được ghi nhận trong bộ nhớ tạm mà không gửi qua mạng.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <label htmlFor="report-textarea" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nội dung cần xem lại:
              </label>
              <Textarea
                id="report-textarea"
                rows={3}
                placeholder="Ví dụ: Đoạn trích câu 2 chưa hiển thị rõ ràng hoặc lỗi chính tả..."
                value={reportFeedback}
                onChange={(e) => setReportFeedback(e.target.value)}
                className="w-full text-sm border-sky-200 focus-visible:ring-sky-500"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px] h-auto border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Hủy bỏ
                </Button>
              </DialogClose>
              <Button
                onClick={handleSendReport}
                disabled={!reportFeedback.trim()}
                className="min-h-[44px] h-auto bg-sky-600 hover:bg-sky-700 text-white"
              >
                Gửi phản hồi (MOCK)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Active Quiz View
  const currentQuestion = QUESTIONS[currentIndex];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-4 space-y-4">
      {/* Top Banner & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-sky-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800 text-xs font-semibold">
            Góc tiếng Anh (Tên tạm)
          </Badge>
          <span className="text-xs text-sky-700 font-medium hidden sm:inline">Lớp 6–9 • Đọc hiểu</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-sky-50 px-3 py-1 rounded-md border border-sky-200 text-sky-900 text-xs font-mono font-semibold">
            <Clock className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <span>DEMO 10:00</span>
          </div>
          <span className="text-xs text-gray-600 font-medium">
            Đã chọn: <strong className="text-sky-900">{answeredCount}/{totalQuestions}</strong>
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-sky-800 font-medium">
          <span>Tiến độ làm bài</span>
          <span>{progressPercent}% hoàn thành</span>
        </div>
        <Progress value={progressPercent} className="h-2.5 bg-sky-100 [&>div]:bg-sky-600" />
      </div>

      {/* Main Grid: Reading Passage Left (Desktop) / Questions Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Reading Passage */}
        <Card className="lg:col-span-6 border-sky-200 shadow-xs bg-white">
          <CardHeader className="pb-3 border-b border-sky-100 bg-sky-50/40">
            <div className="flex items-center gap-2 text-sky-800">
              <BookOpen className="w-5 h-5 text-sky-600" aria-hidden="true" />
              <CardTitle className="text-lg font-bold text-sky-950">{PASSAGE_TITLE}</CardTitle>
            </div>
            <CardDescription className="text-xs text-sky-700">
              Đọc kỹ đoạn văn ngắn dưới đây để trả lời các câu hỏi liên quan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="p-4 bg-sky-50/30 rounded-md border border-sky-100 text-gray-800 text-sm leading-relaxed whitespace-normal break-words font-sans">
              {PASSAGE_CONTENT}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Active Question */}
        <div className="lg:col-span-6 space-y-4">
          {/* Question Navigation Bar (Numbered 1-3) */}
          <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-sky-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-900 mr-1">Câu hỏi:</span>
              {QUESTIONS.map((_, qIdx) => {
                const isCurrent = currentIndex === qIdx;
                const isAnswered = selectedAnswers[qIdx] !== undefined;
                const isFlag = !!flagged[qIdx];

                return (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={() => setCurrentIndex(qIdx)}
                    className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-md font-bold text-sm transition-colors relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      isCurrent
                        ? 'bg-sky-600 text-white shadow-xs'
                        : isAnswered
                        ? 'bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label={`Đi tới câu ${qIdx + 1}${isAnswered ? ', đã trả lời' : ''}${isFlag ? ', đã đánh dấu' : ''}`}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    {qIdx + 1}
                    {isFlag && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleFlag(currentIndex)}
              className={`min-h-[44px] h-auto px-3 border text-xs font-semibold flex items-center gap-1.5 ${
                flagged[currentIndex]
                  ? 'bg-amber-50 border-amber-400 text-amber-900 hover:bg-amber-100'
                  : 'border-sky-300 text-sky-800 hover:bg-sky-50'
              }`}
            >
              <Flag className={`w-4 h-4 ${flagged[currentIndex] ? 'fill-amber-500 text-amber-600' : 'text-sky-600'}`} aria-hidden="true" />
              <span>{flagged[currentIndex] ? 'Đã ghim' : 'Đánh dấu'}</span>
            </Button>
          </div>

          {/* Active Question Box with Fieldset & Radios */}
          <Card className="border-sky-200 shadow-xs bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-xs text-sky-700">
                <span>Câu hỏi {currentIndex + 1} trên {totalQuestions}</span>
                {selectedAnswers[currentIndex] !== undefined ? (
                  <span className="text-emerald-700 font-medium">✓ Đã chọn đáp án</span>
                ) : (
                  <span className="text-gray-500">Chưa chọn đáp án</span>
                )}
              </div>
              <CardTitle className="text-base text-gray-900 font-semibold leading-snug mt-1">
                {currentQuestion.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <fieldset className="space-y-2.5">
                <legend className="sr-only">Các lựa chọn cho câu hỏi {currentIndex + 1}</legend>
                {currentQuestion.options.map((optionText, optIdx) => {
                  const isChecked = selectedAnswers[currentIndex] === optIdx;
                  const radioId = `q${currentIndex}-opt${optIdx}`;

                  return (
                    <label
                      key={optIdx}
                      htmlFor={radioId}
                      className={`min-h-[44px] flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-sm break-words ${
                        isChecked
                          ? 'bg-sky-50/90 border-sky-500 text-sky-950 font-medium ring-1 ring-sky-500'
                          : 'bg-white border-gray-200 text-gray-800 hover:bg-sky-50/40 hover:border-sky-200'
                      }`}
                    >
                      <input
                        type="radio"
                        id={radioId}
                        name={`question-${currentIndex}`}
                        checked={isChecked}
                        onChange={() => handleSelectOption(currentIndex, optIdx)}
                        className="w-4 h-4 text-sky-600 border-gray-300 focus:ring-sky-500"
                      />
                      <span className="font-semibold text-sky-800">{String.fromCharCode(65 + optIdx)}.</span>
                      <span className="flex-1 leading-snug">{optionText}</span>
                    </label>
                  );
                })}
              </fieldset>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sky-100 bg-sky-50/20">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="min-h-[44px] h-auto border-sky-200 text-sky-800 hover:bg-sky-100 disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" /> Câu trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === totalQuestions - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  className="min-h-[44px] h-auto border-sky-200 text-sky-800 hover:bg-sky-100 disabled:opacity-40"
                >
                  Câu tiếp
                </Button>
              </div>

              {/* Submit Confirmation Dialog */}
              <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="min-h-[44px] h-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5"
                  >
                    Nộp bài làm
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-white border-sky-200">
                  <DialogHeader>
                    <DialogTitle className="text-sky-950">Xác nhận nộp bài luyện tập</DialogTitle>
                    <DialogDescription className="text-gray-600 text-sm">
                      {answeredCount < totalQuestions ? (
                        <span className="text-amber-800 font-medium">
                          Bạn mới hoàn thành {answeredCount}/{totalQuestions} câu hỏi. Bạn có chắc chắn muốn nộp bài sớm không?
                        </span>
                      ) : (
                        <span>Bạn đã hoàn thành đủ {totalQuestions}/{totalQuestions} câu hỏi. Nhấn xác nhận để xem điểm và đáp án chi tiết.</span>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2 text-xs text-sky-800 bg-sky-50 p-2.5 rounded border border-sky-200">
                    <p className="font-semibold">Bản xem trước thiết kế (MOCK):</p>
                    <p>Toàn bộ điểm và lời giải thích sẽ được tổng hợp ngay tức thì trên giao diện.</p>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild>
                      <Button
                        variant="outline"
                        className="min-h-[44px] h-auto border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        Tiếp tục làm bài
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleConfirmSubmit}
                      className="min-h-[44px] h-auto bg-sky-600 hover:bg-sky-700 text-white"
                    >
                      Xác nhận nộp bài
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
