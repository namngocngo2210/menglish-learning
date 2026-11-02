/** Hand-written SEO copy and data-derived FAQs. Pure functions of the content bundle (no dates, no randomness). */
import { getSkills, getTopics, getTestsForTopic, loadBundle } from "@/lib/content/load";
import { SKILL_NAMES, type Grade, type Skill } from "@/lib/routes";
import { getTopicDef } from "@/lib/topics/registry";

export type Faq = { question: string; answer: string };

export const SKILL_INTROS: Record<Skill, string> = {
 "doc-hieu": "Đọc bài ngắn, tìm ý chính, chi tiết và nghĩa của từ trong ngữ cảnh.",
 "ngu-phap": "Luyện chia thì, chọn dạng từ và dùng cấu trúc câu đúng; mỗi chủ đề có phần kiến thức cần nhớ và ví dụ.",
 "tu-vung": "Mở rộng vốn từ theo chủ đề quen thuộc, học nghĩa và cách dùng trong câu.",
 "viet-cau": "Luyện sắp xếp ý, chọn câu có nghĩa và diễn đạt rõ ràng.",
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
  { question: `Lớp ${grade} có bao nhiêu đề ${name}?`, answer: `Hiện có ${s.tests} đề ${name} lớp ${grade} với ${s.questions} câu hỏi${skill === "doc-hieu" ? ", chia thành đề dài (khoảng 20 câu) và đề ngắn (khoảng 10 câu)" : s.topics ? `, chia theo ${s.topics} chủ đề và các đề tổng hợp` : ""}.` },
  { question: `Nên bắt đầu luyện ${name} lớp ${grade} từ đâu?`, answer: skill === "doc-hieu" ? "Làm một đề ngắn để làm quen, rồi chuyển sang đề dài. Đọc bài một lần để nắm ý chung, sau đó quay lại đoạn liên quan trước khi chọn đáp án." : "Em chọn một chủ đề muốn ôn, đọc phần kiến thức (nếu có) rồi làm đề đầu tiên. Khi đã quen, em có thể làm đề tổng hợp để trộn nhiều dạng câu." },
  explanation,
 ];
}

export function buildTopicFaq(grade: Grade, skill: Skill, topicSlug: string, topicName: string, questionCount: number, testCount: number): Faq[] {
 const def = getTopicDef(skill, topicSlug);
 const faq: Faq[] = [
  { question: `${topicName} lớp ${grade} có bao nhiêu câu hỏi?`, answer: `Có ${questionCount} câu hỏi trong ${testCount} đề${skill === "doc-hieu" ? (topicSlug === "chung" ? ", mỗi đề khoảng 20 câu từ 2–4 bài đọc" : ", mỗi đề khoảng 10 câu") : ""}${testCount ? ". Em làm từng đề hoặc làm đề ngẫu nhiên" : ""}.` },
 ];
 if (def?.tips?.length) faq.push({ question: `Cần lưu ý gì khi làm bài ${topicName.toLowerCase()}?`, answer: def.tips.join(" ") });
 else faq.push({ question: `Em ôn ${topicName.toLowerCase()} như thế nào cho hiệu quả?`, answer: "Làm từng đề, bấm “Kiểm tra” sau mỗi câu để đọc giải thích, rồi làm lại các câu đã sai." });
 faq.push(explanation);
 return faq;
}

export const NOT_FOUND_LINKS = [
 { label: "Trang chủ", href: "/" },
 { label: "Tiếng Anh lớp 6", href: "/grade-6" },
 { label: "Tiếng Anh lớp 7", href: "/grade-7" },
 { label: "Tiếng Anh lớp 8", href: "/grade-8" },
 { label: "Tiếng Anh lớp 9", href: "/grade-9" },
 { label: "Ôn thi vào lớp 10", href: "/grade-10-entrance" },
];
