# Visual refresh — audit (Phase 0) and results

Words = visible words inside `<main>` (Playwright, `innerText`). "Fold" = words whose box starts above the viewport bottom (390×844 / 1440×900). Before = live site 4/11; after = this branch (dev server). Screenshots: `before/`, `after/` (JPG, fold only).

## Before (live)

| Page | Fold 390 | Fold 1440 | Total words |
| --- | --- | --- | --- |
| Home `/` | 70 | 72 | 101 |
| Grade `/grade-6` | 124 | 161 | 161 |
| Skill `/grade-6/grammar` | 144 | 206 | 96 |
| Topic `/grade-6/grammar/mixed` | 115 | 178 | 181 |
| Test `/grade-6/grammar/mixed/test-1` | 136 | 150 | 362 |
| Quick practice `/quick-practice` | 55 | 55 | 55 |
| Group practice `/group-practice` | 62 | 98 | 363 |
| Sign-up `/sign-up` | 101 | 135 | 143 |

## Cut / shorten candidates (from the audit)

- Home: eyebrow line, "Em học lớp mấy?", skill hints (>6 words), hero sentence → one short line; add 3-step strip, SEO text in `<details>`.
- Grade: intro "Chọn kỹ năng em muốn luyện…893 câu hỏi…" (SEO sentence → `<details>`), skill card descriptions + "N chủ đề · M đề" → icon + one count.
- Skill/topic: intro paragraph, "20 đề · 137 câu · có giải thích tiếng Việt" duplicated per card ("~21 câu · ~15 phút/đề").
- Test: "Cách làm" block, repeated "Kiểm tra / câu N" labels, two "Bài tập" tabs.
- Quick practice: intro sentence repeated by "Em học lớp mấy?".
- Group practice: field helper texts, "Cách chơi trong 3 bước" paragraphs → 3-step strip, privacy block → collapsed.
- Sign-up: per-field help text (keep one-line hints only), legal sentence.

## After

Updated per card (home in part A; the rest in following cards of the same PR).

| Page | Fold 390 | Fold 1440 | Total words |
| --- | --- | --- | --- |
| Home | 40 | 58 | 94 |
| Quick practice `/quick-practice` | 42 | 42 | 42 |
| Group practice `/group-practice` | 58 | 94 | 280 |
| Sign-up `/sign-up` | 67 | 83 | 109 |
| Test `/grade-6/grammar/mixed/test-1` (quiz UI only) | 108 | 119 | 362 |
| Grade `/grade-6` | 64 | 111 | 77 |
| Skill `/grade-6/grammar` | 129 | 201 | 60 |
| Topic `/grade-6/grammar/mixed` | 85 | 136 | 142 |
| Grade 10 entrance `/grade-10-entrance` | 69 | 104 | 275 |

Home hero (h1 + line + grade badges) = 23 words. Fold at 1440 additionally shows the four skill tiles.

Part C notes: skill/topic/test cards show the skill icon plus one count line; the SEO intro sentences moved into a native `<details>` ("Xem thêm") below the cards and stay in the server HTML. Empty states use the sleepy mascot. Skill page fold stays ~129 words at 390 because the topic/test lists themselves are the content. No new SVG assets (existing SkillIcon/Mascot reused); home SVG weight in HTML is 8.5 KB raw / 1.7 KB gzip.

Lighthouse (mobile, `next start`, lighthouse 12): home P95 A100 SEO100 CLS0; /grade-6 P96 A100 SEO100 CLS0; /grade-6/grammar P96 A100 SEO100 CLS0; /grade-6/grammar/to-infinitive P91 A100 SEO100 CLS0; test page P91 A100 SEO100 CLS0; /grade-10-entrance P92 A100 SEO100 CLS0.
