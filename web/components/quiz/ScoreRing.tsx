import { starCount } from "@/lib/quiz/result-visual";

export function ScoreRing({ score, total, percent }: { score: number; total: number; percent: number }) {
 return <div className="relative flex size-36 shrink-0 flex-col items-center justify-center text-navy">
  <svg width="144" height="144" viewBox="0 0 144 144" aria-hidden="true" focusable="false" className="absolute inset-0 -rotate-90">
   <circle cx="72" cy="72" r="64" fill="none" stroke="var(--color-sky-soft)" strokeWidth="10"/>
   <circle cx="72" cy="72" r="64" pathLength="100" fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeDasharray={`${percent} 100`} strokeLinecap="round"/>
  </svg>
  <span className="text-3xl font-extrabold tabular-nums">{score}/{total}</span>
  <span className="font-bold text-primary">{percent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</span>
 </div>;
}

export function ResultStars({ percent }: { percent: number }) {
 const stars = starCount(percent);
 return <div className="flex gap-1" role="img" aria-label={`${stars} sao`}>
  {Array.from({ length: stars }, (_, i) => <svg key={i} width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 3L20 11L29 13L22 20L24 29L16 25L8 29L10 20L3 13L12 11Z" fill="var(--color-cta)" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinejoin="round"/></svg>)}
 </div>;
}
