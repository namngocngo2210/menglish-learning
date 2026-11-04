import { Mascot } from "./Mascot";
export function HeroArt() {
 return <svg width="300" height="240" viewBox="0 0 300 240" aria-hidden="true" focusable="false" className="mx-auto h-auto w-44 sm:w-56 md:w-72">
  <path d="M40 120Q13 45 96 33Q160 2 213 48Q291 75 258 159Q243 223 160 210Q58 237 40 120Z" fill="var(--color-warm-2)"/>
  <ellipse cx="226" cy="76" rx="38" ry="43" fill="var(--color-sky-soft)"/>
  <g transform="translate(57 14) scale(1.6)"><Mascot pose="welcome" size={120}/></g>
  <g stroke="var(--color-navy)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
   <path d="M33 112L55 178L49 195L34 184L13 119Z" fill="var(--color-sky)"/><path d="M33 112L13 119L17 98ZM34 184L55 178" fill="var(--color-surface)"/>
   <path d="M206 154Q225 150 241 163Q257 153 276 159L270 200Q253 194 237 204Q223 193 204 195Z" fill="var(--color-surface)"/><path d="M241 163L237 204M214 165L232 171M249 171L265 168M213 177L230 183M247 182L263 179" fill="none" stroke="var(--color-primary)"/>
  </g>
  <path d="M53 43L56 51L64 54L56 57L53 65L50 57L42 54L50 51ZM251 109L254 117L262 120L254 123L251 131L248 123L240 120L248 117Z" fill="var(--color-primary)"/>
  <circle cx="76" cy="193" r="5" fill="var(--color-sky)"/>
 </svg>;
}
