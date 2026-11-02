"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, LogOut, Pencil, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { EMAIL_RE, USERNAME_HINT, USERNAME_RE } from "./AuthForms";
import { RecoveryCodes } from "./RecoveryCodes";
import { createAccountClient, type Me, type Profile } from "@/lib/account/client";
import { CHILD_AFTER, CHILD_BEFORE, CHILD_BOLD, CHILD_HINT } from "@/lib/account/consent-copy";
import { deleteDataPath, loginPath, registerPath } from "@/lib/account/paths";
import { GRADES } from "@/lib/routes";
import { card, CheckRow, ConfirmDialog, ctaCls, ErrorLine, Field, ghostCls, inputCls, useAction } from "./kit";

const danger = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-red-700 bg-white px-4 font-bold text-red-800 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60";
const dangerSolid = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 font-bold text-white hover:bg-red-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60";
const nickErr = (v: string) => { const n = [...v.trim()].length; return n < 2 || n > 20 ? "Biệt danh dài 2–20 ký tự." : null; };

type State = { kind: "loading" } | { kind: "out" } | { kind: "in"; me: Me; profiles: Profile[] };

export function AccountHome() {
 const [client] = useState(createAccountClient);
 const router = useRouter();
 const [state, setState] = useState<State>({ kind: "loading" });
 const [notice, setNotice] = useState<string | null>(null);
 const load = useCallback(async () => {
  try { const [me, profiles] = await Promise.all([client.me(), client.profiles()]); setState({ kind: "in", me, profiles }); }
  catch { setState({ kind: "out" }); }
 }, [client]);
 useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- initial session probe after mount

 if (state.kind === "loading") return <section className={card} aria-busy="true"><p>Đang tải tài khoản…</p></section>;
 if (state.kind === "out") return <section className={`${card} space-y-4`}><p className="font-semibold">Bạn chưa đăng nhập hoặc phiên đã hết hạn.</p><div className="flex flex-col gap-3 sm:flex-row"><Link className={ctaCls} href={loginPath()}>Đăng nhập</Link><Link className={ghostCls} href={registerPath()}>Tạo tài khoản</Link></div></section>;
 const { me, profiles } = state;
 return <div className="space-y-6">
  <section className={`${card} flex flex-wrap items-center justify-between gap-3`} aria-labelledby="tk-email"><div><h2 id="tk-email" className="text-lg font-extrabold">Tài khoản phụ huynh</h2><p className="break-all">Tên đăng nhập: <strong>{me.username}</strong></p></div>
   <SessionButtons client={client} onOut={() => router.replace(loginPath())}/></section>
  {notice && <p role="status" className="rounded-xl border-2 border-green-700/40 bg-green-50 p-3 font-semibold text-green-900">{notice}</p>}
  <RecoverySection client={client} me={me} onChange={async (msg) => { setNotice(msg); await load(); }}/>
  <Profiles client={client} me={me} profiles={profiles} onChange={async (msg) => { setNotice(msg); await load(); }}/>
  <PasswordSection client={client} me={me} onDone={setNotice}/>
  <DataSection client={client} me={me} onDeleted={() => router.replace(deleteDataPath())}/>
 </div>;
}

type Client = ReturnType<typeof createAccountClient>;

/** Username (one rename), email + verification, and recovery codes. */
function RecoverySection({ client, me, onChange }: { client: Client; me: Me; onChange: (msg: string) => Promise<void> }) {
 const un = useAction(); const em = useAction(); const rc = useAction();
 const [username, setUsername] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
 const [errs, setErrs] = useState<{ username?: string; email?: string; password?: string }>({});
 const [codes, setCodes] = useState<string[] | null>(null);
 const [askPw, setAskPw] = useState(false);
 if (codes) return <RecoveryCodes codes={codes} doneLabel="Xong" onDone={() => { setCodes(null); void onChange("Đã tạo 10 mã khôi phục mới. Các mã cũ không còn dùng được."); }}/>;
 const verified = !!me.email && me.emailVerified;
 async function saveUsername(e: React.FormEvent) {
  e.preventDefault();
  const name = username.trim().toLowerCase();
  const bad = USERNAME_RE.test(name) ? undefined : "Tên đăng nhập dài 3–20 ký tự, chỉ gồm a-z, 0-9, dấu . _ -.";
  setErrs(p => ({ ...p, username: bad }));
  if (bad) return document.getElementById("tk-ten-moi")?.focus();
  if ((await un.run(() => client.setUsername(name))).ok) { setUsername(""); await onChange("Đã đổi tên đăng nhập. Bạn không đổi lại được nữa."); }
 }
 async function saveEmail(e: React.FormEvent) {
  e.preventDefault();
  const bad = EMAIL_RE.test(email.trim()) ? undefined : "Hãy nhập email hợp lệ.";
  setErrs(p => ({ ...p, email: bad }));
  if (bad) return document.getElementById("tk-email-moi")?.focus();
  if ((await em.run(() => client.setEmail(email.trim()))).ok) { setEmail(""); await onChange("Đã gửi liên kết xác minh. Hãy mở email (cả mục Spam)."); }
 }
 async function regenerate(e: React.FormEvent) {
  e.preventDefault();
  if (!password) { setErrs(p => ({ ...p, password: "Hãy nhập mật khẩu để xác nhận." })); return document.getElementById("tk-mk-ma")?.focus(); }
  setErrs(p => ({ ...p, password: undefined }));
  const res = await rc.run(() => client.regenerateRecoveryCodes(password));
  if (res.ok) { setPassword(""); setAskPw(false); setCodes(res.value); }
 }
 return <section className={`${card} space-y-5`} aria-labelledby="tk-khoi-phuc">
  <h2 id="tk-khoi-phuc" className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck aria-hidden="true" className="size-5"/>Đăng nhập và khôi phục</h2>
  {!verified && <p role="note" className="rounded-xl border-2 border-amber-600/50 bg-amber-50 p-3 font-semibold text-amber-950">Bạn chưa có email đã xác minh. {me.recoveryCodesLeft > 0 ? "Nếu quên mật khẩu, bạn chỉ khôi phục được bằng mã khôi phục." : "Bạn cũng không còn mã khôi phục, nên nếu quên mật khẩu sẽ KHÔNG khôi phục được tài khoản. Hãy thêm email hoặc tạo mã mới."}</p>}
  {me.usernameChangeable && <form onSubmit={saveUsername} noValidate className="space-y-3" aria-label="Đổi tên đăng nhập">
   <Field id="tk-ten-moi" label="Đổi tên đăng nhập (chỉ một lần)" hint={USERNAME_HINT} error={errs.username}>{a => <input {...a} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={20} value={username} onChange={e => setUsername(e.target.value)} className={inputCls}/>}</Field>
   <ErrorLine message={un.error}/>
   <button type="submit" disabled={un.pending || !username} className={`${ghostCls} w-full sm:w-auto`}>{un.pending ? "Đang lưu…" : "Đổi tên"}</button>
  </form>}
  <div className="space-y-1"><h3 className="font-bold">Email</h3>
   {me.email ? <p className="break-all">{me.email} — <strong className={me.emailVerified ? "text-green-800" : "text-amber-900"}>{me.emailVerified ? "đã xác minh" : "chưa xác minh"}</strong></p> : <p>Chưa có email.</p>}</div>
  <form onSubmit={saveEmail} noValidate className="space-y-3" aria-label={me.email ? "Đổi email" : "Thêm email"}>
   <Field id="tk-email-moi" label={me.email ? "Email mới" : "Thêm email"} hint="Email đã xác minh dùng để đặt lại mật khẩu. Chúng tôi sẽ gửi liên kết xác minh." error={errs.email}>{a => <input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}/>}</Field>
   <ErrorLine message={em.error}/>
   <div className="flex flex-col gap-2 sm:flex-row">
    <button type="submit" disabled={em.pending || !email} className={`${ghostCls} w-full sm:w-auto`}>{em.pending ? "Đang gửi…" : me.email ? "Đổi và gửi xác minh" : "Thêm và gửi xác minh"}</button>
    {me.email && !me.emailVerified && <button type="button" disabled={em.pending} className={`${ghostCls} w-full sm:w-auto`} onClick={async () => { if ((await em.run(() => client.setEmail(me.email!))).ok) await onChange("Đã gửi lại liên kết xác minh."); }}>Gửi lại liên kết xác minh</button>}
   </div>
  </form>
  <div className="space-y-3"><h3 className="flex items-center gap-2 font-bold"><KeyRound aria-hidden="true" className="size-5"/>Mã khôi phục</h3>
   <p>Còn <strong>{me.recoveryCodesLeft}</strong> mã dùng được. Tạo lại sẽ cấp 10 mã mới và vô hiệu các mã cũ.</p>
   {askPw
    ? <form onSubmit={regenerate} noValidate className="space-y-3" aria-label="Tạo lại mã khôi phục">
      <Field id="tk-mk-ma" label="Nhập mật khẩu để xác nhận" error={errs.password}>{a => <input {...a} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>
      <ErrorLine message={rc.error}/>
      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" className={ghostCls} onClick={() => { setAskPw(false); setPassword(""); }}>Hủy</button><button type="submit" disabled={rc.pending} className={`${ctaCls} sm:w-auto`}>{rc.pending ? "Đang tạo…" : "Tạo 10 mã mới"}</button></div>
     </form>
    : <button type="button" className={`${ghostCls} w-full sm:w-auto`} onClick={() => setAskPw(true)}>Tạo lại 10 mã khôi phục</button>}
  </div>
 </section>;
}

function SessionButtons({ client, onOut }: { client: ReturnType<typeof createAccountClient>; onOut: () => void }) {
 const { run, pending, error } = useAction();
 return <div className="flex flex-col gap-2 sm:items-end"><div className="flex flex-wrap gap-2">
  <button type="button" className={ghostCls} disabled={pending} onClick={async () => { if ((await run(() => client.logout())).ok) onOut(); }}><LogOut aria-hidden="true" className="size-5"/>Đăng xuất</button>
  <button type="button" className={ghostCls} disabled={pending} onClick={async () => { if ((await run(() => client.logoutAll())).ok) onOut(); }}>Đăng xuất mọi thiết bị</button>
 </div><ErrorLine message={error}/></div>;
}

function Profiles({ client, me, profiles, onChange }: { client: ReturnType<typeof createAccountClient>; me: Me; profiles: Profile[]; onChange: (msg: string) => Promise<void> }) {
 const [adding, setAdding] = useState(false);
 const [editing, setEditing] = useState<Profile | null>(null);
 const [removing, setRemoving] = useState<Profile | null>(null);
 const full = profiles.length >= me.profileLimit;
 return <section className={`${card} space-y-4`} aria-labelledby="tk-ho-so">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="tk-ho-so" className="text-lg font-extrabold">Hồ sơ của con <span className="font-normal text-navy-soft">({profiles.length}/{me.profileLimit})</span></h2>
   {!adding && <button type="button" className={ghostCls} disabled={full} onClick={() => setAdding(true)}><UserPlus aria-hidden="true" className="size-5"/>Thêm hồ sơ</button>}</div>
  {full && <p className="text-sm text-navy-soft">Đã đạt giới hạn hồ sơ. Xóa một hồ sơ để thêm hồ sơ mới.</p>}
  {profiles.length === 0 && !adding && <p>Chưa có hồ sơ nào. Hồ sơ giúp lưu tiến độ của con; luyện tập vẫn dùng được không cần hồ sơ.</p>}
  <ul className="divide-y divide-navy/10" aria-label="Danh sách hồ sơ của con">{profiles.map(p => <li key={p.id} className="flex min-h-14 flex-wrap items-center gap-2 py-2">
   <span className="min-w-0 flex-1 font-bold break-words">{p.nickname}<span className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 text-sm font-semibold text-primary">Lớp {p.grade}</span></span>
   <button type="button" className={ghostCls} aria-label={`Sửa hồ sơ ${p.nickname}`} onClick={() => setEditing(p)}><Pencil aria-hidden="true" className="size-5"/>Sửa</button>
   <button type="button" className={danger} aria-label={`Xóa hồ sơ ${p.nickname}`} onClick={() => setRemoving(p)}><Trash2 aria-hidden="true" className="size-5"/>Xóa</button>
  </li>)}</ul>
  {adding && <CreateProfile client={client} onCancel={() => setAdding(false)} onDone={async () => { setAdding(false); await onChange("Đã tạo hồ sơ."); }}/>}
  <EditDialog client={client} profile={editing} onClose={() => setEditing(null)} onDone={async () => { setEditing(null); await onChange("Đã lưu hồ sơ."); }}/>
  <RemoveDialog client={client} profile={removing} onClose={() => setRemoving(null)} onDone={async () => { setRemoving(null); await onChange("Đã xóa hồ sơ và rút đồng ý."); }}/>
 </section>;
}

function GradeSelect({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
 return <Field id={id} label="Lớp">{a => <select {...a} value={value} onChange={e => onChange(Number(e.target.value))} className={inputCls}>{GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}</select>}</Field>;
}

function CreateProfile({ client, onCancel, onDone }: { client: ReturnType<typeof createAccountClient>; onCancel: () => void; onDone: () => Promise<void> }) {
 const { run, pending, error } = useAction();
 const [nickname, setNickname] = useState(""); const [grade, setGrade] = useState<number>(GRADES[0]);
 const [agree, setAgree] = useState(false);
 const [errs, setErrs] = useState<{ nick?: string; agree?: string }>({});
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  const next = { nick: nickErr(nickname) ?? undefined, agree: agree ? undefined : "Hãy đánh dấu ô đồng ý để tạo hồ sơ." };
  setErrs(next);
  if (next.nick) return document.getElementById("hs-biet-danh")?.focus();
  if (next.agree) return document.getElementById("hs-dong-y")?.focus();
  const res = await run(async () => {
   const t = await client.consentTexts();
   await client.createProfile({ nickname: nickname.trim(), grade, consent: { policyVersion: t.policyVersion, textHash: t.texts.child_progress.textHash } });
  });
  if (res.ok) await onDone();
 }
 return <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border-2 border-navy/20 bg-warm p-4" aria-label="Tạo hồ sơ của con">
  <Field id="hs-biet-danh" label="Biệt danh" hint="Đừng dùng tên thật của con. Dài 2–20 ký tự." error={errs.nick}>{a => <input {...a} autoComplete="off" maxLength={40} value={nickname} onChange={e => setNickname(e.target.value)} className={inputCls}/>}</Field>
  <GradeSelect id="hs-lop" value={grade} onChange={setGrade}/>
  <div><CheckRow id="hs-dong-y" checked={agree} onChange={setAgree} describedBy="hs-dong-y-loi">{CHILD_BEFORE}<strong>{CHILD_BOLD}</strong>{CHILD_AFTER}</CheckRow>
   <p className="ml-9 text-sm font-semibold text-primary">{CHILD_HINT}</p>
   <p id="hs-dong-y-loi" role={errs.agree ? "alert" : undefined} className={errs.agree ? "mt-1 text-sm font-semibold text-red-700" : "sr-only"}>{errs.agree}</p></div>
  <ErrorLine message={error}/>
  <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={ghostCls} onClick={onCancel}>Hủy</button><button type="submit" disabled={pending} className={`${ctaCls} sm:w-auto`}>{pending ? <><Loader2 aria-hidden="true" className="size-5 motion-safe:animate-spin"/>Đang lưu…</> : "Tạo hồ sơ"}</button></div>
 </form>;
}

function EditDialog({ client, profile, onClose, onDone }: { client: ReturnType<typeof createAccountClient>; profile: Profile | null; onClose: () => void; onDone: () => Promise<void> }) {
 return <ConfirmDialog open={!!profile} title="Sửa hồ sơ" onClose={onClose}>{profile && <EditForm key={profile.id} client={client} profile={profile} onClose={onClose} onDone={onDone}/>}</ConfirmDialog>;
}
function EditForm({ client, profile, onClose, onDone }: { client: ReturnType<typeof createAccountClient>; profile: Profile; onClose: () => void; onDone: () => Promise<void> }) {
 const { run, pending, error } = useAction();
 const [nickname, setNickname] = useState(profile.nickname); const [grade, setGrade] = useState(profile.grade);
 const [err, setErr] = useState<string | null>(null);
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  const bad = nickErr(nickname); setErr(bad);
  if (bad) return document.getElementById("sua-biet-danh")?.focus();
  if ((await run(() => client.updateProfile(profile.id, { nickname: nickname.trim(), grade }))).ok) await onDone();
 }
 return <form onSubmit={submit} noValidate className="space-y-4">
  <Field id="sua-biet-danh" label="Biệt danh" error={err}>{a => <input {...a} autoComplete="off" maxLength={40} value={nickname} onChange={e => setNickname(e.target.value)} className={inputCls}/>}</Field>
  <GradeSelect id="sua-lop" value={grade} onChange={setGrade}/>
  <ErrorLine message={error}/>
  <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={ghostCls} onClick={onClose}>Hủy</button><button type="submit" disabled={pending} className={`${ctaCls} sm:w-auto`}>{pending ? "Đang lưu…" : "Lưu"}</button></div>
 </form>;
}

function RemoveDialog({ client, profile, onClose, onDone }: { client: ReturnType<typeof createAccountClient>; profile: Profile | null; onClose: () => void; onDone: () => Promise<void> }) {
 const { run, pending, error } = useAction();
 return <ConfirmDialog open={!!profile} title="Xóa hồ sơ của con?" onClose={onClose}>
  <p>Hồ sơ <strong>{profile?.nickname}</strong> và kết quả đã lưu sẽ bị xóa ngay. Việc này cũng là rút đồng ý lưu dữ liệu của con và không hoàn tác được.</p>
  <ErrorLine message={error}/>
  <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={ghostCls} onClick={onClose}>Giữ lại</button>
   <button type="button" className={dangerSolid} disabled={pending} onClick={async () => { if (profile && (await run(() => client.deleteProfile(profile.id))).ok) await onDone(); }}>{pending ? "Đang xóa…" : "Xóa hồ sơ"}</button></div>
 </ConfirmDialog>;
}

function PasswordSection({ client, me, onDone }: { client: ReturnType<typeof createAccountClient>; me: Me; onDone: (m: string) => void }) {
 const { run, pending, error } = useAction();
 const [current, setCurrent] = useState(""); const [next, setNext] = useState("");
 const [err, setErr] = useState<string | null>(null);
 if (!me.hasPassword) return null;
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (next.length < 10) { setErr("Mật khẩu mới cần ít nhất 10 ký tự."); return document.getElementById("mk-moi")?.focus(); }
  setErr(null);
  if ((await run(() => client.changePassword(current, next))).ok) { setCurrent(""); setNext(""); onDone("Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất."); }
 }
 return <section className={card} aria-labelledby="tk-mat-khau"><form onSubmit={submit} noValidate className="space-y-4"><h2 id="tk-mat-khau" className="flex items-center gap-2 text-lg font-extrabold"><KeyRound aria-hidden="true" className="size-5"/>Đổi mật khẩu</h2>
  <Field id="mk-cu" label="Mật khẩu hiện tại">{a => <input {...a} type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls}/>}</Field>
  <Field id="mk-moi" label="Mật khẩu mới" hint="Ít nhất 10 ký tự." error={err}>{a => <input {...a} type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={inputCls}/>}</Field>
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending || !current} className={`${ctaCls} sm:w-auto`}>{pending ? "Đang lưu…" : "Đổi mật khẩu"}</button></form></section>;
}

function DataSection({ client, me, onDeleted }: { client: ReturnType<typeof createAccountClient>; me: Me; onDeleted: () => void }) {
 const exp = useAction(); const del = useAction();
 const [open, setOpen] = useState(false); const [password, setPassword] = useState("");
 const trigger = useRef<HTMLButtonElement>(null);
 async function download() {
  const res = await exp.run(() => client.exportData());
  if (!res.ok) return;
  const url = URL.createObjectURL(res.value);
  const a = document.createElement("a"); a.href = url; a.download = "beejunior-du-lieu.json"; a.click();
  URL.revokeObjectURL(url);
 }
 return <section className={`${card} space-y-4`} aria-labelledby="tk-du-lieu"><h2 id="tk-du-lieu" className="text-lg font-extrabold">Dữ liệu của bạn</h2>
  <p>Tải về toàn bộ dữ liệu (tài khoản, hồ sơ, kết quả) dạng JSON, hoặc xóa vĩnh viễn tài khoản. Xem thêm <Link className="font-semibold text-primary underline" href={deleteDataPath()}>hướng dẫn xóa dữ liệu</Link>.</p>
  <ErrorLine message={exp.error}/>
  <div className="flex flex-col gap-3 sm:flex-row">
   <button type="button" className={ghostCls} disabled={exp.pending} onClick={download}><Download aria-hidden="true" className="size-5"/>{exp.pending ? "Đang chuẩn bị…" : "Tải dữ liệu"}</button>
   <button ref={trigger} type="button" className={danger} onClick={() => setOpen(true)}><Trash2 aria-hidden="true" className="size-5"/>Xóa tài khoản</button>
  </div>
  <ConfirmDialog open={open} title="Xóa tài khoản vĩnh viễn?" onClose={() => { setOpen(false); setPassword(""); trigger.current?.focus(); }}>
   <p>Tài khoản <strong className="break-all">{me.username}</strong>, mọi hồ sơ của con và kết quả đã lưu sẽ bị xóa và không khôi phục được.</p>
   {me.hasPassword && <Field id="xoa-mat-khau" label="Nhập mật khẩu để xác nhận">{a => <input {...a} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>}
   <ErrorLine message={del.error}/>
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={ghostCls} onClick={() => setOpen(false)}>Giữ tài khoản</button>
    <button type="button" className={dangerSolid} disabled={del.pending || (me.hasPassword && !password)} onClick={async () => { if ((await del.run(() => client.deleteAccount(me.hasPassword ? password : undefined))).ok) onDeleted(); }}>{del.pending ? "Đang xóa…" : "Xóa vĩnh viễn"}</button></div>
  </ConfirmDialog>
 </section>;
}
