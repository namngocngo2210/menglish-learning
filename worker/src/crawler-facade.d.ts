// Typed facade for crawler/src/lib.ts (tsconfig paths maps "@crawler" here; vitest/esbuild alias it to the real file).
import type { Article, Bundle, Candidate } from "../../crawler/src/model";

export interface Meta {
  url: string;
  fetchedAt: string;
  status: number;
  contentHash: string;
}
export interface Cached {
  body: Buffer;
  meta: Meta;
}
export interface Corpus {
  readonly __corpus: never;
}
export interface GovSeed {
  url: string;
  year: number;
  province: string;
  grade: number;
  kind: string;
  answerKeyUrl?: string;
  pageUrl?: string;
}
export interface OcrExtraction {
  seed: { url: string };
}

export class HttpClient {
  constructor(
    root: string,
    refresh: boolean,
    allowed: (host: string) => boolean,
    fetcher: typeof fetch,
    gapMs?: number,
  );
  get(url: string): Promise<Cached>;
}
export function readCache(root: string, url: string): Promise<Cached | null>;
export const VOA_HOST: string;
export function articleUrl(url: string): boolean;
export function crawlVoa(
  client: HttpClient,
  limit: number,
  onError: (url: string, error: unknown) => void,
): Promise<void>;
export function parseVoa(html: string, url: string, crawledAt?: string): Article | null;
export function allowedGovUrl(url: string): boolean;
export function crawlGov(
  client: HttpClient,
  seeds: GovSeed[],
  onError: (url: string, error: unknown) => void,
): Promise<void>;
export function extractPdf(bytes: Uint8Array): Promise<string>;
export function hasTextLayer(text: string): boolean;
export function govItems(
  text: string,
  keyText: string,
  seed: GovSeed,
  crawledAt: string,
): Candidate[];
type Builder = (article: Article, corpus: Corpus) => Candidate[];
export const grammarItems: Builder;
export const readingItems: Builder;
export const vocabularyItems: Builder;
export const wordOrderItems: Builder;
export function corpusStats(texts: string[]): Corpus;
export function assemble(
  input: Candidate[],
  corpus: Corpus,
): { bundles: { filename: string; bundle: Bundle }[]; report: unknown };
export function validateExtraction(value: unknown): OcrExtraction;
export function ocrOutcome(ext: OcrExtraction): { candidates: Candidate[] };
