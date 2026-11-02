import { describe, expect, it } from "vitest";
import {
  GRADES,
  SKILLS,
  STATIC_PATHS,
  SKILL_SEGMENTS,
  TOPIC_SEGMENTS,
  TOPIC_REGISTRY,
  isSlug,
  legacyToPublicPath,
  publicPathToTestSlug,
  parseTopicSegment,
  parseTestSegment,
  testSegment,
  testSlugPath,
  topicPath,
  testPath,
  gradePath,
  skillPath,
  parseSkillUrl,
  parseGradeSlug,
} from "../src/index";

describe("url map (generated from the tables)", () => {
  it("covers every registry topic and uses unique lowercase hyphenated English segments", () => {
    for (const skill of ["ngu-phap", "tu-vung"] as const)
      for (const t of TOPIC_REGISTRY[skill])
        expect(TOPIC_SEGMENTS[skill][t.slug], `${skill}/${t.slug}`).toBeTruthy();
    for (const skill of SKILLS) {
      const values = Object.values(TOPIC_SEGMENTS[skill]);
      expect(new Set(values).size).toBe(values.length);
      for (const [old, now] of Object.entries(TOPIC_SEGMENTS[skill])) {
        expect(isSlug(now)).toBe(true);
        expect(now).not.toBe(old);
      }
    }
    expect(new Set(Object.values(SKILL_SEGMENTS)).size).toBe(4);
  });

  it("maps every old page shape to exactly one new path and back", () => {
    for (const g of GRADES) {
      expect(legacyToPublicPath(`/lop-${g}`)).toBe(gradePath(g));
      for (const skill of SKILLS) {
        expect(legacyToPublicPath(`/lop-${g}/${skill}`)).toBe(skillPath(g, skill));
        for (const topic of Object.keys(TOPIC_SEGMENTS[skill])) {
          expect(legacyToPublicPath(`/lop-${g}/${skill}/${topic}`)).toBe(
            topicPath(g, skill, topic),
          );
          const path = legacyToPublicPath(`/lop-${g}/${skill}/${topic}/de-12`);
          expect(path).toBe(testPath(g, skill, topic, "de-12"));
          expect(path).toMatch(/^\/grade-[6-9]\/[a-z-]+\/[a-z-]+\/test-12$/);
          expect(publicPathToTestSlug(path!)).toBe(`lop-${g}/${skill}/${topic}/de-12`);
          expect(testSlugPath(`lop-${g}/${skill}/${topic}/de-12`)).toBe(path);
        }
      }
    }
    for (const [from, to] of Object.entries(STATIC_PATHS))
      expect(legacyToPublicPath(from)).toBe(to);
    expect(legacyToPublicPath("/thi-vao-lop-10/de-3")).toBe("/grade-10-entrance/test-3");
    expect(legacyToPublicPath("/thi-vao-lop-10/de-chinh-thuc-2026")).toBe(
      "/grade-10-entrance/official-2026",
    );
    expect(publicPathToTestSlug("/grade-10-entrance/official-2026")).toBe(
      "thi-vao-lop-10/de-chinh-thuc-2026",
    );
    expect(legacyToPublicPath("/luyen-tap-nhom/phong/ABCDEF")).toBe("/group-practice/room/ABCDEF");
    expect(legacyToPublicPath("/pool/lop-6/ngu-phap/tong-hop")).toBe("/pool/grade-6/grammar/mixed");
    expect(legacyToPublicPath("/pool/thi-vao-lop-10")).toBe("/pool/grade-10-entrance");
  });

  it("reading: chung = long-tests, tong-hop = short-tests", () => {
    expect(legacyToPublicPath("/lop-6/doc-hieu/chung/de-1")).toBe(
      "/grade-6/reading/long-tests/test-1",
    );
    expect(legacyToPublicPath("/lop-6/doc-hieu/tong-hop")).toBe("/grade-6/reading/short-tests");
  });

  it("does not redirect unknown or already-new paths", () => {
    for (const p of [
      "/lop-5",
      "/lop-6/khong-co",
      "/lop-6/ngu-phap/khong-co",
      "/lop-6/ngu-phap/chung",
      "/lop-6/ngu-phap/tong-hop/de-0",
      "/lop-6/ngu-phap/tong-hop/de-1/x",
      "/thi-vao-lop-10/khong-co",
      "/luyen-tap-nhom/phong",
      "/luyen-tap-nhom/phong/a/b",
      "/grade-6",
      "/about",
      "/",
      "/api/v1/x",
    ])
      expect(legacyToPublicPath(p), p).toBeNull();
  });

  it("new URLs reject the old Vietnamese segments (no duplicate content)", () => {
    expect(parseGradeSlug("lop-6")).toBeNull();
    expect(parseSkillUrl("ngu-phap")).toBeNull();
    expect(parseSkillUrl("grammar")).toBe("ngu-phap");
    expect(parseTopicSegment("ngu-phap", "thi-hien-tai-don")).toBeNull();
    expect(parseTopicSegment("ngu-phap", "present-simple")).toBe("thi-hien-tai-don");
    expect(parseTestSegment("de-1")).toBeNull();
    expect(parseTestSegment("test-01")).toBeNull();
    expect(parseTestSegment("test-7")).toBe("de-7");
    expect(testSegment("de-chinh-thuc-2025")).toBe("official-2025");
    expect(publicPathToTestSlug("/grade-6/grammar/present-simple/de-1")).toBeNull();
  });
});
