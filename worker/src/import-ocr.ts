import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { assemble, corpusStats, ocrOutcome, validateExtraction } from "@crawler";
import type pg from "pg";
import { persistBundles, type PersistResult } from "./persist";

/**
 * Loads the committed two-pass OCR transcriptions (crawler/ocr/*.json) and stores their agreed items
 * as quarantine rows. Same path as the crawler: nothing is ever published here, and a gov source must
 * already exist and be enabled (created by the owner in the CMS).
 */
export async function importOcr(
  pool: pg.Pool,
  dir: string,
): Promise<PersistResult & { files: number }> {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  const candidates = [];
  for (const name of names) {
    const ext = validateExtraction(JSON.parse(await readFile(join(dir, name), "utf8")));
    candidates.push(...ocrOutcome(ext).candidates);
  }
  const bank = assemble(candidates, corpusStats([]));
  const stored = await persistBundles(
    pool,
    bank.bundles.map((b) => b.bundle),
  );
  return { ...stored, files: names.length };
}
