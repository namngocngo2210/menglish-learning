import { isSlug } from "./slug";
import {
  gradeSegment,
  parseGradeSegment,
  skillSegment,
  parseSkillSegment,
  topicSegment,
  testSegment,
  testSlugToPath,
} from "./url-map";
export const GRADES = [6, 7, 8, 9] as const;
export type Grade = (typeof GRADES)[number];
export const SKILLS = ["doc-hieu", "ngu-phap", "tu-vung", "viet-cau"] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_NAMES: Record<Skill, string> = {
  "doc-hieu": "Đọc hiểu",
  "ngu-phap": "Ngữ pháp",
  "tu-vung": "Từ vựng",
  "viet-cau": "Viết câu",
};
function segment(value: string): string {
  if (!isSlug(value)) throw new Error(`Invalid route segment: ${value}`);
  return value;
}
/** URL segment of a grade, e.g. "grade-6". Skills/topics/tests keep internal ids; url-map.ts holds their URL form. */
export function gradeSlug(grade: Grade): string {
  if (!GRADES.includes(grade)) throw new Error("Invalid grade");
  return gradeSegment(grade);
}
export function parseGradeSlug(value: string): Grade | null {
  return GRADES.find((g) => g === parseGradeSegment(value)) ?? null;
}
/** Internal skill id -> itself when valid (not a URL parser; see parseSkillUrl). */
export function parseSkill(value: string): Skill | null {
  return SKILLS.find((s) => s === value) ?? null;
}
/** URL segment ("grammar") -> internal skill id ("ngu-phap"). */
export function parseSkillUrl(value: string): Skill | null {
  return parseSkillSegment(value);
}
export const homePath = () => "/";
export const gradePath = (grade: Grade) => `/${gradeSlug(grade)}`;
export function skillPath(grade: Grade, skill: Skill): string {
  if (!parseSkill(skill)) throw new Error("Invalid skill");
  return `${gradePath(grade)}/${skillSegment(skill)}`;
}
export const topicPath = (grade: Grade, skill: Skill, topic: string) =>
  `${skillPath(grade, skill)}/${topicSegment(skill, segment(topic))}`;
/** `test` is the internal test id ("de-1"). */
export const testPath = (grade: Grade, skill: Skill, topic: string, test: string) =>
  `${topicPath(grade, skill, topic)}/${testSegment(segment(test))}`;
/** Public page path of a content test slug (see parseTestSlug / parseEntranceSlug). */
export function testSlugPath(slug: string): string {
  const path = testSlugToPath(slug);
  if (path === null) throw new Error(`Invalid test slug: ${slug}`);
  return path;
}
export const contactPath = () => "/contact";
export const aboutPath = () => "/about";
export const privacyPath = () => "/privacy-policy";
/** Parses a content test slug (internal id, not a URL): lop-6/ngu-phap/<topic>/de-1. */
export function parseTestSlug(
  slug: string,
): { grade: Grade; skill: Skill; topic: string; test: string } | null {
  const parts = slug.split("/");
  if (parts.length !== 4) return null;
  const [g, s, topic, test] = parts;
  if (g === undefined || s === undefined || topic === undefined || test === undefined) return null;
  const grade = GRADES.find((n) => `lop-${n}` === g) ?? null;
  const skill = parseSkill(s);
  return grade && skill && isSlug(topic) && isSlug(test) ? { grade, skill, topic, test } : null;
}

export const ENTRANCE_PATH = "/grade-10-entrance";
export function entranceTestPath(k: number): string {
  return testSlugPath(entranceTestSlug(k));
}
/** Content slug of practice paper k, e.g. thi-vao-lop-10/de-3 (internal id, no leading slash). */
export function entranceTestSlug(k: number): string {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error("Invalid entrance test number");
  return `thi-vao-lop-10/de-${k}`;
}
/** Content slug of the official paper for one exam year, e.g. thi-vao-lop-10/de-chinh-thuc-2026. */
export function officialEntranceSlug(year: string | number): string {
  if (!/^20[0-9]{2}$/.test(String(year))) throw new Error("Invalid exam year");
  return `thi-vao-lop-10/de-chinh-thuc-${year}`;
}
export function parseEntranceSlug(slug: string): { test: string } | null {
  const match = /^thi-vao-lop-10\/(de-[1-9][0-9]*|de-chinh-thuc-20[0-9]{2})$/.exec(slug);
  const test = match?.[1];
  return test === undefined ? null : { test };
}
/** Content slug of a topic test from internal ids ("lop-6/ngu-phap/<topic>/de-1"); the inverse of parseTestSlug. */
export const testSlug = (grade: Grade, skill: Skill, topic: string, test: string) =>
  `lop-${grade}/${skill}/${segment(topic)}/${segment(test)}`;
