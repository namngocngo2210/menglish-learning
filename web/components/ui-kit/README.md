# Student UI structure

`index.tsx` exposes server-compatible, typed components. Existing exports and props remain supported:

- `PageShell({ title, children, hero? })`: skip link, shared responsive grade navigation, a single `SITE.wordmark` brand, main landmark, title band and footer. `PageShell` imports server-only footer content; client components must import `PassageBlock` directly from `./PassageBlock`, not this barrel. An optional server-rendered hero replaces the title band and must provide the page H1.
- `Breadcrumbs({ items })`: chevron separators, safe truncation, current-page semantics on the last item.
- `LinkCardList({ items, emptyMessage? })`: responsive linked cards with optional description and skill icon. `SKILL_DESCRIPTIONS` provides Vietnamese skill descriptions.
- `PassageBlock({ passage })`: readable English passage, word count and practice note.
- `QuestionBlock({ question, number })`: native fieldset and radio labels for static reuse; never renders answers or explanations.

The home page owns its editorial hero, numbered grade chooser and three-step guide. Grade, skill and topic pages retain their route/content loaders and static params. All pages remain server components. Theme colors come from `app/globals.css`; typography uses the existing local fonts. Interactive elements have visible focus outlines, touch targets of at least 44px and motion-safe transitions.

## Quiz boundary

`components/quiz/Quiz.tsx` is the only client component. It accepts questions containing `id`, `stem`, `options`, `correctKey` and `explanation`, optional `passages`, optional server-rendered `passageContent`, and `afterResult?: ReactNode`. The test page passes server-rendered passage blocks. Desktop uses a sticky reading column; mobile stacks the passage before questions.

The initial HTML includes all questions and native radios. It contains no rendered correct-answer indicators or explanations; those are mounted after checking or submitting. Answer data is supplied to the client for local scoring and is not secret or protected against inspection of serialized props. A noscript note explains that checking and results need JavaScript.

`state.ts` owns the pure reducer: checking requires an answer, checked answers are locked, submission locks all questions, and reset clears the attempt. Scoring uses `lib/scoring.ts`. Nothing is persisted or sent over the network. Submission focuses the result region; reset focuses the quiz heading. Results include per-question links and textual feedback with SVG icons.

## Advertising boundary

`components/ads/AdSlot.tsx` is a server component. Set `NEXT_PUBLIC_ADSENSE_CLIENT` and the matching optional `NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT`, `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR` or `NEXT_PUBLIC_ADSENSE_SLOT_FOOTER` to render an `ins.adsbygoogle` element. Without either the publisher or slot id, every environment uses a neutral, aria-hidden placeholder labelled “Vị trí quảng cáo”. Both reserve at least 120px of height. No AdSense script or ad request is loaded here.

A later script-loader task MUST set child-directed treatment (`tag_for_child_directed_treatment=1` / TFCD) and non-personalized ads (`npa=1`, no consent-based personalization) before requesting any ads. These settings are the loader's responsibility, not merely markup attributes.

Home places advertising between sections; grade/skill/topic pages place it at the bottom. The quiz receives its server-rendered ad through `afterResult`, which mounts only inside the completed result panel, outside the question grid. No ad appears between or beside questions while answering.

## Verification

Run `npm run lint`, `npm run typecheck`, and `npm test`. Tests cover reducer locks/reset and server rendering without visible answer disclosure. No additional dependencies are needed.
