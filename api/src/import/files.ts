import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ContentBundleSchema } from "@bj/core";
import type { ContentBundle } from "@bj/core";

export type Layer = "quarantine" | "published";

export interface LayerFile {
  layer: Layer;
  name: string;
  bundle: ContentBundle;
}

function readLayer(contentDir: string, directory: string, layer: Layer): LayerFile[] {
  const dir = join(contentDir, directory);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`${directory}/${file}: ${String(error)}`);
      }
      const parsed = ContentBundleSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        throw new Error(`${directory}/${file}: ${issues.slice(0, 5).join("; ")}`);
      }
      return { layer, name: `${directory}/${file}`, bundle: parsed.data };
    });
}

/**
 * Reads the frozen seed content: the quarantine layer first, the published layer second, so that
 * the published layer overrides the quarantine layer (blueprint §3.6 finding 2). Every file is
 * validated with the same zod schema the web app uses.
 */
export function readContentDir(contentDir: string): LayerFile[] {
  return [
    ...readLayer(contentDir, "quarantine", "quarantine"),
    ...readLayer(contentDir, "tests", "published"),
  ];
}
