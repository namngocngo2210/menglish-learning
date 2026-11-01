import { describe, expect, it } from "vitest";
import { createRng, mixTest, partitionTests } from "../src/index";
import golden from "./golden-mixer.json" with { type: "json" };
import { makePool } from "./fixtures";

// tests/golden-mixer.json was generated from the ORIGINAL web/lib/mixer before it moved to core.

describe("mixer golden output", () => {
  it("returns the recorded test when mixTest uses the recorded seed", () => {
    const mixed = mixTest(makePool(), {
      seed: "golden/de-1",
      size: 10,
      difficultyMix: { 1: 0.4, 2: 0.4, 3: 0.2 },
    });
    expect(mixed).toEqual(golden.mixed);
  });

  it("returns the recorded partition when partitionTests uses the recorded prefix", () => {
    const parts = partitionTests(makePool(), { seedPrefix: "golden", size: 20, minSize: 10 });
    expect(parts.map((p) => ({ seed: p.seed, ids: p.questionIds, oo: p.optionOrder }))).toEqual(
      golden.parts,
    );
  });

  it("returns the recorded numbers when createRng uses the recorded seed", () => {
    const rng = createRng("abc");
    expect([rng(), rng(), rng()]).toEqual(golden.rng);
  });
});
