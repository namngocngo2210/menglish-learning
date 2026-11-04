export const skillTone = {
 "doc-hieu": "read", "ngu-phap": "grammar", "tu-vung": "vocab", "viet-cau": "write",
 "de-thi": "exam", "luyen-nhanh": "quick", "nhom": "group",
} as const;
export type SkillKind = keyof typeof skillTone;

export function SkillIcon({ kind, size = 56 }: { kind: SkillKind; size?: number }) {
 const tone = skillTone[kind];
 return <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true" focusable="false">
  <rect width="56" height="56" rx="16" fill={`var(--color-skill-${tone}-soft)`}/>
  <g fill="none" stroke={`var(--color-skill-${tone})`} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
   {kind === "doc-hieu" && <><path d="M12 15Q20 12 28 17Q36 12 44 15V40Q36 37 28 42Q20 37 12 40ZM28 17V42M17 22L23 23M33 23L39 22M17 29L23 30M33 30L39 29"/></>}
   {kind === "ngu-phap" && <><rect x="13" y="12" width="30" height="32" rx="4"/><path d="M19 21L21 23L25 18M30 21H37M19 33L21 35L25 30M30 33H37"/></>}
   {kind === "tu-vung" && <><path d="M13 16H37V34H24L17 40V34H13ZM28 39H37L43 44V24"/><path d="M20 28L24 20L28 28M22 25H26"/></>}
   {kind === "viet-cau" && <><path d="M15 41L17 31L35 13Q37 11 40 14L43 17L23 37ZM17 31L23 37M32 16L39 23M13 45H43"/></>}
   {kind === "de-thi" && <><path d="M20 14H14V44H42V14H36"/><rect x="21" y="10" width="14" height="8" rx="3"/><path d="M21 29L26 34L36 24M21 39H35"/></>}
   {kind === "luyen-nhanh" && <path d="M31 10L15 30H26L23 46L42 24H30Z" fill={`var(--color-skill-${tone})`}/>}
   {kind === "nhom" && <><circle cx="28" cy="18" r="6"/><circle cx="13" cy="25" r="4"/><circle cx="43" cy="25" r="4"/><path d="M18 44V37Q18 29 28 29Q38 29 38 37V44ZM6 42V38Q6 32 13 32M50 42V38Q50 32 43 32"/></>}
  </g>
 </svg>;
}
