import type { ContentBundle, Question } from "./types";
/** Importers may write only quarantine bundles to content/quarantine/.
 * Publication is a separate owner-reviewed action; never write content/tests/.
 * The standalone crawler package follows this contract through its CLI sink.
 */
export interface ContentImporter {
 name: string;
 run(ctx: ImportContext): Promise<ImportResult>;
}
export type QuarantineBundle = Omit<ContentBundle, "questions" | "tests"> & {
 questions: (Omit<Question, "reviewStatus"> & { reviewStatus: "quarantine" })[];
 tests: [];
};
export interface ImportContext {
 /** Host-controlled sink validates schemas and enforces the quarantine directory/status. */
 writeQuarantineBundle(bundle: QuarantineBundle): Promise<void>;
}
export interface ImportResult { importedQuestions: number; errors: string[]; }
