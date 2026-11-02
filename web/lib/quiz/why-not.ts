/**
 * Rule-based "why is this option not suitable" text for the verb-form items
 * ("Sau “to”, cấu trúc này dùng dạng nguyên thể của động từ “turn”.").
 * Computed at render time from the stored rule + option text, nothing is stored per option.
 * Returns null when no deterministic rule applies (the caller shows a neutral line instead).
 */
const RULE = /^Sau “([^”]+)”, cấu trúc này dùng (dạng nguyên thể|dạng V-ing|dạng phân từ quá khứ) của động từ “([^”]+)”\.$/;

/** Irregular verbs seen in the bank: base -> [simple past, past participle]. Anything else is treated as regular. */
const IRREGULAR: Record<string, readonly [string, string]> = {
 be: ["was", "been"], come: ["came", "come"], do: ["did", "done"], find: ["found", "found"], get: ["got", "got"], give: ["gave", "given"],
 go: ["went", "gone"], have: ["had", "had"], hear: ["heard", "heard"], make: ["made", "made"], say: ["said", "said"], see: ["saw", "seen"],
 sink: ["sank", "sunk"], speak: ["spoke", "spoken"], take: ["took", "taken"], tear: ["tore", "torn"], tell: ["told", "told"],
 think: ["thought", "thought"], know: ["knew", "known"], write: ["wrote", "written"], buy: ["bought", "bought"], bring: ["brought", "brought"],
 eat: ["ate", "eaten"], run: ["ran", "run"], read: ["read", "read"], leave: ["left", "left"], meet: ["met", "met"], keep: ["kept", "kept"],
 begin: ["began", "begun"], build: ["built", "built"], choose: ["chose", "chosen"], draw: ["drew", "drawn"], drink: ["drank", "drunk"],
 fall: ["fell", "fallen"], feel: ["felt", "felt"], grow: ["grew", "grown"], hold: ["held", "held"], learn: ["learnt", "learnt"],
 lose: ["lost", "lost"], pay: ["paid", "paid"], put: ["put", "put"], send: ["sent", "sent"], sit: ["sat", "sat"], sleep: ["slept", "slept"],
 stand: ["stood", "stood"], swim: ["swam", "swum"], teach: ["taught", "taught"], win: ["won", "won"], sell: ["sold", "sold"], show: ["showed", "shown"],
 break: ["broke", "broken"], catch: ["caught", "caught"], cut: ["cut", "cut"], fly: ["flew", "flown"], forget: ["forgot", "forgotten"],
 spend: ["spent", "spent"], shoot: ["shot", "shot"], feed: ["fed", "fed"], rebuild: ["rebuilt", "rebuilt"], deal: ["dealt", "dealt"], lead: ["led", "led"],
 hide: ["hid", "hidden"], ride: ["rode", "ridden"], rise: ["rose", "risen"], sing: ["sang", "sung"], throw: ["threw", "thrown"], wear: ["wore", "worn"],
};

/** Regular spellings of base + suffix (-e drop, consonant+y -> ies/ied, doubled final consonant). */
function regularForms(base: string) {
 if (base.endsWith("ie")) return { ed: new Set([`${base}d`]), ing: new Set([`${base.slice(0, -2)}ying`]), s: new Set([`${base}s`]) };
 const y = /[^aeiou]y$/.test(base), e = base.endsWith("e");
 const stem = y ? base.slice(0, -1) : e ? base.slice(0, -1) : base;
 const ed = new Set([y ? `${stem}ied` : e ? `${base}d` : `${base}ed`, `${base}ed`, `${base}${base.slice(-1)}ed`]);
 const ing = new Set([e && !base.endsWith("ee") ? `${stem}ing` : `${base}ing`, `${base}ing`, `${base}${base.slice(-1)}ing`]);
 const s = new Set([y ? `${stem}ies` : /(s|x|z|ch|sh|o)$/.test(base) ? `${base}es` : `${base}s`, `${base}s`]);
 return { ed, ing, s };
}

type Form = "nguyên thể" | "V-ing" | "-s/-es" | "quá khứ đơn" | "phân từ quá khứ" | "quá khứ (-ed)" | "quá khứ / phân từ quá khứ";
const LABEL: Record<Form, string> = {
 "nguyên thể": "dạng nguyên thể", "V-ing": "dạng V-ing", "-s/-es": "dạng thêm -s/-es (ngôi thứ ba số ít)",
 "quá khứ đơn": "dạng quá khứ đơn", "phân từ quá khứ": "dạng phân từ quá khứ", "quá khứ (-ed)": "dạng quá khứ (-ed)",
 "quá khứ / phân từ quá khứ": "dạng quá khứ / phân từ quá khứ",
};

/** Form of `word` as a derivative of `base`, or null when it is not a recognisable form. */
export function classifyVerbForm(base: string, word: string): Form | null {
 const w = word.trim().toLowerCase(), b = base.toLowerCase();
 if (w === b) return "nguyên thể";
 const irregular = IRREGULAR[b];
 if (irregular) {
  const [past, pp] = irregular;
  if (w === past && w === pp) return "quá khứ / phân từ quá khứ";
  if (w === past) return "quá khứ đơn";
  if (w === pp) return "phân từ quá khứ";
 }
 if (b === "be") return null; // am/is/are/bes: no safe single label
 const f = regularForms(b);
 if (f.ing.has(w)) return "V-ing";
 if (f.s.has(w) || (b === "have" && w === "has")) return "-s/-es";
 if (!irregular && f.ed.has(w)) return "quá khứ (-ed)";
 return null;
}

/** Specific reason why `optionText` (a wrong choice) does not fit, or null when no safe rule applies. */
export function whyNot(explanation: string, optionText: string): string | null {
 const m = RULE.exec(explanation);
 if (!m) return null;
 const [, trigger, target, base] = m;
 const form = classifyVerbForm(base, optionText);
 if (!form) return null;
 return `Sau “${trigger}” cần ${target}; “${optionText}” là ${LABEL[form]}.`;
}
