# Content bundles

Each `tests/*.json` file is a ContentBundle fragment containing arrays named `sources`, `passages`, `topics`, `questions`, and `tests`. See `lib/content/types.ts` for the strict Zod contract (unknown fields are rejected) and `tests/grade-6.json` for an example. IDs are unique across files (topic identity is grade + skill + slug). References may cross files and are checked after merging. Tests use canonical four-segment route slugs, ordered question IDs, and ISO publication timestamps. MCQs have four unique A–D options and one correct key.

All checked-in sample content is original and synthetic, authored only to exercise the interface. It is not copied from a website, textbook, or exam, and is not for production. Sample source metadata and `[Mẫu]` titles must remain visible. English exercise text has Vietnamese explanations.

Lifecycle: quarantine → draft → in_review → published; rejected and archived are excluded too. Only published questions reach the public loader. A test with any unpublished question is hidden in full. Topics, passages and sources without public content are removed. Quarantine lives outside `tests/`; it is never loaded publicly. Production content requires source/license verification and owner review.

The future crawler implements ContentImporter in `lib/content/importer.ts`. Its host-controlled sink accepts quarantine-only questions, no tests, and must validate and write only to `content/quarantine/`. It cannot publish. This scaffold contains no crawler or write endpoint.

The Node-only loader caches successful loads by absolute directory per process. Restart/rebuild after editing JSON; ISR re-renders cached content once an hour. For tooling/tests, call `loadBundle(directory)` or set `QUESTION_CONTENT_DIR` to another bundle directory. Default JSON files are explicitly included in Next server tracing; an override directory must be available at runtime (for example, mounted by the host). Invalid data errors include filenames and question IDs when available.
