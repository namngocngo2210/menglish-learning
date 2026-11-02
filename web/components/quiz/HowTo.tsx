/** The single place that explains how a practice works (collapsed; text stays in the DOM). */
export function HowTo() {
 return <details className="shrink-0 open:basis-full"><summary className="flex min-h-11 pointer-fine:min-h-8 cursor-pointer items-center font-semibold text-primary">Cách làm</summary><p className="pb-2">Chọn đáp án → bấm “Kiểm tra” để xem giải thích từng câu (câu đã kiểm tra sẽ khóa) → “Nộp bài” để xem điểm. Không giới hạn thời gian; câu bỏ trống tính là chưa đúng.</p></details>;
}
