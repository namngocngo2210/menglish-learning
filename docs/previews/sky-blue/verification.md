# Preview verification evidence

Scope: non-production design artifacts only; owner approval pending. No app scaffold, backend, crawler, real scoring, auth, analytics, ad calls, deployment, domain/proxy changes or resumed paused work.

## Authorship and reproduction

UI HTML/CSS/interaction code and `docs/ui-design.md` authored exclusively by Gemini through official `/home/menglish/.local/bin/agy`, model `gemini-3.8-flash-medium`. Coordinator mechanically materialized allowlisted structured output, reviewed boundaries and executed browser checks. No Codex UI authoring. No permission bypass or persistent settings changes.

Command shape: `agy --model gemini-3.8-flash-medium --mode plan --print-timeout <240s|400s> --json-schema '<allowlisted output schema>' -p '<inline safe docs + full skill + brief/current content>' --output-format json`. Final polish resumed its own conversation after a timed-out turn; the timed-out output was NOT materialized. Successful output required status SUCCESS, complete structured_output, exact unique edits and allowlisted resolved paths without symlinks. No toolkit file/edit permissions needed.

Required search executed: `python3 /home/menglish/.hermes/shared-skills/ui-ux-pro-max/ui-ux-pro-max/scripts/search.py "secondary-school English learning sky-blue" --design-system`. Skill supplied inline from `/home/menglish/.hermes/shared-skills/ui-ux-pro-max/ui-ux-pro-max/SKILL.md`. Gemini recorded accepted hierarchy/focus/accessibility guidance and rejected preschool/purple/comic suggestions in the design document.

## Executed browser checks

Opened local `file://` HTML in Chrome 145 (no preview server). Used CDP `Emulation.setDeviceMetricsOverride`, `Page.reload`, DOM measurements, `Page.captureScreenshot` (viewport and full-document clips). Desktop 1440x1000 and mobile 390x844, device scale 1. Screens: home, exercises, quiz, results. Each of eight views has one visible h1, zero measured horizontal overflow/outside main elements, no visible button/select/link below 44px height, zero failed image assets, zero console/runtime errors and zero resource network requests. Error listeners and console.error interception installed before reload.

Keyboard Tab showed solid 3px focus; Escape closed native submit dialog. Original long Vietnamese heading stress test at 390px wrapped inside the viewport. Executed choice selection, flag aria-pressed, numbered navigator aria-current, submit/results, retry reset, grade8 carry to filters, reset, empty filters (valid grade9 + writing combination), and loading/empty/error/rate_limit state switcher. All checks passed. Static HTML parser checked duplicate IDs, external src/href, and absence of network/storage primitives.

The numbered quiz navigator is an explicitly labelled concept: only one real sample question body is present; other indices demonstrate navigation state with an aria-live explanation. Score and timer are predetermined mock data, not grading. Two sample explanations illustrate correct/incorrect designs. No claim of complete question bank, production SEO, security certification, measured Core Web Vitals or audited WCAG conformance.

Gemini UI assessment used complete DOM/CSS and actual Chrome layout measurements, NOT screenshot pixels. Independent visual approval still belongs to the owner; technical evidence is not aesthetic approval. No full app test suite exists or was run. No server/container was started, so no preview cleanup was required.

## Usage counters (reported by Antigravity)

These are per-conversation provider-reported counters, not shared account quota or monetary billing. The resumed polish conversation is listed only once using its latest counters; no cumulative turn double-counting.

```json
[
  {
    "phase": "generation",
    "conversation_id": "505cd3df-3362-4ae3-89eb-dc17d41aba02",
    "model": "gemini-3.8-flash-medium",
    "usage": {
      "input_tokens": 15557,
      "output_tokens": 29095,
      "thinking_tokens": 2490,
      "cache_read_tokens": 0,
      "total_tokens": 44652
    },
    "duration_seconds": 163.535893563
  },
  {
    "phase": "review",
    "conversation_id": "ef2fb789-bd9f-4bb8-bd4b-18d899142686",
    "model": "gemini-3.8-flash-medium",
    "usage": {
      "input_tokens": 36292,
      "output_tokens": 27407,
      "thinking_tokens": 16637,
      "cache_read_tokens": 0,
      "total_tokens": 63699
    },
    "duration_seconds": 163.487669555
  },
  {
    "phase": "polish",
    "conversation_id": "893a2ae2-69bf-49f1-8b74-6d94e7fb733b",
    "model": "gemini-3.8-flash-medium",
    "usage": {
      "input_tokens": 76573,
      "output_tokens": 44173,
      "thinking_tokens": 27184,
      "cache_read_tokens": 56082,
      "total_tokens": 120746
    },
    "duration_seconds": 300.148916722
  }
]
```
