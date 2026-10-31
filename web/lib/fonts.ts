import localFont from "next/font/local";

// Fontsource subset unicode ranges keep Vietnamese glyphs available without a CDN.
export const latinFont = localFont({
 src: [
  { path: "../fonts/be-vietnam-pro-latin-400-normal.woff2", weight: "400", style: "normal" },
  { path: "../fonts/be-vietnam-pro-latin-600-normal.woff2", weight: "600", style: "normal" },
  { path: "../fonts/be-vietnam-pro-latin-700-normal.woff2", weight: "700", style: "normal" },
  { path: "../fonts/be-vietnam-pro-latin-800-normal.woff2", weight: "800", style: "normal" },
 ],
 variable: "--font-be-latin",
 display: "swap",
 // Keep fallback fonts after all three subsets in the combined CSS stack.
 adjustFontFallback: false,
 declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const latinExtFont = localFont({
 src: [
  { path: "../fonts/be-vietnam-pro-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
  { path: "../fonts/be-vietnam-pro-latin-ext-600-normal.woff2", weight: "600", style: "normal" },
  { path: "../fonts/be-vietnam-pro-latin-ext-700-normal.woff2", weight: "700", style: "normal" },
  { path: "../fonts/be-vietnam-pro-latin-ext-800-normal.woff2", weight: "800", style: "normal" },
 ],
 variable: "--font-be-latin-ext",
 // Vietnamese and Latin subsets cover the site text; load extended glyphs on demand.
 preload: false,
 display: "swap",
 // Keep fallback fonts after all three subsets in the combined CSS stack.
 adjustFontFallback: false,
 declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

export const vietnameseFont = localFont({
 src: [
  { path: "../fonts/be-vietnam-pro-vietnamese-400-normal.woff2", weight: "400", style: "normal" },
  { path: "../fonts/be-vietnam-pro-vietnamese-600-normal.woff2", weight: "600", style: "normal" },
  { path: "../fonts/be-vietnam-pro-vietnamese-700-normal.woff2", weight: "700", style: "normal" },
  { path: "../fonts/be-vietnam-pro-vietnamese-800-normal.woff2", weight: "800", style: "normal" },
 ],
 variable: "--font-be-vietnamese",
 display: "swap",
 // Keep fallback fonts after all three subsets in the combined CSS stack.
 adjustFontFallback: false,
 declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

