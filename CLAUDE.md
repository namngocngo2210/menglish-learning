# menglish-learning

English practice site for Vietnamese students, grades 6-9. Phase 1: reading + grammar/vocab multiple choice. Public, no login. SEO is a hard requirement.

## Layout
- `web/` Next.js (App Router, TS, Tailwind, shadcn/ui, lucide-react). Static/SSG pages, content read at build time from `web/content`.
- `docs/` architecture, data-model, seo, security, ui-design, roadmap. `docs/previews/` is a design reference only.
- `docker-compose.yml` + `web/Dockerfile`: standalone image, non-root, port 3000, 512 MB / 1 CPU.

## Commands (run in `web/`)
- `npm ci`, `npm run dev`, `npm run build`
- `npm run lint`, `npm run typecheck`, `npm test`
- Lighthouse CI config: `web/lighthouserc.json` (SEO 100, Perf >= 90, A11y >= 95, BP >= 95).

## Conventions
- Vietnamese UI, `lang="vi"`, no-accent slugs, e.g. `/lop-6/ngu-phap/thi-hien-tai-don/de-1`.
- BeeJunior yellow/sky-blue/ink theme: CTA yellow #ffc001 with ink #291e1c text, primary blue #0a6590, surface #fffdf5 (see docs/brand.md). Be Vietnam Pro served locally, no CDN. Brand name constant: SITE.name.
- Touch targets >= 44px, visible focus, respect reduced motion.
- No AI-generated or copied question content. Sample tests are original and labelled. Crawled content only via the quarantine -> owner review -> publish flow (docs/content-sources.md).
- Ad slot: placeholder without AdSense id, non-personalized, never inside the question area while answering.

## SEO checklist (every PR)
- Metadata API: title, description, canonical, Open Graph per page.
- sitemap.xml and robots.txt generated from routes; no noindex in production.
- JSON-LD: BreadcrumbList everywhere, Quiz/LearningResource on tests, FAQPage where relevant.
- Semantic headings; internal links grade -> skill -> topic -> test.
- Core Web Vitals budget: LCP < 2.5s, CLS < 0.1, INP < 200ms.

## Workflow
- Branch from up-to-date origin default branch in a `../wt-<name>` worktree; one request = one branch = one PR.
- UI code: Claude writes the design brief, Codex implements. No Antigravity/Gemini.
- Never deploy or merge from a worker; no secrets in the repo.
