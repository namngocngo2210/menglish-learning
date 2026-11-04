"use client";
import { Mascot } from "@/components/art/Mascot";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle } from "lucide-react";
import { createRoomsClient } from "@/lib/rooms/client";
import { availableCount, buildCreateInput, describeRoomError, parseTestInput, PLAYER_OPTIONS, validateCreate, type CreateDraft, type CreateErrors, type Difficulty, type RoomCatalog } from "@/lib/rooms/form";
import type { Skill } from "@/lib/rooms/types";
import { roomPath, testSlugPath, SKILL_NAMES } from "@/lib/routes";
import { ChoiceGroup, ctaCls, Field, FieldError, inputCls } from "./fields";

const GRADE_OPTIONS = [6, 7, 8, 9].map(g => ({ value: g as 6 | 7 | 8 | 9, label: `Lớp ${g}` }));
const SKILL_LIST = Object.keys(SKILL_NAMES) as Skill[];
const DIFFICULTY: { value: Difficulty; label: string }[] = [{ value: "easy", label: "Dễ" }, { value: "medium", label: "Vừa" }, { value: "hard", label: "Khó" }, { value: "balanced", label: "Cân bằng" }];
const TIME: { value: 15 | 30 | null; label: string }[] = [{ value: null, label: "Không giới hạn" }, { value: 15, label: "15 phút" }, { value: 30, label: "30 phút" }];
const PLAYERS = PLAYER_OPTIONS.map(n => ({ value: n as number, label: n === 2 ? "2 (đấu đôi)" : String(n) }));
const SIZES = [10, 20, 40].map(n => ({ value: n as 10 | 20 | 40, label: `${n} câu` }));

export function CreateRoomForm({ catalog, initialSlug = null }: { catalog: RoomCatalog; initialSlug?: string | null }) {
 const router = useRouter();
 const client = useRef(createRoomsClient()).current;
 const [d, setD] = useState<CreateDraft>({ name: "", kind: initialSlug ? "fixed" : "mix", slug: initialSlug, grade: 7, skills: ["ngu-phap"], topic: null, size: 20, difficulty: "balanced", time: null, maxPlayers: 10 });
 const [paste, setPaste] = useState(initialSlug ? testSlugPath(initialSlug) : "");
 const [errors, setErrors] = useState<CreateErrors>({});
 const [serverError, setServerError] = useState<{ message: string; field: string } | null>(null);
 const [busy, setBusy] = useState(false);
 const set = (patch: Partial<CreateDraft>) => { setD(prev => ({ ...prev, ...patch })); setServerError(null); };

 // ?de=<slug> (from a test page) preselects a fixed test.
 useEffect(() => {
  if (initialSlug) return;
  const de = new URLSearchParams(window.location.search).get("de");
  const slug = de ? parseTestInput(de) : null;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from the URL after hydration
  if (slug && catalog.tests.some(t => t.slug === slug)) { setD(p => ({ ...p, kind: "fixed", slug })); setPaste(testSlugPath(slug)); }
 }, [initialSlug, catalog.tests]);

 const topics = useMemo(() => d.skills.length === 1 ? catalog.topics.filter(t => t.grade === d.grade && t.skill === d.skills[0]) : [], [catalog.topics, d.grade, d.skills]);
 const topic = d.skills.length === 1 ? d.topic : null;
 const available = availableCount(catalog.pool, d.grade, d.skills, topic);
 const picked = d.slug ? catalog.tests.find(t => t.slug === d.slug) : undefined;
 const pasteSlug = paste.trim() ? parseTestInput(paste, typeof window === "undefined" ? undefined : window.location.host) : null;
 const pasteInvalid = paste.trim() !== "" && !pasteSlug;
 const pasteUnknown = !!pasteSlug && !catalog.tests.some(t => t.slug === pasteSlug);
 const short = d.skills.length > 0 && available < d.size;

 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (busy) return;
  const errs = validateCreate(d, catalog);
  setErrors(errs); setServerError(null);
  const first = Object.keys(errs)[0];
  if (first) { document.getElementById(`tao-${first}`)?.focus(); return; }
  setBusy(true);
  try {
   const res = await client.create(buildCreateInput(d));
   router.push(roomPath(res.code));
  } catch (error) {
   setServerError(describeRoomError(error)); setBusy(false);
  }
 }
 const nameErr = errors.name ?? (serverError?.field === "name" ? serverError.message : null);
 const formErr = serverError && serverError.field !== "name" ? serverError.message : null;

 return <form onSubmit={submit} noValidate aria-labelledby="tao-phong-heading" className="space-y-5">
  <fieldset className="min-w-0">
   <legend className="font-semibold">Cách chọn đề</legend>
   <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-sky-soft p-1">
    {([["fixed", "Đề có sẵn"], ["mix", "Trộn theo loại"]] as const).map(([k, label]) => <label key={k} className="cursor-pointer">
     <input type="radio" name="kind" className="peer sr-only" checked={d.kind === k} onChange={() => set({ kind: k })}/>
     <span className="flex min-h-11 items-center justify-center rounded-lg px-3 text-center font-bold peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy">{label}</span>
    </label>)}
   </div>
  </fieldset>

  {d.kind === "fixed" ? <div className="space-y-4">
   <Field id="tao-test" label="Chọn đề" error={errors.test}>{a => <select {...a} className={inputCls} value={d.slug ?? ""} onChange={e => { set({ slug: e.target.value || null }); setPaste(e.target.value ? testSlugPath(e.target.value) : ""); setErrors(p => ({ ...p, test: undefined })); }}>
    <option value="">— Chọn một đề —</option>
    {([6, 7, 8, 9] as const).map(g => <optgroup key={g} label={`Lớp ${g}`}>{catalog.tests.filter(t => t.grade === g).map(t => <option key={t.slug} value={t.slug}>{t.title} ({t.size} câu)</option>)}</optgroup>)}
   </select>}</Field>
   <Field id="tao-dan" label="Hoặc dán đường dẫn đề" hint="Ví dụ: /grade-7/grammar/present-simple/test-1" error={pasteInvalid ? "Đường dẫn không phải một đề hợp lệ." : pasteUnknown ? "Không có đề này trong thư viện." : null}>{a => <input {...a} className={inputCls} inputMode="url" autoComplete="off" spellCheck={false} value={paste} onChange={e => { setPaste(e.target.value); const s = parseTestInput(e.target.value, window.location.host); set({ slug: s && catalog.tests.some(t => t.slug === s) ? s : null }); }}/>}</Field>
   <div aria-live="polite" data-slot="test-preview" className="min-h-32 rounded-xl border-2 border-navy/20 bg-sky-soft p-3">
    {picked ? <p><span className="font-bold">{picked.title}</span><br/><span className="text-navy-soft">{picked.size} câu · Lớp {picked.grade}{picked.skill ? ` · ${SKILL_NAMES[picked.skill]}` : ""}</span></p> : <p role="status" className="flex min-h-24 items-center gap-3 text-navy"><Mascot pose="sleepy" size={64}/>Chưa chọn đề.</p>}
   </div>
  </div> : <div className="space-y-4">
   <ChoiceGroup legend="Lớp" name="grade" value={d.grade} options={GRADE_OPTIONS} onChange={grade => set({ grade, topic: null })}/>
   <fieldset aria-describedby="tao-skills-error" className="min-w-0">
    <legend className="font-semibold">Kỹ năng <span className="font-normal text-navy-soft">(chọn nhiều)</span></legend>
    <div className="mt-1.5 flex flex-wrap gap-2">
     {SKILL_LIST.map((s, i) => <label key={s} className="relative cursor-pointer">
      <input id={i === 0 ? "tao-skills" : undefined} type="checkbox" className="peer sr-only" checked={d.skills.includes(s)} onChange={() => { set({ skills: d.skills.includes(s) ? d.skills.filter(x => x !== s) : [...d.skills, s], topic: null }); setErrors(p => ({ ...p, skills: undefined, size: undefined })); }}/>
      <span className="inline-flex min-h-11 items-center rounded-xl border-2 border-navy/30 bg-white px-4 font-semibold peer-checked:border-navy peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy">{SKILL_NAMES[s]}</span>
     </label>)}
    </div>
    <FieldError id="tao-skills-error" message={errors.skills}/>
   </fieldset>
   {topics.length > 0 && <Field id="tao-topic" label="Chủ đề" hint="Để trống để lấy mọi chủ đề">{a => <select {...a} className={inputCls} value={d.topic ?? ""} onChange={e => set({ topic: e.target.value || null })}>
    <option value="">Tất cả chủ đề</option>{topics.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
   </select>}</Field>}
   <ChoiceGroup legend="Số câu" name="size" value={d.size} options={SIZES} onChange={size => set({ size })}/>
   <ChoiceGroup legend="Độ khó" name="difficulty" value={d.difficulty} options={DIFFICULTY} onChange={difficulty => set({ difficulty })}/>
   <p id="tao-size" tabIndex={-1} aria-live="polite" data-slot="available-count" className={`rounded-xl border-2 p-3 font-semibold ${short ? "border-red-700 bg-red-50 text-red-700" : "border-navy/20 bg-sky-soft"}`}>
    {d.skills.length === 0 ? "Chọn kỹ năng để xem số câu khả dụng." : <>Có <strong>{available}</strong> câu phù hợp{short ? `. Cần ${d.size} câu: giảm số câu hoặc mở rộng bộ lọc.` : "."}</>}
   </p>
  </div>}

  <ChoiceGroup legend="Giới hạn thời gian" name="time" value={d.time} options={TIME} onChange={time => set({ time })} hint="Không giới hạn: tự kết thúc trong tối đa 60 phút."/>
  <ChoiceGroup legend="Số người tối đa" name="max" value={d.maxPlayers} options={PLAYERS} onChange={maxPlayers => set({ maxPlayers })} hint="Tối đa 45 người, phù hợp cả lớp." errorId="tao-maxPlayers-error" error={errors.maxPlayers}/>
  <Field id="tao-name" label="Tên hiển thị của bạn" hint="Biệt danh 2–20 ký tự; tránh tên thật, số điện thoại." error={nameErr}>{a => <input {...a} className={inputCls} maxLength={40} autoComplete="off" value={d.name} onChange={e => { setD(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: undefined })); setServerError(s => s?.field === "name" ? null : s); }}/>}</Field>

  <div role="alert" className={formErr ? "rounded-xl border-2 border-red-700 bg-red-50 p-3 font-semibold text-red-700" : "sr-only"}>{formErr}</div>
  <button type="submit" className={ctaCls} disabled={busy}>{busy ? <><Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none"/>Đang tạo phòng…</> : <><PlusCircle aria-hidden="true" className="size-5"/>Tạo phòng</>}</button>
  <p className="text-sm text-navy-soft">Không cần tài khoản. Tên chỉ tồn tại trong phòng này.</p>
 </form>;
}
