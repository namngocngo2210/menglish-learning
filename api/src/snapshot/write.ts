import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentBundle } from "@bj/core";

export interface SnapshotManifest {
  generatedAt: string;
  sha256: string;
  counts: { sources: number; passages: number; topics: number; questions: number; tests: number };
}

/** Writes `bundle.json` (a ContentBundle) and `manifest.json` into `outDir`. */
export function writeSnapshot(
  outDir: string,
  bundle: ContentBundle,
  now: Date = new Date(),
): SnapshotManifest {
  mkdirSync(outDir, { recursive: true });
  const body = `${JSON.stringify(bundle, null, 1)}\n`;
  const manifest: SnapshotManifest = {
    generatedAt: now.toISOString(),
    sha256: createHash("sha256").update(body).digest("hex"),
    counts: {
      sources: bundle.sources.length,
      passages: bundle.passages.length,
      topics: bundle.topics.length,
      questions: bundle.questions.length,
      tests: bundle.tests.length,
    },
  };
  writeFileSync(join(outDir, "bundle.json"), body);
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
