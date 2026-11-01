import type { Question } from "../src/index";

type PoolItem = Pick<Question, "id" | "stem" | "passageId" | "difficulty" | "skill">;

/** Deterministic synthetic pool: 60 standalone grammar items + 12 reading items on 3 passages. */
export function makePool(): PoolItem[] {
  const pool: PoolItem[] = [];
  for (let i = 0; i < 60; i++) {
    pool.push({
      id: `g-${String(i).padStart(3, "0")}`,
      stem: `Grammar stem number ${i}`,
      difficulty: (i % 3) + 1,
      skill: "ngu-phap",
    });
  }
  for (let i = 0; i < 12; i++) {
    pool.push({
      id: `r-${String(i).padStart(3, "0")}`,
      stem: `Reading stem number ${i}`,
      passageId: `p-${i % 3}`,
      difficulty: (i % 3) + 1,
      skill: "doc-hieu",
    });
  }
  return pool;
}
