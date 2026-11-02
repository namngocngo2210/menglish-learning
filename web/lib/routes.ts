// Thin re-export: the implementation lives in packages/core (@bj/core).
export {
  GRADES, SKILLS, SKILL_NAMES, slugify, isSlug, gradeSlug, parseGradeSlug, parseSkill, parseSkillUrl,
  skillSegment, topicSegment, parseTopicSegment, parseTestSegment, testSegment, publicPathToTestSlug,
  homePath, gradePath, skillPath, topicPath, testPath, testSlugPath, contactPath, aboutPath, privacyPath,
  parseTestSlug, testSlug, ENTRANCE_PATH, entranceTestPath, entranceTestSlug, officialEntranceSlug, parseEntranceSlug,
} from "@bj/core";
export type { Grade, Skill } from "@bj/core";

export const roomsLandingPath = () => "/group-practice";
export const roomsJoinPath = () => "/group-practice/join";
/** Room shell URL; `code` must already be a normalized room code. */
export const roomPath = (code: string) => `/group-practice/room/${code}`;
export const quickPracticePath = () => "/quick-practice";
export const dataSourcesPath = () => "/data-sources";
