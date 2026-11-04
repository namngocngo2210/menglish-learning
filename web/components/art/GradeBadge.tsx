import type { Grade } from "@/lib/routes";
const digits = {
 6: "M40 17Q21 15 21 35V43Q21 57 33 57Q45 57 45 44Q45 31 33 31Q22 31 21 43",
 7: "M20 17H46L29 57",
 8: "M33 35C14 35 16 15 33 15C50 15 52 35 33 35C12 35 14 58 33 58C52 58 54 35 33 35Z",
 9: "M45 31Q44 44 33 44Q21 44 21 31Q21 17 33 17Q45 17 45 31V39Q45 59 26 57",
} as const;
export function GradeBadge({ grade }: { grade: Grade }) {
 return <svg className="h-auto max-w-full" width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" focusable="false">
  <rect x="2" y="2" width="72" height="72" rx="22" fill="var(--color-warm)"/>
  <path d={digits[grade]} fill="none" stroke="var(--color-navy)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M58 15L60 21L66 23L60 25L58 31L56 25L50 23L56 21Z" fill="var(--color-primary)"/>
 </svg>;
}
