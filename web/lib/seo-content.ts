/** Hand-written SEO copy and data-derived FAQs. Pure functions of the content bundle (no dates, no randomness). */
import { getSkills, getTopics, getTestsForTopic, loadBundle } from "@/lib/content/load";
import { SKILL_NAMES, type Grade, type Skill } from "@/lib/routes";
import { getTopicDef } from "@/lib/topics/registry";

export type Faq = { question: string; answer: string };

export const SKILL_INTROS: Record<Skill, string> = {
 "doc-hieu": "Đọc hiểu giúp em làm quen với bài đọc ngắn, tìm ý chính, chi tiết và nghĩa của từ trong ngữ cảnh. Hãy đọc bài một lần để nắm ý chung, sau đó quay lại đoạn liên quan trước khi chọn đáp án.",
 "ngu-phap": "Ngữ pháp luyện cách chia thì, chọn dạng từ và dùng cấu trúc câu đúng. Mỗi chủ đề có phần kiến thức cần nhớ, ví dụ và các đề để em kiểm tra xem mình đã hiểu quy tắc chưa.",
 "tu-vung": "Từ vựng giúp em mở rộng vốn từ theo chủ đề quen thuộc như gia đình, trường học, ẩm thực hay du lịch. Em học nghĩa, cách dùng trong câu và làm bài chọn đáp án để ghi nhớ lâu hơn.",
 "viet-cau": "Viết câu luyện cách sắp xếp ý, chọn câu có nghĩa và diễn đạt rõ ràng. Em nên đọc cả câu trước khi chọn, rồi so sánh đáp án với phần giải thích sau khi kiểm tra.",
};

export function gradeStats(grade: Grade) {
 const bundle = loadBundle();
 const questions = bundle.questions.filter(q => q.grade === grade).length;
 const tests = bundle.tests.filter(t => t.grade === grade && t.kind !== "entrance10").length;
 const topics = bundle.topics.filter(t => t.grade === grade && t.slug !== "tong-hop").length;
 return { questions, tests, topics };
}

export function skillStats(grade: Grade, skill: Skill) {
 const topics = getTopics(grade, skill);
 const tests = topics.reduce((sum, t) => sum + getTestsForTopic(grade, skill, t.slug).length, 0);
 const questions = loadBundle().questions.filter(q => q.grade === grade && q.skill === skill).length;
 return { topics: topics.filter(t => t.slug !== "tong-hop").length, tests, questions };
}

const alwaysFree: Faq = { question: "Làm bài có cần đăng nhập không?", answer: "Không. Em có thể làm bài ngay mà không cần tạo tài khoản; kết quả gần nhất được lưu trên trình duyệt của em." };
const explanation: Faq = { question: "Em có xem được giải thích đáp án không?", answer: "Có. Sau khi bấm “Kiểm tra”, mỗi câu hiện đáp án đúng cùng phần giải thích bằng tiếng Việt." };

export function buildGradeFaq(grade: Grade): Faq[] {
 const s = gradeStats(grade);
 return [
  { question: `Tiếng Anh lớp ${grade} trên BeeJunior có những kỹ năng nào?`, answer: `Có ${getSkills(grade).length} kỹ năng: ${getSkills(grade).map(k => SKILL_NAMES[k].toLowerCase()).join(", ")}. Mỗi kỹ năng chia theo chủ đề để em chọn phần cần ôn.` },
  { question: `Lớp ${grade} hiện có bao nhiêu câu hỏi và đề luyện tập?`, answer: `Hiện có ${s.questions} câu hỏi trong ${s.tests} đề luyện tập, trải trên ${s.topics} chủ đề cụ thể và các đề tổng hợp.` },
  alwaysFree,
 ];
}

export function buildSkillFaq(grade: Grade, skill: Skill): Faq[] {
 const s = skillStats(grade, skill);
 const name = SKILL_NAMES[skill].toLowerCase();
 return [
  { question: `Lớp ${grade} có bao nhiêu đề ${name}?`, answer: `Hiện có ${s.tests} đề ${name} lớp ${grade} với ${s.questions} câu hỏi, chia theo ${s.topics} chủ đề và phần tổng hợp.` },
  { question: `Nên bắt đầu luyện ${name} lớp ${grade} từ đâu?`, answer: "Em chọn một chủ đề muốn ôn, đọc phần kiến thức (nếu có) rồi làm đề đầu tiên. Khi đã quen, em có thể làm phần tổng hợp để trộn nhiều dạng câu." },
  explanation,
 ];
}

export function buildTopicFaq(grade: Grade, skill: Skill, topicSlug: string, topicName: string, questionCount: number, testCount: number): Faq[] {
 const def = getTopicDef(skill, topicSlug);
 const faq: Faq[] = [
  { question: `${topicName} lớp ${grade} có bao nhiêu câu hỏi?`, answer: `Có ${questionCount} câu hỏi trong ${testCount} đề luyện tập${testCount ? ", em có thể làm từng đề hoặc làm bài trộn ngẫu nhiên" : ""}.` },
 ];
 if (def?.tips?.length) faq.push({ question: `Cần lưu ý gì khi làm bài ${topicName.toLowerCase()}?`, answer: def.tips.join(" ") });
 else faq.push({ question: `Em ôn ${topicName.toLowerCase()} như thế nào cho hiệu quả?`, answer: "Làm từng đề, bấm “Kiểm tra” sau mỗi câu để đọc giải thích, rồi làm lại các câu đã sai." });
 faq.push(explanation);
 return faq;
}

export const NOT_FOUND_LINKS = [
 { label: "Trang chủ", href: "/" },
 { label: "Tiếng Anh lớp 6", href: "/lop-6" },
 { label: "Tiếng Anh lớp 7", href: "/lop-7" },
 { label: "Tiếng Anh lớp 8", href: "/lop-8" },
 { label: "Tiếng Anh lớp 9", href: "/lop-9" },
 { label: "Ôn thi vào lớp 10", href: "/thi-vao-lop-10" },
];
