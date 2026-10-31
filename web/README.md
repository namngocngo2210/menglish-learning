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

`app/globals.css` defines the BeeJunior theme from [the brand brief](../docs/brand.md): yellow CTA/brand with ink text, blue primary for links and focus, decorative sky blue, cream surface and warm backgrounds. Buttons and cards have friendly rounded corners and controls keep 44px touch targets. No default shadcn gray theme is loaded. Be Vietnam Pro is bundled locally in three unicode-range subsets and two weights (400 and 700) through `next/font/local`; no font CDN is used.

Pages keep content/routing responsibilities and reuse [typed UI slots](components/ui-kit/README.md). The importer writes quarantine through a host-controlled sink and requires owner review to publish. Quizzes score locally, so answer keys are present in client data; this is a practice site, not a secure exam service.

`SITE` in `lib/site-config.ts` defines the BeeJunior name, tagline and asset paths. Set `NEXT_PUBLIC_SITE_URL` to override the default base URL. No deployment or Docker is needed for local verification.

## SEO

Every public page has Vietnamese metadata, a canonical URL, Open Graph and Twitter large-image metadata, and breadcrumb JSON-LD. The home page also describes the BeeJunior WebSite and Organization with an absolute logo URL; test pages describe a free Vietnamese learning quiz. FAQ JSON-LD is available only for future visible FAQ content. JSON-LD serialization escapes script delimiters.

`/sitemap.xml` includes all public content routes and test publication dates. `/robots.txt` allows crawling and links to the sitemap by default. Both are generated statically during build.

Set `NEXT_PUBLIC_SITE_URL` to the production origin for absolute canonical, social, sitemap and JSON-LD URLs. `SEO_NOINDEX=true` is the only beta-only noindex switch: it disables metadata indexing and crawling and removes the sitemap reference from robots. Unset means indexable; it must stay unset in production. Rebuild after changing these environment variables.

### BeeJunior brand assets

`python3 scripts/generate-brand.py` generates the brand variants from the source logo using Pillow. The existing optimized files in `public/brand/` include the header lockup (displayed at 231×44), full logo, mascot and 1200×630 Open Graph image. See [the brand brief](../docs/brand.md) for the palette and contrast requirements.

Next.js serves `app/icon.png` (32×32), the multi-size `app/favicon.ico` (16/32/48) and the opaque `app/apple-icon.png` (180×180). The manifest uses separate 192/512 regular and maskable PNGs from `public/`. Its theme is yellow `#ffc001` and background cream `#fffdf5`. Open Graph and Twitter use `/brand/og-image.png`, with alt text "BeeJunior". Page titles follow `<page> | BeeJunior` through the root template.

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
