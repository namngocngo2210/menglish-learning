import type { Faq } from "@/lib/seo-content";

export const ROOMS_TITLE = "Luyện tập nhóm tiếng Anh";
export const ROOMS_DESCRIPTION = "Cùng bạn bè làm một đề tiếng Anh lớp 6–9 cùng lúc, xếp hạng khi nộp bài. Tạo phòng 1v1 hoặc cả lớp, miễn phí, không cần tài khoản.";
export const ROOMS_STEPS = [
 { title: "Tạo phòng", text: "Chọn đề có sẵn hoặc trộn câu theo lớp, kỹ năng và chủ đề." },
 { title: "Gửi mã hoặc đường dẫn", text: "Bạn bè nhập mã 6 ký tự hoặc mở đường dẫn, đặt tên hiển thị rồi vào phòng." },
 { title: "Chủ phòng bấm Bắt đầu", text: "Mọi người làm cùng một đề, cùng lúc; bảng xếp hạng hiện khi cả phòng nộp xong." },
] as const;
export const ROOMS_PRIVACY = [
 "Không cần tài khoản, không có chat giữa các bạn.",
 "Chỉ lưu tên hiển thị tạm thời trong phòng và đáp án đã chọn.",
 "Phòng tự xóa sau khi kết thúc; không ghi vào cơ sở dữ liệu.",
 "Không hiển thị đáp án hay điểm của bạn khác trong lúc làm bài.",
] as const;
export const ROOMS_FAQ: Faq[] = [
 { question: "Luyện tập nhóm hoạt động như thế nào?", answer: "Chủ phòng tạo phòng và gửi mã 6 ký tự hoặc đường dẫn cho các bạn. Khi đủ người, chủ phòng bấm Bắt đầu để cả phòng làm cùng một đề cùng lúc; kết quả xếp hạng hiện khi mọi người đã nộp bài." },
 { question: "Có mất phí hoặc cần tài khoản không?", answer: "Không. Luyện tập nhóm hoàn toàn miễn phí và không cần đăng ký tài khoản; chỉ cần đặt một tên hiển thị." },
 { question: "Một phòng có tối đa bao nhiêu người?", answer: "Phòng đấu đôi (1v1) có 2 người. Các phòng nhiều người có sức chứa 5, 10, 20, 30 hoặc tối đa 45 người, phù hợp để cả lớp cùng luyện." },
 { question: "Thông tin của học sinh có được bảo vệ không?", answer: "Hệ thống chỉ giữ tên hiển thị tạm thời và đáp án đã chọn trong bộ nhớ của phòng, không chat, không thu thập họ tên thật, email hay số điện thoại. Dữ liệu bị xóa khi phòng đóng." },
 { question: "Đáp án được hiển thị khi nào?", answer: "Trong lúc làm bài, không ai thấy đáp án đúng hay điểm của người khác. Khi cả phòng đã nộp, bạn xem bảng xếp hạng, đáp án và lời giải của chính mình." },
];
