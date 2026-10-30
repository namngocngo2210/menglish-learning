# Design v2 verification — latest orange/navy representative direction

## Current acceptance and status

Owner superseded sky-blue with the MEnglish orange/navy COLOR FAMILY, not its brand/logo. Owner also explicitly removed clickable-demo acceptance: static PNG designs only. Deliverables are home and single-owner admin, each1440px desktop/390px mobile. Other screens remain historical sky-blue source and are NOT polished into the latest direction pending owner aesthetic approval. No product implementation/deployment/merge.

## Authorship and provenance

- All custom visual/UI source and visual fixes: Gemini `gemini-3.8-flash-medium`, official `/home/menglish/.local/bin/agy`.
- Invocation: `agy --model gemini-3.8-flash-medium --mode plan --print-timeout 240s --json-schema <fixed-allowlist-schema.json> --output-format json -p <self-contained-brief>`; early large jobs had no print timeout.
- No filesystem tools used by Gemini; complete `SUCCESS` JSON/schema required. Dev mechanically materialized exact Gemini content, rejecting absolute/traversal/symlink paths; repair responses required unique exact old/new matches. No broad permission bypass.
- Early screens received inline UI UX Pro Max/ui-styling guidance. Boss later installed native independent UI UX Pro Max and verified slash expansion; latest warm home/admin/font-fix briefs begin `/ui-ux-pro-max`. Native expansion does not grant filesystem/terminal permissions.
- Real upstream primitives copied by `npx --yes shadcn@4.23.0 add button card tabs badge progress dialog sheet select table input dropdown-menu skeleton alert label textarea --yes`. Not hand-written shadcn lookalikes. Custom UI code by Gemini, reviewed by dev; no Codex UI substitute.
- Palette reference read-only: `menglish-main/tailwind.config.js`; no ERP UI source imported. Font package bundled locally with lockfile.

## Actual checks

- Final `npm run typecheck`: PASS.
- Final `NEXT_TELEMETRY_DISABLED=1 npm run build`: PASS, static export includes `/direction/`, `/direction/admin/`, historical root/partial routes and `/icon.svg`.
- `npm audit --audit-level=high`: PASS, zero vulnerabilities in128packages at the time checked.
- Chrome145 actual renders: latest home/admin at1440×1000 and390×844, four full-page PNGs. Zero page overflow, zero text/control clipping candidates, zero visible controls under44px, zero runtime/console/network errors or failed assets, zero external requests. Be Vietnam Pro computed and loaded on all four renders.
- Geometry excludes deliberately hidden skip links and content inside an explicit locally scrollable shadcn table container; not a WCAG audit or a pixel-quality approval. Latest direction has no clipping candidates even with those checks.
- Prior sky-blue cycle:24full-page captures (11screens plus review queue ×2 widths), source retained. Found/repaired editor/mobile tabs clipping and32–40px controls through Gemini. A favicon404 found during prior sweep was repaired before latest renders. Earlier two large generation jobs hung and were stopped (student ~25min, admin-content ~17min); no final usage for them is available. Smaller chunks then returned SUCCESS.
- Source evidence JSON: `evidence/warm-render-checks.json`, `evidence/gemini-usage.json`, `evidence/source-manifest.json`. Token totals count one final cumulative record per completed conversation; incomplete jobs excluded, so totals are not complete account usage/billing/quota.
- No full app suite or interaction certification: owner changed scope to static designs. Existing mock controls are not accepted production capabilities. No attempt to claim server-side auth, real crawl/mixer, publication or static-export security.

## Dependencies pinned/tested

Next16.4.3; React/React DOM19.3.1; Tailwind/@tailwindcss/postcss4.3.3; Lucide1.65.0; Be Vietnam Pro fontsource5.3.0; radix-ui1.8.1; cn0.5.1; class-variance-authority0.7.1; clsx2.1.1; tailwind-merge3.6.0; tw-animate-css1.4.0; PostCSS8.5.32; TypeScript5.9.3; @types/node22.19.7; @types/react19.2.14; @types/react-dom19.2.3. npm lockfile committed. Build tools may update their own generated TypeScript/AGENTS metadata.

## Security and limitations

Public students only are login-free. Real single-owner admin requires separate approval for server-side session/login, every-admin-API authorization, secure cookies/CSRF, validation/rate limits, publish/delete/crawl/config audit and SSRF-resistant source fetching. Ingestion quarantine/draft → owner review → publish, never autopublish. These are documented design gaps, not implemented guarantees. No backend/API/DB/production scaffolds/services/Docker/domain changes; no credentials stored. Screens are sample/design, brand undecided. Owner still must approve aesthetics. Preview server is loopback-only and stopped after capture. ZIP contains final static design PNGs and evidence, not a promised clickable demo.
