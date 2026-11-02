"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { createAccountClient } from "@/lib/account/client";
import { ADULT_LABEL, POLICY_LABEL_PREFIX, POLICY_LABEL_SUFFIX, POLICY_LINK_TEXT, TERMS_LINK_TEXT } from "@/lib/account/consent-copy";
import { accountPath, loginPath, registerPath, resetPasswordPath, termsPath } from "@/lib/account/paths";
import { privacyPath } from "@/lib/routes";
import { ChoiceGroup } from "@/components/rooms/fields";
import { card, CheckRow, ctaCls, ErrorLine, Field, ghostCls, inputCls, useAction, useUrlToken } from "./kit";
import { RecoveryCodes } from "./RecoveryCodes";
import { Turnstile, turnstileOn } from "./Turnstile";

const useClient = () => useState(createAccountClient)[0];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;
export const USERNAME_HINT = "3–20 ký tự: chữ thường a-z, số 0-9, dấu . _ -. Đừng dùng tên thật của bé.";
const link = "font-semibold text-primary underline";
const Busy = ({ pending, text }: { pending: boolean; text: string }) => pending ? <><Loader2 aria-hidden="true" className="size-5 motion-safe:animate-spin"/>Đang xử lý…</> : <>{text}</>;
const NO_RECOVERY = "Nếu không có email đã xác minh và không còn mã khôi phục, BeeJunior không thể khôi phục tài khoản.";

export function RegisterForm() {
 const client = useClient(); const router = useRouter();
 const { run, pending, error } = useAction();
 const [username, setUsername] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
 const [adult, setAdult] = useState(false); const [policy, setPolicy] = useState(false);
 const [captcha, setCaptcha] = useState<string | undefined>();
 const [errs, setErrs] = useState<{ username?: string; email?: string; password?: string; consent?: string; captcha?: string }>({});
 const [result, setResult] = useState<{ codes: string[]; emailPending: boolean; mailUnavailable: boolean } | null>(null);
 const [codesDone, setCodesDone] = useState(false);
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  const next: typeof errs = {};
  const name = username.trim().toLowerCase();
  if (!USERNAME_RE.test(name)) next.username = "Tên đăng nhập dài 3–20 ký tự, chỉ gồm a-z, 0-9, dấu . _ -.";
  if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = "Email chưa hợp lệ. Bạn có thể để trống.";
  if (password.length < 10) next.password = "Mật khẩu cần ít nhất 10 ký tự.";
  if (!adult || !policy) next.consent = "Hãy đánh dấu cả hai ô để tiếp tục.";
  if (turnstileOn && !captcha) next.captcha = "Hãy hoàn tất bước xác nhận bên dưới.";
  setErrs(next);
  if (next.username) return document.getElementById("dk-ten")?.focus();
  if (next.email) return document.getElementById("dk-email")?.focus();
  if (next.password) return document.getElementById("dk-mat-khau")?.focus();
  if (next.consent) return document.getElementById("dk-adult")?.focus();
  if (next.captcha) return;
  const res = await run(async () => {
   const t = await client.consentTexts(); // the server owns the text hash that proves what was shown
   return client.register({ username: name, password, ...(email.trim() ? { email: email.trim() } : {}), adult: true, consent: { policyVersion: t.policyVersion, textHash: t.texts.account.textHash }, ...(captcha ? { captchaToken: captcha } : {}) });
  });
  if (res.ok) { setResult({ codes: res.value.recoveryCodes, emailPending: res.value.emailPending, mailUnavailable: res.value.mailUnavailable === true }); setPassword(""); }
 }
 if (result && !codesDone) return <RecoveryCodes codes={result.codes} doneLabel="Tôi đã lưu" onDone={() => { if (result.emailPending || result.mailUnavailable) { setResult({ ...result, codes: [] }); setCodesDone(true); } else router.replace(accountPath()); }}/>;
 if (result?.mailUnavailable) return <section className={`${card} space-y-3`} role="status"><h2 className="text-xl font-extrabold">Chưa gửi được email xác minh lúc này</h2><p>Tài khoản đã được tạo. BeeJunior chưa gửi được email xác minh lúc này nên email chưa được lưu. Bạn vẫn dùng được tài khoản, và có thể thêm lại email trong trang Tài khoản sau.</p><Link className={ctaCls} href={accountPath()}>Vào tài khoản</Link></section>;
 if (result) return <section className={`${card} space-y-3`} role="status"><MailCheck aria-hidden="true" className="size-8 text-primary"/><h2 className="text-xl font-extrabold">Hãy kiểm tra email</h2><p>BeeJunior đã gửi một liên kết xác minh (hiệu lực 24 giờ). Mở liên kết đó để xác minh email; sau đó bạn có thể dùng email để đặt lại mật khẩu.</p><Link className={ctaCls} href={accountPath()}>Vào tài khoản</Link></section>;
 return <form onSubmit={submit} noValidate className={`${card} space-y-5`} aria-label="Đăng ký tài khoản phụ huynh">
  <p>Tài khoản dành cho <strong>cha/mẹ hoặc người giám hộ</strong>. Con em sẽ có hồ sơ riêng chỉ gồm biệt danh và lớp.</p>
  <Field id="dk-ten" label="Tên đăng nhập" hint={USERNAME_HINT} error={errs.username}>{a => <input {...a} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} value={username} onChange={e => setUsername(e.target.value)} className={inputCls}/>}</Field>
  <Field id="dk-mat-khau" label="Mật khẩu" hint="Ít nhất 10 ký tự, không quá phổ biến." error={errs.password}>{a => <input {...a} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>
  <Field id="dk-email" label="Email (không bắt buộc)" hint="Nên thêm email để khôi phục mật khẩu khi quên. Nếu bỏ trống, bạn chỉ khôi phục được bằng mã khôi phục." error={errs.email}>{a => <input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}/>}</Field>
  <fieldset aria-describedby="dk-consent-error" className="min-w-0"><legend className="sr-only">Xác nhận và đồng ý</legend>
   <CheckRow id="dk-adult" checked={adult} onChange={setAdult}>{ADULT_LABEL}</CheckRow>
   <CheckRow id="dk-policy" checked={policy} onChange={setPolicy}>{POLICY_LABEL_PREFIX}<Link className={link} href={privacyPath()} target="_blank">{POLICY_LINK_TEXT}</Link> và <Link className={link} href={termsPath()} target="_blank">{TERMS_LINK_TEXT}</Link>{POLICY_LABEL_SUFFIX}</CheckRow>
   <p id="dk-consent-error" role={errs.consent ? "alert" : undefined} className={errs.consent ? "mt-1 text-sm font-semibold text-red-700" : "sr-only"}>{errs.consent}</p>
  </fieldset>
  <Turnstile onToken={setCaptcha}/>
  {errs.captcha && <p role="alert" className="text-sm font-semibold text-red-700">{errs.captcha}</p>}
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending} className={ctaCls}><Busy pending={pending} text="Tạo tài khoản"/></button>
  <p className="text-center">Đã có tài khoản? <Link className={`${link} inline-flex min-h-11 items-center`} href={loginPath()}>Đăng nhập</Link></p>
 </form>;
}

export function LoginForm() {
 const client = useClient(); const router = useRouter();
 const { run, pending, error } = useAction();
 const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
 const [errs, setErrs] = useState<{ username?: string; password?: string }>({});
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  const next: typeof errs = {};
  if (!username.trim()) next.username = "Hãy nhập tên đăng nhập.";
  if (!password) next.password = "Hãy nhập mật khẩu.";
  setErrs(next);
  if (next.username) return document.getElementById("dn-ten")?.focus();
  if (next.password) return document.getElementById("dn-mat-khau")?.focus();
  const res = await run(() => client.login(username.trim().toLowerCase(), password));
  if (res.ok) router.replace(accountPath());
 }
 return <form onSubmit={submit} noValidate className={`${card} space-y-5`} aria-label="Đăng nhập">
  <Field id="dn-ten" label="Tên đăng nhập" error={errs.username}>{a => <input {...a} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} className={inputCls}/>}</Field>
  <Field id="dn-mat-khau" label="Mật khẩu" error={errs.password}>{a => <input {...a} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending} className={ctaCls}><Busy pending={pending} text="Đăng nhập"/></button>
  <p className="flex flex-col gap-1 text-center sm:flex-row sm:justify-between"><Link className={`${link} inline-flex min-h-11 items-center justify-center`} href={resetPasswordPath()}>Quên mật khẩu?</Link><Link className={`${link} inline-flex min-h-11 items-center justify-center`} href={registerPath()}>Tạo tài khoản mới</Link></p>
 </form>;
}

/** Verifies the email only: the API no longer opens a session from this link. */
export function VerifyEmail() {
 const client = useClient();
 const token = useUrlToken();
 const { run, pending, error } = useAction();
 const [done, setDone] = useState(false);
 if (token === undefined) return <section className={card} aria-busy="true"><p>Đang tải…</p></section>;
 if (done) return <section className={`${card} space-y-3`} role="status"><h2 className="text-xl font-extrabold">Đã xác minh email</h2><p>Bây giờ bạn có thể dùng email này để đặt lại mật khẩu.</p><div className="flex flex-col gap-3 sm:flex-row"><Link className={ctaCls} href={loginPath()}>Đăng nhập</Link><Link className={ghostCls} href={accountPath()}>Vào tài khoản</Link></div></section>;
 if (!token) return <section className={`${card} space-y-3`}><p role="alert" className="font-semibold">Liên kết xác minh không hợp lệ hoặc thiếu mã.</p><p>Hãy mở lại liên kết trong email, hoặc vào <Link className={link} href={accountPath()}>Tài khoản</Link> để gửi lại.</p></section>;
 const verify = async () => { if ((await run(() => client.verifyEmail(token))).ok) setDone(true); };
 return <section className={`${card} space-y-4`}><p>Nhấn nút bên dưới để xác minh email của tài khoản BeeJunior.</p><ErrorLine message={error}/><button type="button" disabled={pending} onClick={verify} className={ctaCls}><Busy pending={pending} text="Xác minh email"/></button></section>;
}

type ResetMode = "email" | "recovery";

export function ResetPassword() {
 const client = useClient();
 const token = useUrlToken();
 const { run, pending, error, setError } = useAction();
 const [mode, setMode] = useState<ResetMode>("email");
 const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
 const [username, setUsername] = useState(""); const [code, setCode] = useState("");
 const [errs, setErrs] = useState<{ email?: string; username?: string; code?: string; password?: string }>({});
 const [done, setDone] = useState<"sent" | "reset" | null>(null);
 if (token === undefined) return <section className={card} aria-busy="true"><p>Đang tải…</p></section>;
 if (done === "sent") return <section className={`${card} space-y-3`} role="status"><MailCheck aria-hidden="true" className="size-8 text-primary"/><h2 className="text-xl font-extrabold">Hãy kiểm tra email</h2><p>Nếu email này đã được xác minh cho một tài khoản, BeeJunior đã gửi liên kết đặt lại mật khẩu (hiệu lực 1 giờ).</p></section>;
 if (done === "reset") return <section className={`${card} space-y-3`} role="status"><h2 className="text-xl font-extrabold">Đã đặt lại mật khẩu</h2><p>Các thiết bị khác đã bị đăng xuất. Hãy đăng nhập bằng mật khẩu mới.</p><Link className={ctaCls} href={loginPath()}>Đăng nhập</Link></section>;
 const effective: ResetMode | "token" = token ? "token" : mode;
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  const next: typeof errs = {};
  if (effective !== "email" && password.length < 10) next.password = "Mật khẩu cần ít nhất 10 ký tự.";
  if (effective === "email" && !EMAIL_RE.test(email.trim())) next.email = "Hãy nhập email hợp lệ.";
  if (effective === "recovery") {
   if (!username.trim()) next.username = "Hãy nhập tên đăng nhập.";
   if (!code.trim()) next.code = "Hãy nhập một mã khôi phục.";
  }
  setErrs(next);
  const ids = { email: "dl-email", username: "dl-ten", code: "dl-code", password: "dl-mat-khau" } as const;
  const first = (["email", "username", "code", "password"] as const).find(k => next[k]);
  if (first) return document.getElementById(ids[first])?.focus();
  if (effective === "token") { if ((await run(() => client.resetConfirm(token!, password))).ok) setDone("reset"); }
  else if (effective === "recovery") { if ((await run(() => client.resetWithRecovery(username.trim().toLowerCase(), code.trim(), password))).ok) setDone("reset"); }
  else if ((await run(() => client.resetRequest(email.trim().toLowerCase()))).ok) setDone("sent");
 }
 const pwField = <Field id="dl-mat-khau" label="Mật khẩu mới" hint="Ít nhất 10 ký tự, không quá phổ biến." error={errs.password}>{a => <input {...a} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>;
 return <form onSubmit={submit} noValidate className={`${card} space-y-5`} aria-label={token ? "Đặt mật khẩu mới" : "Quên mật khẩu"}>
  {effective === "token" ? pwField : <>
   <ChoiceGroup legend="Bạn muốn khôi phục bằng cách nào?" name="dl-cach" value={mode} onChange={v => { setMode(v); setErrs({}); setError(null); }} options={[{ value: "email", label: "Bằng email (đã xác minh)" }, { value: "recovery", label: "Bằng mã khôi phục" }]}/>
   {mode === "email"
    ? <Field id="dl-email" label="Email đã xác minh" hint="BeeJunior sẽ gửi liên kết đặt lại mật khẩu. Chỉ email đã được xác minh mới nhận được thư." error={errs.email}>{a => <input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}/>}</Field>
    : <>
     <Field id="dl-ten" label="Tên đăng nhập" error={errs.username}>{a => <input {...a} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} className={inputCls}/>}</Field>
     <Field id="dl-code" label="Mã khôi phục" hint="Mỗi mã chỉ dùng được một lần." error={errs.code}>{a => <input {...a} type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono`}/>}</Field>
     {pwField}
    </>}
   <p className="text-sm text-navy-soft">{NO_RECOVERY}</p>
  </>}
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending} className={ctaCls}><Busy pending={pending} text={effective === "email" ? "Gửi liên kết" : "Đặt mật khẩu mới"}/></button>
  <Link className={`${ghostCls} w-full`} href={loginPath()}>Quay lại đăng nhập</Link>
 </form>;
}
