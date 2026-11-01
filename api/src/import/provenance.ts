export interface Provenance {
  year: number;
  province: string;
  examKind: string;
  examCode: string;
  itemRef: string;
  method: string;
}

const SOURCE_REF = /^(\d{4}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+)$/;

/**
 * Parses the crawler `sourceRef` of an official exam item, e.g.
 * `2026 | Hà Nội | tuyen-sinh-10-chinh-thuc | Mã đề 001 | Question 22 | ocr-transcribed`.
 * Returns an empty object for refs of any other shape (VOA items carry no structured ref).
 */
export function parseSourceRef(ref: string | undefined): Provenance | Record<string, never> {
  if (ref === undefined) return {};
  const match = SOURCE_REF.exec(ref);
  if (!match) return {};
  const [, year, province, examKind, examCode, itemRef, method] = match;
  if (
    year === undefined ||
    province === undefined ||
    examKind === undefined ||
    examCode === undefined ||
    itemRef === undefined ||
    method === undefined
  ) {
    return {};
  }
  return {
    year: Number(year),
    province: province.trim(),
    examKind: examKind.trim(),
    examCode: examCode.trim().replace(/^Mã đề /, ""),
    itemRef: itemRef.trim(),
    method: method.trim(),
  };
}
