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

`app/` contains Vietnamese App Router server pages with SSG and hourly ISR. `lib/routes.ts` owns every path and slug; `lib/content/` owns Zod validation, publication filtering, references, caching, and the future importer contract. `lib/scoring.ts` is pure and is not wired into this static answer preview. `tests/` covers routes, scoring and content. `content/tests/` holds four original synthetic samples; see [content format](content/README.md).

`app/globals.css` defines orange/navy tokens: brand is decorative only, cta supports white button text, primary is for accent text, navy/navy-soft for text and structure, surface/warm/warm-2 for backgrounds. No default shadcn gray theme is loaded. Be Vietnam Pro is bundled locally in three unicode-range subsets and four weights through `next/font/local`; no font CDN is used.

The later UI task restyles [typed UI slots](components/ui-kit/README.md) and installs real upstream shadcn primitives into `components/ui/`. Pages keep content/routing responsibilities. The future importer writes quarantine through a host-controlled sink and requires separate owner review to publish. No crawler, admin, API, interactive quiz, or full SEO is implemented. Answers intentionally remain in server HTML for this static sample.

`SITE` in `lib/site-config.ts` is a placeholder brand. Set `NEXT_PUBLIC_SITE_URL` to override the default base URL. No deployment or Docker is needed for local verification.
