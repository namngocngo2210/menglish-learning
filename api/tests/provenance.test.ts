import { describe, expect, it } from "vitest";
import { parseSourceRef } from "../src/import/provenance";

describe("parseSourceRef", () => {
  it("splits an official exam reference into its parts when the six fields are present", () => {
    expect(
      parseSourceRef(
        "2026 | Hà Nội | tuyen-sinh-10-chinh-thuc | Mã đề 001 | Question 22 | ocr-transcribed",
      ),
    ).toEqual({
      year: 2026,
      province: "Hà Nội",
      examKind: "tuyen-sinh-10-chinh-thuc",
      examCode: "001",
      itemRef: "Question 22",
      method: "ocr-transcribed",
    });
  });

  it("returns an empty object when the reference has another shape or is absent", () => {
    expect(parseSourceRef(undefined)).toEqual({});
    expect(parseSourceRef("VOA Learning English article 123")).toEqual({});
    expect(parseSourceRef("2026 | Hà Nội | only three | fields")).toEqual({});
  });
});
