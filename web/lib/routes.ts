// Thin re-export: the implementation lives in packages/core (@bj/core).
export {
  GRADES, SKILLS, SKILL_NAMES, slugify, isSlug, gradeSlug, parseGradeSlug, parseSkill,
  homePath, gradePath, skillPath, topicPath, testPath, contactPath, aboutPath, privacyPath,
  parseTestSlug, ENTRANCE_PATH, entranceTestPath, officialEntranceSlug, parseEntranceSlug,
} from "@bj/core";
export type { Grade, Skill } from "@bj/core";
