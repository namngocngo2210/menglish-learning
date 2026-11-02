/**
 * Single source of truth for public URLs (docs/url-map.md).
 *
 * Content, DB rows, the API and rooms keep their stable internal ids (skill "doc-hieu", topic
 * "thi-hien-tai-don", test slug "lop-6/ngu-phap/<topic>/de-1"). Only the URL segments are English;
 * this file translates both ways. `legacyToPublicPath` is also the 301 redirect map for every
 * URL that was ever public in Vietnamese: keep it forever.
 */
export const GRADE_NUMBERS = [6, 7, 8, 9] as const;

export const SKILL_SEGMENTS = {
  "doc-hieu": "reading",
  "ngu-phap": "grammar",
  "tu-vung": "vocabulary",
  "viet-cau": "sentence-writing",
} as const;
export type SkillId = keyof typeof SKILL_SEGMENTS;

const GRAMMAR_TOPICS = {
  "thi-hien-tai-don": "present-simple",
  "thi-hien-tai-tiep-dien": "present-continuous",
  "thi-qua-khu-don": "past-simple",
  "thi-qua-khu-tiep-dien": "past-continuous",
  "thi-tuong-lai-don": "future-simple",
  "thi-hien-tai-hoan-thanh": "present-perfect",
  "thi-qua-khu-hoan-thanh": "past-perfect",
  "dong-tu-khuyet-thieu": "modal-verbs",
  "dong-tu-nguyen-mau-co-to": "to-infinitive",
  "dong-tu-to-be": "verb-to-be",
  "so-sanh": "comparisons",
  "cau-dieu-kien": "conditionals",
  "cau-bi-dong": "passive-voice",
  "gioi-tu": "prepositions",
  "mao-tu": "articles",
  "tinh-tu-so-huu": "possessive-adjectives",
  "cau-hoi": "questions",
  "tong-hop": "mixed",
} as const;
const VOCAB_TOPICS = {
  "gia-dinh-ban-be": "family-and-friends",
  "truong-hoc": "school",
  "am-thuc": "food-and-drink",
  "du-lich": "travel",
  "moi-truong": "environment",
  "suc-khoe": "health",
  "khoa-hoc-cong-nghe": "science-and-technology",
  "the-thao": "sports",
  "cong-viec": "jobs",
  "dong-vat": "animals",
  "tong-hop": "mixed",
} as const;
/** Per skill, internal topic slug -> URL segment. Reading "chung" is the long set, "tong-hop" the short set. */
export const TOPIC_SEGMENTS: Record<SkillId, Readonly<Record<string, string>>> = {
  "doc-hieu": { chung: "long-tests", "tong-hop": "short-tests" },
  "ngu-phap": GRAMMAR_TOPICS,
  "tu-vung": VOCAB_TOPICS,
  "viet-cau": { "sap-xep-tu": "word-order", "tong-hop": "mixed" },
};

/** Old page path -> new page path (exact, no params). */
export const STATIC_PATHS = {
  "/luyen-nhanh": "/quick-practice",
  "/gioi-thieu": "/about",
  "/lien-he": "/contact",
  "/chinh-sach-bao-mat": "/privacy-policy",
  "/dieu-khoan": "/terms",
  "/nguon-du-lieu": "/data-sources",
  "/xoa-du-lieu": "/delete-data",
  "/dang-ky": "/sign-up",
  "/dang-nhap": "/log-in",
  "/dat-lai-mat-khau": "/reset-password",
  "/xac-minh-email": "/verify-email",
  "/tai-khoan": "/account",
  "/thi-vao-lop-10": "/grade-10-entrance",
  "/luyen-tap-nhom": "/group-practice",
  "/luyen-tap-nhom/vao": "/group-practice/join",
} as const;

const swap = (o: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const SKILL_BY_SEGMENT = swap(SKILL_SEGMENTS);
const TOPIC_BY_SEGMENT = Object.fromEntries(
  Object.entries(TOPIC_SEGMENTS).map(([s, m]) => [s, swap(m)]),
);

export const gradeSegment = (grade: number) => `grade-${grade}`;
export function parseGradeSegment(value: string): number | null {
  const m = /^grade-([6-9])$/.exec(value);
  return m ? Number(m[1]) : null;
}
export const skillSegment = (skill: SkillId): string => SKILL_SEGMENTS[skill];
export function parseSkillSegment(value: string): SkillId | null {
  const id = Object.hasOwn(SKILL_BY_SEGMENT, value) ? SKILL_BY_SEGMENT[value] : undefined;
  return (id as SkillId | undefined) ?? null;
}
/** Unmapped (newly created) topics keep their own slug; Vietnamese slugs that have an English segment are never valid URLs. */
export function topicSegment(skill: SkillId, topic: string): string {
  return TOPIC_SEGMENTS[skill][topic] ?? topic;
}
export function parseTopicSegment(skill: SkillId, segment: string): string | null {
  if (Object.hasOwn(TOPIC_SEGMENTS[skill], segment)) return null;
  const map = TOPIC_BY_SEGMENT[skill] ?? {};
  return Object.hasOwn(map, segment) ? (map[segment] ?? segment) : segment;
}
/** Internal test id ("de-3", "de-chinh-thuc-2026") <-> URL segment ("test-3", "official-2026"). */
export function testSegment(test: string): string {
  return test.replace(/^de-chinh-thuc-/, "official-").replace(/^de-(?=\d)/, "test-");
}
export function parseTestSegment(segment: string): string | null {
  const m = /^(?:test-([1-9][0-9]*)|official-(20[0-9]{2}))$/.exec(segment);
  return m ? (m[1] ? `de-${m[1]}` : `de-chinh-thuc-${m[2]}`) : null;
}

/** Content test slug ("lop-6/ngu-phap/<topic>/de-1", "thi-vao-lop-10/de-1") -> public path, or null. Unmapped topics keep their slug. */
export function testSlugToPath(slug: string): string | null {
  const m =
    /^lop-([6-9])\/(doc-hieu|ngu-phap|tu-vung|viet-cau)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(de-[1-9][0-9]*)$/.exec(
      slug,
    );
  if (m)
    return `/${gradeSegment(Number(m[1]))}/${SKILL_SEGMENTS[m[2] as SkillId]}/${topicSegment(m[2] as SkillId, m[3] ?? "")}/${testSegment(m[4] ?? "")}`;
  const e = /^thi-vao-lop-10\/(de-[1-9][0-9]*|de-chinh-thuc-20[0-9]{2})$/.exec(slug);
  return e ? `/grade-10-entrance/${testSegment(e[1] ?? "")}` : null;
}
/** Public path -> content test slug (no leading slash), or null when it is not a test page. */
export function publicPathToTestSlug(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  if (parts.length === 2 && first === "grade-10-entrance") {
    const test = parseTestSegment(parts[1] ?? "");
    return test ? `thi-vao-lop-10/${test}` : null;
  }
  const grade = parseGradeSegment(first);
  const skill = parseSkillSegment(parts[1] ?? "");
  if (parts.length !== 4 || !grade || !skill) return null;
  const topic = parseTopicSegment(skill, parts[2] ?? "");
  const test = parseTestSegment(parts[3] ?? "");
  return topic && test ? `lop-${grade}/${skill}/${topic}/${test}` : null;
}

/**
 * Old (Vietnamese) pathname -> new pathname, or null when it is not a known old URL.
 * `extra` holds older redirects (web/content/legacy-redirects.json) whose destinations are old paths.
 */
export function legacyToPublicPath(
  path: string,
  extra?: ReadonlyMap<string, string>,
): string | null {
  const direct = extra?.get(path);
  if (direct !== undefined) return legacyToPublicPath(direct);
  if (Object.hasOwn(STATIC_PATHS, path)) return STATIC_PATHS[path as keyof typeof STATIC_PATHS];
  const parts = path.split("/").slice(1);
  if (parts[0] === "pool") {
    const rest = legacyToPublicPath(`/${parts.slice(1).join("/")}`);
    return rest === null ? null : `/pool${rest}`;
  }
  if (parts[0] === "luyen-tap-nhom") {
    return parts.length === 3 && parts[1] === "phong" && /^[A-Za-z0-9]+$/.test(parts[2] ?? "")
      ? `/group-practice/room/${parts[2]}`
      : null;
  }
  if (parts[0] === "thi-vao-lop-10") {
    const m =
      parts.length === 2 ? /^de-(?:[1-9][0-9]*|chinh-thuc-20[0-9]{2})$/.exec(parts[1] ?? "") : null;
    return m ? `/grade-10-entrance/${testSegment(m[0])}` : null;
  }
  const g = /^lop-([6-9])$/.exec(parts[0] ?? "");
  if (!g) return null;
  const out = [gradeSegment(Number(g[1]))];
  if (parts.length > 1) {
    const skill = parts[1] as SkillId;
    if (!Object.hasOwn(SKILL_SEGMENTS, skill)) return null;
    out.push(SKILL_SEGMENTS[skill]);
    if (parts.length > 2) {
      const topic = TOPIC_SEGMENTS[skill][parts[2] ?? ""];
      if (!topic) return null;
      out.push(topic);
      if (parts.length > 3) {
        const test = /^de-[1-9][0-9]*$/.test(parts[3] ?? "") ? testSegment(parts[3] ?? "") : null;
        if (!test || parts.length > 4) return null;
        out.push(test);
      }
    }
  }
  return `/${out.join("/")}`;
}
