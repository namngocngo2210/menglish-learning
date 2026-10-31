# Student web scaffold

Run from `web/` with Node >=20.9 (the provided environment uses Node 26):

```sh
export PATH=/home/menglish/.hermes/tools/node-26.12.1-linux-x64/bin:$PATH
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`app/` contains Vietnamese App Router server pages with SSG and hourly ISR. `lib/routes.ts` owns every path and slug; `lib/content/` owns Zod validation, publication filtering, references, caching, and the future importer contract. `lib/scoring.ts` powers interactive client quizzes. `tests/` covers routes, scoring, mixing, progress, rendering and content. `content/tests/` holds the published reviewed bank; see [content format](content/README.md).

`app/globals.css` defines orange/navy tokens: brand is decorative only, cta supports white button text, primary is for accent text, navy/navy-soft for text and structure, surface/warm/warm-2 for backgrounds. No default shadcn gray theme is loaded. Be Vietnam Pro is bundled locally in three unicode-range subsets and four weights through `next/font/local`; no font CDN is used.

Pages keep content/routing responsibilities and reuse [typed UI slots](components/ui-kit/README.md). The importer writes quarantine through a host-controlled sink and requires owner review to publish. Quizzes score locally, so answer keys are present in client data; this is a practice site, not a secure exam service.

`SITE` in `lib/site-config.ts` is a placeholder brand. Set `NEXT_PUBLIC_SITE_URL` to override the default base URL. No deployment or Docker is needed for local verification.

## SEO

Every public page has Vietnamese metadata, a canonical URL, Open Graph and Twitter summary metadata, and breadcrumb JSON-LD. The home page also describes the website; test pages describe a free Vietnamese learning quiz. FAQ JSON-LD is available only for future visible FAQ content. JSON-LD serialization escapes script delimiters.

`/sitemap.xml` includes all public content routes and test publication dates. `/robots.txt` allows crawling and links to the sitemap by default. Both are generated statically during build.

Set `NEXT_PUBLIC_SITE_URL` to the production origin for absolute canonical, social, sitemap and JSON-LD URLs. `SEO_NOINDEX=true` is the only beta-only noindex switch: it disables metadata indexing and crawling and removes the sitemap reference from robots. Unset means indexable; it must stay unset in production. Rebuild after changing these environment variables.

### Placeholder icons

`app/icon.svg` is the source for the navy/orange open-book placeholder mark (also used inline in `components/chrome/BrandMark.tsx`; keep them in sync). Regenerate the PNGs and multi-size PNG-in-ICO favicon from `web/` with `node scripts/generate-icons.mjs`. This uses `sharp`, already supplied by Next.js, with no additional dependency. The Apple icon is opaque; the 192/512 icons have maskable-safe padding.

Next.js metadata file conventions expose `app/manifest.ts` at `/manifest.webmanifest` and automatically link the favicon, SVG, Apple icon and manifest. Manifest names come from `SITE`; these assets do not establish a final brand.

### Optional AdSense configuration

Copy `.env.example` to configure public IDs (no secrets). `NEXT_PUBLIC_ADSENSE_CLIENT`
enables the async `lazyOnload` AdSense script. `NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT`,
`NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR`, and `NEXT_PUBLIC_ADSENSE_SLOT_FOOTER` select units.
Without a client or unit ID, slots render reserved 120px placeholders.
`NEXT_PUBLIC_ADSENSE_CHILD_DIRECTED` defaults to enabled; only the literal `false`
omits the script's `data-tag-for-child-directed-treatment="1"` attribute.
The queue sets `requestNonPersonalizedAds = 1` before script loading or unit requests.
List pages reserve ad space; quizzes request ads only after submission, outside
all question and passage areas, including random mode.

Random quizzes fetch static `/pool/…` JSON only on interaction and keep the URL
unchanged. Fixed quiz progress stays on the device under `ml:progress:v1`;
storage failures do not prevent practice. Published source credits are centralized
on `/nguon-du-lieu`.
