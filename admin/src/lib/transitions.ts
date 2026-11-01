// Mirror of api/src/cms/transitions.ts (the server stays the authority; this only decides which buttons to show).
export const STATUSES = [
  "quarantine",
  "draft",
  "in_review",
  "published",
  "rejected",
  "archived",
] as const;
export type Status = (typeof STATUSES)[number];

export const TRANSITIONS: Readonly<Record<Status, readonly Status[]>> = {
  quarantine: ["draft", "rejected"],
  draft: ["in_review", "rejected", "archived"],
  in_review: ["published", "draft", "rejected"],
  published: ["archived", "in_review"],
  rejected: ["draft", "archived"],
  archived: ["draft"],
};

const TEST_STATUSES: readonly string[] = ["draft", "in_review", "published", "archived"];

export const allowed = (entity: "question" | "passage" | "test", from: string): Status[] =>
  ((TRANSITIONS as Record<string, readonly Status[] | undefined>)[from] ?? []).filter(
    (to) => entity !== "test" || TEST_STATUSES.includes(to),
  );

export const STATUS_LABEL: Record<Status, string> = {
  quarantine: "Cách ly",
  draft: "Nháp",
  in_review: "Chờ duyệt",
  published: "Đã đăng",
  rejected: "Từ chối",
  archived: "Lưu trữ",
};
export const label = (s: string): string =>
  (STATUS_LABEL as Record<string, string | undefined>)[s] ?? s;
/** Happy path shown as a stepper in the editor. */
export const PATH: readonly Status[] = ["quarantine", "draft", "in_review", "published"];
