import { describe, expect, it } from "vitest";
import { isSlug, slugify } from "../src/index";

describe("slugify", () => {
  it("removes Vietnamese diacritics and maps đ to d", () => {
    expect(slugify("Thì hiện tại đơn")).toBe("thi-hien-tai-don");
    expect(slugify("ĐƯỜNG Đi")).toBe("duong-di");
  });

  it("collapses punctuation and trims separators", () => {
    expect(slugify("  --Đọc hiểu: Tiếng Việt!!  ")).toBe("doc-hieu-tieng-viet");
  });

  it("returns an empty string when nothing slug-safe remains", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("is idempotent when applied to its own output", () => {
    const once = slugify("Câu điều kiện (loại 1)");
    expect(slugify(once)).toBe(once);
  });
});

describe("isSlug", () => {
  it("accepts ASCII kebab-case", () => {
    expect(isSlug("thi-hien-tai-don")).toBe(true);
    expect(isSlug("de-1")).toBe(true);
  });

  it.each(["", "-a", "a-", "a--b", "A-b", "a_b", "../x", "a/b", "đ"])(
    "rejects %j when it is not canonical",
    (value) => {
      expect(isSlug(value)).toBe(false);
    },
  );
});
