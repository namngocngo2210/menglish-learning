# UI v2 Preview Plan

> DESIGN/PREVIEW ONLY. Owner-approved execution: Gemini through official Antigravity; same PR #2.

**Goal:** Runnable student and single-owner admin design preview for aesthetic approval, not production implementation.
**Architecture:** Isolated static-export Next.js fixture under `docs/previews/sky-blue-v2/`. Upstream shadcn primitives, Gemini-authored custom components, memory-only sample state. No service integration.
**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Lucide.
**Spec:** Kanban `t_4586c1e5` and `docs/ui-design.md`.

## Global constraints
- Reuse `docs/ui-sky-blue-design`, PR #2; never merge/deploy.
- No production scaffolds/auth/backend/schema/Docker/domain changes.
- All custom UI and visual fixes by `gemini-3.8-flash-medium` through `agy`.
- Validate complete SUCCESS/schema output before exact safe materialization; no symlink/traversal/absolute destinations.
- Sky-blue/white; public students, one-owner MOCK admin; no tracking/storage/network actions.

## File boundaries and verification
1. Foundation: package/lock/config, app layout/CSS; copy real upstream primitives via pinned shadcn CLI. Check npm resolution/audit.
2. `components/student-views.tsx`: `StudentView = home | browser | quiz | results`, `view/onNavigate`; original sample questions, actual local results. Check navigation, search empty, choices, submit dialog, reset/report.
3. `components/admin-content.tsx`: bank/editor, `view/onNavigate`; bank/review tabs, local validated draft editor/preview. Check draft validation, preview, manual mock review.
4. `components/admin-operations.tsx`: overview/sources/tests/reports; callbacks to shell; all metrics DEMO. Check source mock job/failure, preset dialog, report resolution.
5. `components/preview-app.tsx`: hash-driven shell/navigation, mobile Sheet, credential-free MOCK login, edge states. Check Tab/Escape/focus return, all views at 390/1440.
6. Docs security/architecture/data-model: clarify public-only no-login, future server-side owner auth/API authorization, SSRF and quarantine/manual publication boundary. No implementation.
7. Build/typecheck, render screenshots and automated interaction/errors/assets/overflow checks, static ZIP. Stop local-only owned server, commit/push same branch, release existing tester child.

## Review focus
- Long Vietnamese labels and small viewport: no page overflow or clipped controls.
- Every control operable with keyboard, dialog focus trapped/returned, Sheet Escape close.
- No actual network/storage/credential handling under mock admin actions.
- Correct sample results across unanswered/incorrect answers and retry.
- Export is HTTP-served static design; no file:// or real admin security claims.

## Progress
- [x] Read rules, existing evidence and primary docs; foundation and upstream primitives installed.
- [ ] Gemini student/admin/shell and design notes.
- [ ] Prototype checks/render/ZIP and evidence.
- [ ] Commit/push same PR, downstream tester handoff.

## Latest owner overrides and handoff

- Static PNG only; no clickable-demo acceptance.
- Orange/navy supersedes sky-blue; two representative screens ×desktop/mobile delivered for owner direction approval.
- Actual typecheck/build, font/assets/errors/geometry checks passed. Prior screens preserved, not polished into new palette yet.
- Same PR2 source handoff, no product implementation/deploy.
