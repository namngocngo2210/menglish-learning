// Thin re-export: the implementation lives in packages/core (@bj/core).
export {
  GRADES, SKILLS, SKILL_NAMES, slugify, isSlug, gradeSlug, parseGradeSlug, parseSkill,
  homePath, gradePath, skillPath, topicPath, testPath, contactPath, aboutPath, privacyPath,
  parseTestSlug, ENTRANCE_PATH, entranceTestPath, officialEntranceSlug, parseEntranceSlug,
} from "@bj/core";
export type { Grade, Skill } from "@bj/core";

export const roomsLandingPath = () => "/luyen-tap-nhom";
export const roomsJoinPath = () => "/luyen-tap-nhom/vao";
/** Room shell URL; `code` must already be a normalized room code. */
export const roomPath = (code: string) => `/luyen-tap-nhom/phong/${code}`;
