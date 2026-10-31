import type { ContentBundle } from "../../lib/content/types";
import { GRADES, SKILL_NAMES } from "../../lib/routes";
import { TOPIC_REGISTRY } from "../../lib/topics/registry";
import { buildBank, classifyEligibleQuestions } from "./build-bank";
import { guardQuestions } from "./guards";

export type LegacyRedirect = { source: string; destination: string };
export function generateLegacyRedirects(legacyPaths: readonly string[], output: Record<string, ContentBundle>): LegacyRedirect[] {
 const bundles = Object.values(output);
 const paths = new Set([
  ...bundles.flatMap(b => b.topics.map(t => `/lop-${t.grade}/${t.skill}/${t.slug}`)),
  ...bundles.flatMap(b => b.tests.map(t => `/${t.slug}`)),
 ]);
 const redirects: LegacyRedirect[] = [];
 for (const source of [...new Set(legacyPaths)].sort()) {
  if (paths.has(source)) continue;
  const match = /^\/(lop-[6-9])\/(doc-hieu|ngu-phap|tu-vung|viet-cau)\/[a-z0-9-]+(?:\/de-[1-9][0-9]*)?$/.exec(source);
  if (!match) throw new Error(`Unsupported legacy route: ${source}`);
  const destination = `/${match[1]}/${match[2]}/tong-hop`;
  if (!paths.has(destination)) throw new Error(`Missing redirect destination ${destination} for ${source}`);
  redirects.push({ source, destination });
 }
 return redirects;
}

/** Counts all eligible questions after guards, including those omitted by test partitioning. */
export function generateClassificationReport(fragments: readonly ContentBundle[], output = buildBank(fragments)): string {
 const questions = guardQuestions(fragments.flatMap(f => f.questions).filter(q => q.reviewStatus === "quarantine")).questions;
 const entries = classifyEligibleQuestions(questions, fragments.flatMap(f => f.passages));
 const pageKeys = new Set(Object.values(output).flatMap(b => b.topics.map(t => `${t.grade}/${t.skill}/${t.slug}`)));
 const target = entries.filter(e => e.question.skill === "ngu-phap" || e.question.skill === "tu-vung");
 const lines = [
  "# Báo cáo phân loại chủ đề", "",
  "Báo cáo được sinh tự động bởi `npm run build:tests`; không sửa bằng tay.", "",
  "## Phương pháp", "",
  "Phân loại bằng luật cố định, không dùng LLM. Chạy sau bộ lọc chất lượng và trước khi chia đề; bỏ qua nhãn chủ đề của trình thu thập. Ngữ pháp dùng luật có thứ tự, luật đầu tiên khớp được chọn. Đọc hiểu và viết câu giữ nguyên nhãn.", "",
  "Từ vựng dùng từ điển chủ đề và dạng biến đổi thông dụng. Các gốc từ chồng lặp được gộp (ví dụ teach/teacher/teaching); mỗi gốc từ chỉ được tính một lần trong mỗi phần: câu dẫn ×1, các lựa chọn ×1, đáp án đúng ×3, tiêu đề bài đọc ×3 (tối đa 4 từ khóa), thân bài ×1 (tối đa 8 từ khóa mỗi chủ đề). Chọn chủ đề điểm cao nhất khi: tổng điểm từ 5 trở lên, hơn chủ đề thứ hai ít nhất 2 điểm, và chính câu hỏi (câu dẫn/lựa chọn) phải có bằng chứng (tối thiểu 2 điểm riêng, hoặc 1 điểm riêng kèm tổng từ 9). Bài đọc chỉ củng cố, không tự quyết định. Bài tập họ từ không được phân loại. Phần lớn câu từ vựng là điền từ phổ thông (động từ, giới từ…) không thuộc chủ đề nào nên tỷ lệ chưa phân loại cao; các câu này chỉ nằm ở Tổng hợp.", "",
  "Chỉ mở trang và đề chủ đề cụ thể khi có ít nhất 10 câu sau lọc và chia được đề tối thiểu 10 câu. Ô ghi số câu và có/không có trang. Câu chưa phân loại chỉ thuộc Tổng hợp; đề Tổng hợp vẫn lấy toàn bộ câu của kỹ năng. Số liệu gồm cả câu chưa được đưa vào đề do giới hạn nhóm bài đọc.", "",
  `Tổng sau lọc: **${questions.length} câu**, trong đó **${target.length} câu** ngữ pháp và từ vựng.`, "",
 ];
 for (const skill of ["ngu-phap", "tu-vung"] as const) {
  const items = entries.filter(e => e.question.skill === skill);
  lines.push(`## ${SKILL_NAMES[skill]}`, "", `Tổng: ${items.length} câu.`, "", "| Chủ đề | Lớp 6 | Lớp 7 | Lớp 8 | Lớp 9 |", "| --- | ---: | ---: | ---: | ---: |");
  for (const def of TOPIC_REGISTRY[skill]) {
   const cells = GRADES.map(grade => {
    const count = items.filter(e => e.question.grade === grade && e.classification.topic === def.slug).length;
    return `${count} (${pageKeys.has(`${grade}/${skill}/${def.slug}`) ? "có trang" : "không trang"})`;
   });
   lines.push(`| ${def.name} | ${cells.join(" | ")} |`);
  }
  lines.push("", "### Chưa phân loại", "", "| Phạm vi | Tổng câu | Chưa phân loại | Tỷ lệ |", "| --- | ---: | ---: | ---: |");
  for (const grade of [...GRADES, null]) {
   const subset = items.filter(e => grade === null || e.question.grade === grade);
   const count = subset.filter(e => e.classification.topic === null).length;
   lines.push(`| ${grade === null ? "Toàn bộ" : `Lớp ${grade}`} | ${subset.length} | ${count} | ${subset.length ? (100 * count / subset.length).toFixed(1) : "0.0"}% |`);
  }
  lines.push("", "### Luật được chọn", "", "| Luật | Số câu |", "| --- | ---: |");
  const rules = new Map<string, number>();
  items.forEach(e => rules.set(e.classification.rule, (rules.get(e.classification.rule) ?? 0) + 1));
  for (const rule of [...rules.keys()].sort()) lines.push(`| ${rule} | ${rules.get(rule)} |`);
  lines.push("");
 }
 return `${lines.join("\n")}\n`;
}
