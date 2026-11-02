import { describe, expect, it } from "vitest";
import * as r from "@/lib/routes";
describe("routes", () => {
 it("normalizes Vietnamese and punctuation", () => { expect(r.slugify("Đọc hiểu: Tiếng Việt!  ĐƯỜNG")).toBe("doc-hieu-tieng-viet-duong"); });
 it("parses only canonical grades", () => { for (const g of r.GRADES) expect(r.parseGradeSlug(r.gradeSlug(g))).toBe(g); for (const s of ["lop-5", "lop-06", "6", "lop-9/"]) expect(r.parseGradeSlug(s)).toBeNull(); });
 it("builds every path and round trips tests", () => {
 expect(r.homePath()).toBe("/"); expect(r.gradePath(6)).toBe("/grade-6"); expect(r.skillPath(6,"ngu-phap")).toBe("/grade-6/grammar");
 expect(r.topicPath(6,"ngu-phap","thi-hien-tai-don")).toBe("/grade-6/grammar/present-simple");
 const path = r.testPath(6,"ngu-phap","thi-hien-tai-don","de-1");
 expect(path).toBe("/grade-6/grammar/present-simple/test-1"); expect(r.parseTestSlug(r.publicPathToTestSlug(path)!)).toEqual({grade:6,skill:"ngu-phap",topic:"thi-hien-tai-don",test:"de-1"});
 expect(r.contactPath()).toBe("/contact"); expect(r.aboutPath()).toBe("/about"); expect(r.privacyPath()).toBe("/privacy-policy");
 expect(r.parseTestSlug("lop-6/no/topic/de-1")).toBeNull(); expect(r.parseSkill("viet-cau")).toBe("viet-cau"); expect(r.isSlug("../x")).toBe(false);
 expect(() => r.topicPath(6,"ngu-phap","../x")).toThrow();
 });
});

