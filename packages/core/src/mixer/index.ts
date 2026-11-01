import type { OptionKey, Question } from "../schemas";
import { createRng, shuffle } from "./random";
export { createRng, shuffle } from "./random";
export type { Rng } from "./random";
type MixQuestion = Pick<Question, "id" | "stem" | "passageId" | "difficulty" | "skill">;
const keys: OptionKey[] = ["A", "B", "C", "D"];
export function applyOptionOrder<T extends Pick<Question, "options" | "correctKey">>(
  question: T,
  order: string,
): T {
  if (!/^(?!.*(.).*\1)[ABCD]{4}$/.test(order)) throw new Error("Invalid option permutation");
  const options = Array.from(order).map((original, i) => {
    const option = question.options.find((o) => o.key === original);
    if (!option) throw new Error(`Missing original option ${original}`);
    return { ...option, key: keys[i] };
  });
  return { ...question, options, correctKey: keys[order.indexOf(question.correctKey)] };
}
export interface MixOptions {
  seed: string;
  size: number;
  difficultyMix?: { 1?: number; 2?: number; 3?: number };
  excludeIds?: Set<string>;
  skillMix?: Partial<Record<Question["skill"], number>>;
}
export interface MixedTest {
  seed: string;
  questionIds: string[];
  optionOrder: Record<string, string>;
}
function positiveSize(size: number) {
  if (!Number.isInteger(size) || size < 1) throw new Error("Size must be a positive integer");
}
/** Normalize only the stem: the passage id remains part of the item's identity. */
function identity(q: MixQuestion) {
  return JSON.stringify([
    q.stem.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(),
    q.passageId ?? null,
  ]);
}
export function mixTest(pool: readonly MixQuestion[], opts: MixOptions): MixedTest {
  positiveSize(opts.size);
  const rng = createRng(opts.seed);
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const groups = new Map<string, MixQuestion[]>();
  for (const q of [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (opts.excludeIds?.has(q.id) || seenIds.has(q.id) || seenText.has(identity(q))) continue;
    seenIds.add(q.id);
    seenText.add(identity(q));
    const key = q.passageId ? `passage:${q.passageId}` : `question:${q.id}`;
    const group = groups.get(key) ?? [];
    group.push(q);
    groups.set(key, group);
  }
  const remaining = shuffle(
    [...groups.values()].map((group) => shuffle(group, rng).slice(0, 8)),
    rng,
  );
  const selected: MixQuestion[][] = [];
  // Weighted fair selection: pick the group with the largest average quota deficit.
  // Atomic passages take precedence over exact fractional quotas.
  const counts: Record<string, number> = {};
  const dimensions = [
    {
      prefix: "difficulty",
      weights: opts.difficultyMix,
      value: (q: MixQuestion) => String(q.difficulty),
    },
    { prefix: "skill", weights: opts.skillMix, value: (q: MixQuestion) => q.skill },
  ]
    .flatMap((d) => (d.weights ? [{ prefix: d.prefix, value: d.value, input: d.weights }] : []))
    .map((d) => {
      const available = new Set(remaining.flat().map(d.value));
      const weights = Object.entries(d.input).filter(
        ([key, weight]) => available.has(key) && Number.isFinite(weight) && weight > 0,
      );
      const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
      return {
        prefix: d.prefix,
        value: d.value,
        weights: new Map(weights.map(([key, weight]) => [key, weight / total])),
      };
    });
  let count = 0;
  while (remaining.length && count < opts.size) {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (!candidate) continue;
      let score = 0;
      for (const d of dimensions) {
        for (const q of candidate) {
          const value = d.value(q);
          const target = (d.weights.get(value) ?? 0) * opts.size;
          score += (target - (counts[`${d.prefix}:${value}`] ?? 0)) / candidate.length;
        }
      }
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    const [group] = remaining.splice(best, 1);
    if (!group) break;
    selected.push(group);
    count += group.length;
    for (const d of dimensions)
      for (const q of group) {
        const key = `${d.prefix}:${d.value(q)}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
  }
  const questions = shuffle(selected, rng).flat();
  return {
    seed: opts.seed,
    questionIds: questions.map((q) => q.id),
    optionOrder: Object.fromEntries(questions.map((q) => [q.id, shuffle(keys, rng).join("")])),
  };
}
export interface PartitionOptions extends Pick<MixOptions, "difficultyMix" | "skillMix"> {
  seedPrefix: string;
  size: number;
  minSize: number;
}
export function partitionTests(pool: readonly MixQuestion[], opts: PartitionOptions): MixedTest[] {
  positiveSize(opts.size);
  positiveSize(opts.minSize);
  if (opts.minSize > opts.size) throw new Error("minSize must not exceed size");
  const tests: MixedTest[] = [];
  const excludeIds = new Set<string>();
  const byId = new Map(pool.map((q) => [q.id, q]));
  for (;;) {
    const test = mixTest(pool, {
      ...opts,
      seed: `${opts.seedPrefix}/de-${tests.length + 1}`,
      excludeIds,
    });
    if (!test.questionIds.length) break;
    if (test.questionIds.length < opts.minSize) {
      const previous = tests.at(-1);
      if (previous && previous.questionIds.length + test.questionIds.length <= opts.size + 8) {
        const combined = [...previous.questionIds, ...test.questionIds].flatMap(
          (id) => byId.get(id) ?? [],
        );
        const merged = mixTest(combined, { ...opts, seed: previous.seed, size: combined.length });
        // A merge must not truncate a passage already present in the preceding test.
        if (merged.questionIds.length === combined.length) tests[tests.length - 1] = merged;
      }
      break;
    }
    tests.push(test);
    test.questionIds.forEach((id) => excludeIds.add(id));
  }
  return tests;
}
