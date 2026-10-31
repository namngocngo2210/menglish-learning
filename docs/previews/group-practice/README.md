# BeeJunior · Luyện tập nhóm

**Design reference only, sample data.** These are static Vietnamese design mockups for students in grades 6–9. Names, room codes, scores and states are illustrative; the screens do not create real rooms or submit answers. Open `index.html` to browse the ten screens. The authoritative visual and content requirements are in `BRIEF.md`.

The BeeJunior logo is local in `assets/`. Be Vietnam Pro loads only the existing local 400/700 WOFF2 subsets from `../../../web/fonts/`; keep this folder in the worktree so those relative URLs resolve. There are no CDN dependencies or external image requests.

## Rebuild

From the repository root:

```bash
python3 docs/previews/group-practice/build-mockups.py
~/.local/bin/heavy -- node docs/previews/group-practice/build-css.cjs
```

`build-mockups.py` is the screen source. Edit it to change HTML; edit `input.css` to change shared styles. The CSS builder uses Tailwind CSS v4 and PostCSS already installed in `/home/menglish/wt-topics-classification/web/node_modules`. Set `TAILWIND_MODULES` to another existing compatible dependency tree if needed. No installation is required.

## Render and inspect

```bash
bash docs/previews/group-practice/render.sh
```

`render.sh` runs the full browser job through `~/.local/bin/heavy`. It requires Node.js 24 (native WebSocket) and headless Chrome at `/home/menglish/wt-foundation/.cache/browser/chrome-linux64/chrome`; set `CHROME_BIN` to override. The renderer waits for all local fonts and images, measures full page height, and writes exactly 20 screenshots to `png/`: ten screens at 1440px and 390px, with device scale 1.

`render-audit.json` records each screenshot's dimensions, horizontal overflow, targets under 44×44px, text contrast under 4.5:1, loaded font subsets, logo, visible focus demonstration and sample label. A failing check causes a nonzero exit after screenshots are saved. Review every PNG visually for clipping and readability after rendering; automated measurements complement that review.

Palette: yellow `#ffc001`, deep sky `#0a6f96`, ink `#291e1c`, cream `#fffbea`, light sky `#eef9fe`. Bright sky `#10b7eb` is decorative. Green `#166534` denotes submission success. Each screen includes a visible focus ring as a design reference.
