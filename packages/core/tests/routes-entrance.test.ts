import { describe, expect, it } from "vitest";
import {
  ENTRANCE_PATH,
  entranceTestPath,
  gradeSlug,
  officialEntranceSlug,
  parseEntranceSlug,
  parseTestSlug,
  topicOrder,
} from "../src/index";

describe("entrance routes", () => {
  it("builds numbered entrance paths when the number is a positive safe integer", () => {
    expect(entranceTestPath(3)).toBe(`${ENTRANCE_PATH}/test-3`);
    expect(() => entranceTestPath(0)).toThrow();
    expect(() => entranceTestPath(1.5)).toThrow();
  });

  it("builds official slugs when the year looks like 20xx", () => {
    expect(officialEntranceSlug(2026)).toBe("thi-vao-lop-10/de-chinh-thuc-2026");
    expect(() => officialEntranceSlug("1999")).toThrow();
  });

  it("parses only the two canonical entrance slug shapes", () => {
    expect(parseEntranceSlug("thi-vao-lop-10/de-12")).toEqual({ test: "de-12" });
    expect(parseEntranceSlug("thi-vao-lop-10/de-chinh-thuc-2025")).toEqual({
      test: "de-chinh-thuc-2025",
    });
    expect(parseEntranceSlug("thi-vao-lop-10/de-0")).toBeNull();
    expect(parseEntranceSlug("thi-vao-lop-10/de-1/x")).toBeNull();
  });
});

describe("route guards", () => {
  it("rejects invalid grades and malformed test slugs", () => {
    // @ts-expect-error -- deliberately outside the Grade union
    expect(() => gradeSlug(5)).toThrow();
    expect(parseTestSlug("lop-6/ngu-phap/x")).toBeNull();
    expect(parseTestSlug("lop-6/ngu-phap/Bad Topic/de-1")).toBeNull();
  });
});

describe("topicOrder", () => {
  it("orders known topics by registry position and unknown topics last", () => {
    expect(topicOrder("ngu-phap", "thi-hien-tai-don")).toBe(0);
    expect(topicOrder("ngu-phap", "does-not-exist")).toBeGreaterThan(
      topicOrder("ngu-phap", "thi-hien-tai-tiep-dien"),
    );
    expect(topicOrder("doc-hieu", "anything")).toBe(0);
    expect(topicOrder("ngu-phap", "tong-hop")).toBe(Number.MAX_SAFE_INTEGER);
  });
});
