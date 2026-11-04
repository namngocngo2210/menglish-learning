type Pose = "welcome" | "thinking" | "correct" | "oops" | "trophy" | "group" | "sleepy" | "reading";
type Props = { pose: Pose; size: number; title?: string; className?: string };

function Bee({ pose }: { pose: Exclude<Pose, "group"> }) {
 const closed = pose === "sleepy" || pose === "correct";
 return <g className="bee-float" stroke="#291e1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
  <g className="bee-wing" fill="#10b7eb" fillOpacity=".35"><ellipse cx="30" cy="58" rx="14" ry="22" transform="rotate(-35 30 58)"/><ellipse cx="90" cy="58" rx="14" ry="22" transform="rotate(35 90 58)"/></g>
  <ellipse cx="60" cy="76" rx="30" ry="28" fill="#ffc001"/>
  <path d="M33 77Q60 91 87 77M39 94Q60 103 81 94" fill="none" strokeWidth="7"/>
  <path d="M48 29Q46 17 39 16M72 29Q74 17 81 16" fill="none"/><g fill="#291e1c"><circle cx="38" cy="15" r="4"/><circle cx="82" cy="15" r="4"/></g>
  <circle cx="60" cy="51" r="29" fill="#ffc001"/>
  <g fill="#fffdf5" fillOpacity=".55"><circle cx="47" cy="49" r="12"/><circle cx="73" cy="49" r="12"/></g>
  <path d="M59 48H61M31 46L35 48M85 48L89 46" fill="none"/>
  {closed ? <path d="M42 50Q47 45 52 50M68 50Q73 45 78 50" fill="none"/> : <g fill="#291e1c" stroke="none"><ellipse cx="48" cy={pose === "oops" ? 51 : 49} rx="3" ry="4"/><ellipse cx="72" cy={pose === "oops" ? 51 : 49} rx="3" ry="4"/></g>}
  {pose === "thinking" && <path d="M41 34L51 32M69 33L78 36" fill="none"/>}
  <path d={pose === "oops" ? "M55 65Q60 61 65 64" : "M54 63Q60 70 66 63"} fill="none"/>
  {pose === "welcome" && <path d="M35 77Q20 78 18 59M16 60L13 54M18 59L20 52M85 79L96 86" fill="none"/>}
  {pose === "thinking" && <><path d="M34 80Q45 88 57 70M85 79L92 88" fill="none"/><g fill="#fffdf5"><path d="M89 9H109Q115 9 115 15V31Q115 37 109 37H99L90 44V37H89Q83 37 83 31V15Q83 9 89 9Z"/></g><path d="M95 19Q95 13 102 15Q110 18 101 24V27M101 31V31.2" fill="none"/></>}
  {pose === "correct" && <><path d="M34 77L18 64L16 55M86 77L102 64L104 55" fill="none"/><path d="M90 23L97 30L110 14" fill="none" stroke="#0a6590" strokeWidth="4"/><path d="M13 22V34M7 28H19" fill="none" stroke="#0a6590"/></>}
  {pose === "oops" && <><path d="M34 78L27 85M86 78Q96 78 94 65" fill="none"/><path d="M94 31Q84 44 94 44Q104 44 94 31Z" fill="#10b7eb"/></>}
  {pose === "sleepy" && <><path d="M34 81L42 86M86 81L78 86M93 18H105L93 29H105M105 5H113L105 12H113" fill="none"/></>}
  {pose === "trophy" && <><path d="M49 80H40V87Q40 94 51 94M71 80H80V87Q80 94 69 94" fill="none"/><path d="M48 76H72V88Q72 100 60 100Q48 100 48 88ZM60 100V108M51 109H69" fill="#ffc001"/><path d="M33 81L48 88M87 81L72 88" fill="none"/><path d="M60 81L62 85L67 86L63 89L64 94L60 92L56 94L57 89L53 86L58 85Z" fill="#291e1c" stroke="none"/></>}
  {pose === "reading" && <><path d="M36 79Q48 75 60 82Q72 75 84 79V101Q72 97 60 104Q48 97 36 101Z" fill="#e8f7fd"/><path d="M60 82V104M42 85L53 87M67 87L78 85M42 92L53 94M67 94L78 92" fill="none" stroke="#0a6590"/><path d="M30 80L38 89M90 80L82 89" fill="none"/></>}
 </g>;
}

export function Mascot({ pose, size, title, className }: Props) {
 return <svg width={size} height={size} viewBox="0 0 120 120" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : "true"} focusable="false">
  {title && <title>{title}</title>}
  <g className={pose === "correct" || pose === "oops" || pose === "trophy" ? "bee-pop" : undefined}>
   {pose === "group" ? <><g transform="translate(0 32) scale(.45)"><Bee pose="reading"/></g><g transform="translate(33 23) scale(.5)"><Bee pose="welcome"/></g><g transform="translate(66 32) scale(.45)"><Bee pose="correct"/></g></> : <Bee pose={pose}/>}
  </g>
 </svg>;
}
