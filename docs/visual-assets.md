# Original SVG assets

These assets are original SVG drawn in-repo for this project, no third-party source, no AI-generated image, no photos/likeness. They use inline shapes without fonts, external references, raster images or SVG defs.

| File | Asset | Raw source bytes | Gzip bytes |
| --- | --- | ---: | ---: |
| `web/components/art/Mascot.tsx` | Eight poses: welcome, thinking, correct, oops, trophy, group, sleepy, reading; shared bee parts; original SVG drawn in-repo for this project, no third-party source, no AI-generated image, no photos/likeness | 3662 | 1462 |
| `web/components/art/SkillIcon.tsx` | Seven two-colour skill tiles; original SVG drawn in-repo for this project, no third-party source, no AI-generated image, no photos/likeness | 1707 | 858 |
| `web/components/art/GradeBadge.tsx` | Four path-drawn grade numerals with a star motif; original SVG drawn in-repo for this project, no third-party source, no AI-generated image, no photos/likeness | 827 | 507 |
| `web/components/art/HeroArt.tsx` | Welcome bee, soft blobs, pencil, book and sparkles; original SVG drawn in-repo for this project, no third-party source, no AI-generated image, no photos/likeness | 1227 | 673 |
| `web/components/art/index.ts` | Tiny export barrel (no additional visual); original SVG drawn in-repo for this project, no third-party source, no AI-generated image, no photos/likeness | 156 | 98 |

## Skill palette

The single source of palette values is `web/app/globals.css` in `@theme`. Read, grammar and exam use brand blue/sky hues; quick uses dark warm yellow. Green and coral are the only additional accent hues. Names and glyphs also identify every skill. Ratios use WCAG relative luminance, rounded to two decimals; every strong colour exceeds 4.5:1 on both backgrounds.

| Token suffix | Strong | Soft | On soft | On cream `#fffdf5` |
| --- | --- | --- | ---: | ---: |
| read | `#0a6590` | `#e8f7fd` | 5.84 | 6.29 |
| grammar | `#145e7a` | `#e8f7fd` | 6.58 | 7.08 |
| vocab | `#286344` | `#eaf5ed` | 6.35 | 6.97 |
| write | `#a23e48` | `#fceef0` | 5.61 | 6.21 |
| exam | `#0a6590` | `#e8f7fd` | 5.84 | 6.29 |
| quick | `#805500` | `#fff6d6` | 6.03 | 6.41 |
| group | `#286344` | `#eaf5ed` | 6.35 | 6.97 |

## Size measurement

Source sizes above use UTF-8 byte lengths and Node `zlib.gzipSync` with default settings. The home render test measures the complete SVG markup (including other home icons and the optional group tile), excluding nested SVGs from double counting. Measured with group practice enabled: **9769 bytes raw / 2018 bytes gzip**. It enforces <25,000 raw bytes and <8,000 gzip bytes. Only one mascot is inlined on home; its shared shapes need no defs or IDs.

## Motion and accessibility

All three bee keyframes and animation classes live inside `prefers-reduced-motion: no-preference`. `bee-float` bobs 3px twice over six seconds; `bee-wing` flutters six times over 3.6 seconds, then rests. `bee-pop` scales feedback poses in once over 250ms. Motion is finite so the hero settles without needing a pause control. Tile/grade hover lift and transitions are motion-safe; the reused `.press` helper scales active links to .97 only when motion is allowed. The existing reduced-motion block remains intact.

Every SVG reserves width and height. Mascots with a title expose `role="img"` and a title; other artwork is decorative, aria-hidden and unfocusable. Grade numerals are paths; visible link labels carry their meaning. Shapes are server-renderable without client directives or runtime animation code.
