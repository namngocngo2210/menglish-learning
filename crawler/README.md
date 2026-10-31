# Question bank crawler

Standalone Node >=20 ESM TypeScript importer for MEnglish Learning. All exercise generation uses fixed rules, corpus statistics, regex and seeded permutations. No AI/LLM calls or generated source sentences. Output is quarantine only; it never creates tests or publishes content.

## Sources and permission

Only these sources are supported:

- **VOA Learning English** (`learningenglish.voanews.com`), US Government public domain. Articles dated from 2015 with explicit VOA identity are eligible. AP, Reuters, AFP, copyrighted/adapted/third-party material, unrecognized bylines and uncertain credits are skipped. The parser examines article/byline/credit/caption text. This intentionally rejects some legitimate VOA articles rather than guessing ownership. Source review remains mandatory.
- **Official Bộ/Sở GD&ĐT exam PDFs** on allowlisted hosts. `config/gov-hosts.json` allows `moet.gov.vn`, `*.gov.vn`, `hanoi.edu.vn`, `*.hanoi.edu.vn`, `hcm.edu.vn`, `*.hcm.edu.vn`. Add another verified Sở host explicitly; general `*.edu.vn` is not allowed. HTTPS only; redirects are refused. Host permission is necessary but does not establish that a particular document is an official paper: the developer must verify every seed and its answer key.

Forbidden: VnDoc, Hoc247, Loigiaihay, Tuyensinh247, Thuvienhoclieu, Study4, Langgo, Navi, Dethi, aggregators, textbooks, Cambridge, OUP and other publishers. The denylist takes precedence over the allowlist. No additional source adapters are supported.

## Commands

Run from the repository root:

```sh
cd crawler
npm ci
npm run crawl -- --source voa --limit 600
npm run build-bank -- --out ../web/content/quarantine
npm run report
```

`npm run build` aliases `build-bank`; it parses only local cache and never accesses the network. An empty cache produces eight empty fragments, one per source and grade. `npm run crawl -- --source gov` processes verified seeds only. `--refresh` is the only way to replace cached responses. `npm run typecheck` and `npm test` run offline. `report` prints Markdown from the last build; the build also writes `REPORT.md` and `../data/bank-report.json`. Crawl failures are saved in `../data/crawl-errors.json`; parsing failures and rejection reasons appear in the bank report. A crawl with per-URL errors exits unsuccessfully after processing the remaining URLs.

The 2,000-item target is **best effort**. Reports give actual retained counts, not estimates. Conservative parsing, unavailable keys, licensing uncertainty, duplicate text and weak distractor pools can reduce yield substantially.

## Official seeds

`config/gov-seeds.json` deliberately ships as `[]`. Add verified official URLs manually, for example this **shape only** (the example URL is not a verified downloadable document):

```json
[
  {
    "url": "https://moet.gov.vn/verified-official-exam.pdf",
    "year": 2025,
    "province": "Hà Nội",
    "grade": 9,
    "kind": "entrance10",
    "answerKeyUrl": "https://moet.gov.vn/verified-official-answer-key.pdf"
  }
]
```

The answer-key URL is optional only if the paper contains a labeled `ĐÁP ÁN` / `ANSWER KEY` section. No key means no imported question. Conflicting keys and repeated question numbers are discarded. Supported key text: `1. A 2. C` or `Câu 1: B`. Original wording and A–D order are preserved. Year, province, kind and question number are stored in `sourceRef`.

PDF extraction uses pdfjs-dist text items, preserving line breaks. The parser supports sequential `Question N.`, `Câu N:` and `N.` MCQs, pronunciation/stress sections, sentence transformations, closest-meaning items and reading passage sections. It attaches the current passage to its following reading questions. Complex columns, scanned/image-only PDFs, missing underlining or broken extraction require manual review; there is no OCR or invented reconstruction. Only explicitly keyed four-option items survive.

## Polite HTTP and replay

The transport fetches and parses robots.txt per host, selecting our UA group or `*`, with Disallow/Allow specificity and wildcard matching. A missing robots file (404) permits requests; other failures stop that host. Every network attempt, including robots and retries, uses a process-global per-host limiter (one start per second), 20-second timeout and at most two retries with exponential backoff. Concurrent CLI processes should not crawl the same host. The UA is:

```text
MEnglishLearningBot/0.1 (+https://github.com/namngocngo2210/menglish-learning)
```

Every raw response is cached at `../data/raw/<host>/<sha1(url)>.<ext>` with a neighboring `.meta.json` containing `url`, `fetchedAt`, `status`, `contentHash`. Binary-safe content hashes are SHA-1 of the response's base64 representation. Cached responses, including errors, are not refetched without `--refresh`; corrupt cache entries fail validation. Redirect responses are cached and refused, so no redirected host bypasses policy. Robots are checked before a cached article is returned, using the cached robots response. `crawl` discovers VOA through the root sitemap and dated/gzipped sitemaps, sorts newest last-modified dates first, then article IDs. `build-bank` does not fetch even robots.

Timestamps come from cached document metadata. Stable URL/reference ordering, normalized stem hashes, seeded PRNG and fixed JSON formatting make identical cache/configuration produce byte-identical bundles. IDs are `<source>-<8hex>` from normalized stem plus source reference. Duplicate normalized stems retain the first item by stable URL/reference order; passage IDs are included for cloze items so independent passage contexts are retained. Identical sentence exercises without passage context collapse across articles. Sources/passages are emitted once across fragments and may be referenced across files, matching the web content merge contract.

## Rules, classification and quality

`src/rules/` holds closed classes, over 150 explicit irregular verb records, a common regular-verb list and doubling rules, derivational families, grade grammar patterns, and Vietnamese topic names/keyword lists. Corpus frequencies come exclusively from cached eligible VOA body text; no external dictionaries or frequency services are used.

Readability score:

```text
0.8 × average word length
+ 0.12 × average sentence length in words
+ 4 × rare-word share
+ 0.8 × (highest matched grammar grade − 6)
+ 0.35 × VOA level, when present
```

A rare word has rank greater than `max(20, 60% of corpus vocabulary size)`; ranks sort by descending count then lexical order. Grade thresholds: `<5.3 → 6`, `<6.5 → 7`, `<7.7 → 8`, otherwise 9. A level hint initially bounds grades to 6–7 / 7–8 / 8–9; grammar patterns can raise the initial grade. Difficulty: `<5.8 → 1`, `<7.3 → 2`, otherwise 3. If more than 60% of retained VOA candidates fall in one grade, or a grade is absent, four score quantiles assign grades (at least four items needed), with source reference as deterministic tie breaker. This distribution adjustment may override initial grammar/level grade hints; official seed grades never change. Difficulty remains based on the score.

Builders:

- Reading: 80–400-word excerpts trimmed at paragraph boundaries, corpus content cloze and the article's own glossary definition matching (four distinct glossary words required).
- Grammar: verb forms only with clear auxiliary/to/modal signals; regular forms require a corpus-attested base; common regular base verbs use an explicit word list; fixed preposition constructions, explicit subject agreement and limited comparison patterns. Open article/modal/pronoun/conjunction slots are skipped when more than one alternative could fit. Closed-class lists are available for reviewed rule expansion.
- Vocabulary: coarse suffix/inflection categories; distractors share category, inflection and a frequency within a factor of two. Prefer glossary words. Derivational exercises require all four family members attested in the corpus and a syntactic signal. No generated pronunciation/stress items.
- Word order: simple 6–14-word corpus sentences with initial subject/auxiliary; three deterministic permutations disrupt that structure.

All emitted questions/passages require source URL/name/license/cached timestamp. Four unique case-insensitive A–D choices, one selected answer, valid grade/topic, short stems, complete passages, source evidence and duplicate guards are mandatory. Generated cloze items require exactly one `___`, exact reconstruction of the original sentence and no alternate substitution found in the corpus. Content-word distractor pools exclude words already in the sentence. Grammar alternatives follow their explicit rule and all cloze substitutions are checked against the corpus. Glossary, word-order and original official questions use their format-specific evidence, not an artificial blank. Official wording is authoritative and stays unchanged. Corpus absence is a mechanical filter, not proof of semantic exclusivity: content cloze/distractors and every official paper still require human review.

## Quarantine → owner review

The CLI sink accepts `web/content/quarantine` or its subdirectories only. Every fragment has `tests: []`; every question has `reviewStatus: "quarantine"`. Nothing is added to `web/content/tests` or pages. Review provenance, extracted text, passage association, pedagogical quality and the single correct answer before moving through draft → in_review → published by an owner action. Source metadata stays in data only. A credits page at `/nguon-du-lieu` will be generated later; this package adds no UI.
