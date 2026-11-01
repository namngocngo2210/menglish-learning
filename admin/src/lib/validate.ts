// Client-side mirror of api/src/cms/schemas.ts rules; the server remains the authority.
export interface QuestionForm {
  external_id: string;
  grade: string;
  skill: string;
  topic_id: string;
  difficulty: string;
  passage_id: string;
  stem: string;
  options: string[];
  correct_key: string;
  explanation: string;
  source_id: string;
  source_url: string;
  source_ref: string;
}
export const KEYS = ["A", "B", "C", "D"] as const;
const isUrl = (v: string): boolean => {
  try {
    return /^https?:$/.test(new URL(v).protocol);
  } catch {
    return false;
  }
};

export function validateQuestion(f: QuestionForm): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: keyof QuestionForm, v: string): void => {
    if (!v.trim()) e[k] = "Bắt buộc";
  };
  req("external_id", f.external_id);
  req("stem", f.stem);
  req("explanation", f.explanation);
  if (!/^\d+$/.test(f.topic_id)) e["topic_id"] = "Mã chủ đề là số";
  if (!/^\d+$/.test(f.source_id)) e["source_id"] = "Chọn nguồn";
  if (!["1", "2", "3"].includes(f.difficulty)) e["difficulty"] = "Độ khó 1–3";
  if (!isUrl(f.source_url)) e["source_url"] = "URL http(s) hợp lệ";
  if (f.passage_id && !/^\d+$/.test(f.passage_id)) e["passage_id"] = "Mã bài đọc là số";
  const texts = f.options.map((o) => o.trim());
  if (texts.some((t) => !t)) e["options"] = "Cần đủ 4 đáp án";
  else if (new Set(texts.map((t) => t.toLowerCase())).size !== 4)
    e["options"] = "4 đáp án phải khác nhau";
  if (!(KEYS as readonly string[]).includes(f.correct_key)) e["correct_key"] = "Chọn đáp án đúng";
  return e;
}

export interface PassageForm {
  external_id: string;
  source_id: string;
  title: string;
  body: string;
  word_count: string;
  level: string;
  source_url: string;
}
export function validatePassage(f: PassageForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.external_id.trim()) e["external_id"] = "Bắt buộc";
  if (!f.title.trim()) e["title"] = "Bắt buộc";
  if (!f.body.trim()) e["body"] = "Bắt buộc";
  if (!/^\d+$/.test(f.source_id)) e["source_id"] = "Chọn nguồn";
  if (!/^[1-9]\d*$/.test(f.word_count)) e["word_count"] = "Số từ > 0";
  if (!["1", "2", "3", "4", "5"].includes(f.level)) e["level"] = "Mức 1–5";
  if (f.source_url && !isUrl(f.source_url)) e["source_url"] = "URL http(s) hợp lệ";
  return e;
}
