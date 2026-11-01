export const GRADES = [6, 7, 8, 9] as const;
export type Grade = (typeof GRADES)[number];
export const SKILLS = ["doc-hieu", "ngu-phap", "tu-vung", "viet-cau"] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_NAMES: Record<Skill, string> = { "doc-hieu": "Đọc hiểu", "ngu-phap": "Ngữ pháp", "tu-vung": "Từ vựng", "viet-cau": "Viết câu" };
export function slugify(text: string): string {
 return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function isSlug(value: string): boolean { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value); }
function segment(value: string): string { if (!isSlug(value)) throw new Error(`Invalid route segment: ${value}`); return value; }
export function gradeSlug(grade: Grade): string { if (!GRADES.includes(grade)) throw new Error("Invalid grade"); return `lop-${grade}`; }
export function parseGradeSlug(value: string): Grade | null { return GRADES.find(g => gradeSlug(g) === value) ?? null; }
export function parseSkill(value: string): Skill | null { return SKILLS.find(s => s === value) ?? null; }
export const homePath = () => "/";
export const gradePath = (grade: Grade) => `/${gradeSlug(grade)}`;
export function skillPath(grade: Grade, skill: Skill): string { if (!parseSkill(skill)) throw new Error("Invalid skill"); return `${gradePath(grade)}/${skill}`; }
export const topicPath = (grade: Grade, skill: Skill, topic: string) => `${skillPath(grade, skill)}/${segment(topic)}`;
export const testPath = (grade: Grade, skill: Skill, topic: string, test: string) => `${topicPath(grade, skill, topic)}/${segment(test)}`;
export const contactPath = () => "/lien-he";
export const aboutPath = () => "/gioi-thieu";
export const privacyPath = () => "/chinh-sach-bao-mat";
export function parseTestSlug(slug: string): { grade: Grade; skill: Skill; topic: string; test: string } | null {
 const parts = slug.split("/");
 if (parts.length !== 4) return null;
 const [g, s, topic, test] = parts;
 const grade = parseGradeSlug(g); const skill = parseSkill(s);
 return grade && skill && isSlug(topic) && isSlug(test) ? { grade, skill, topic, test } : null;
}

export const ENTRANCE_PATH = "/thi-vao-lop-10";
export function entranceTestPath(k: number): string {
 if (!Number.isSafeInteger(k) || k < 1) throw new Error("Invalid entrance test number");
 return `${ENTRANCE_PATH}/de-${k}`;
}
/** Fixed official paper for one exam year, e.g. thi-vao-lop-10/de-chinh-thuc-2026 (no leading slash). */
export function officialEntranceSlug(year: string | number): string {
 if (!/^20[0-9]{2}$/.test(String(year))) throw new Error("Invalid exam year");
 return `thi-vao-lop-10/de-chinh-thuc-${year}`;
}
export function parseEntranceSlug(slug: string): { test: string } | null {
 const match = /^thi-vao-lop-10\/(de-[1-9][0-9]*|de-chinh-thuc-20[0-9]{2})$/.exec(slug);
 return match ? { test: match[1] } : null;
}
