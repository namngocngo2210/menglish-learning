export type Entity = "question" | "passage" | "test";

export const STATUSES = [
  "quarantine",
  "draft",
  "in_review",
  "published",
  "rejected",
  "archived",
] as const;
export type Status = (typeof STATUSES)[number];

/** Review state machine. `published` is reachable only from `in_review`. */
export const TRANSITIONS: Readonly<Record<Status, readonly Status[]>> = {
  quarantine: ["draft", "rejected"],
  draft: ["in_review", "rejected", "archived"],
  in_review: ["published", "draft", "rejected"],
  published: ["archived", "in_review"],
  rejected: ["draft", "archived"],
  archived: ["draft"],
};

/** Tests have no quarantine/rejected states (migration 0007). */
const TEST_STATUSES: readonly string[] = ["draft", "in_review", "published", "archived"];

export function canTransition(entity: Entity, from: string, to: string): boolean {
  const allowed = (TRANSITIONS as Record<string, readonly string[] | undefined>)[from];
  if (!allowed?.includes(to)) return false;
  return entity !== "test" || TEST_STATUSES.includes(to);
}
