"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { createAccountClient } from "@/lib/account/client";
import { ADULT_LABEL, POLICY_LABEL_PREFIX, POLICY_LABEL_SUFFIX, POLICY_LINK_TEXT, TERMS_LINK_TEXT } from "@/lib/account/consent-copy";
import { accountPath, loginPath, registerPath, resetPasswordPath, termsPath } from "@/lib/account/paths";
import { privacyPath } from "@/lib/routes";
import { card, CheckRow, ctaCls, ErrorLine, Field, ghostCls, inputCls, useAction, useUrlToken } from "./kit";

const useClient = () => useState(createAccountClient)[0];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const link = "font-semibold text-primary underline";
const Busy = ({ pending, text }: { pending: boolean; text: string }) => pending ? <><Loader2 aria-hidden="true" className="size-5 motion-safe:animate-spin"/>Đang xử lý…</> : <>{text}</>;

export function RegisterForm() {
 const client = useClient();
 const { run, pending, error } = useAction();
 const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
 const [adult, setAdult] = useState(false); const [policy, setPolicy] = useState(false);
 const [errs, setErrs] = useState<{ email?: string; password?: string; consent?: string }>({});
 const [sent, setSent] = useState(false);
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  const next: typeof errs = {};
  if (!EMAIL_RE.test(email.trim())) next.email = "Hãy nhập email hợp lệ.";
  if (password.length < 10) next.password = "Mật khẩu cần ít nhất 10 ký tự.";
  if (!adult || !policy) next.consent = "Hãy đánh dấu cả hai ô để tiếp tục.";
  setErrs(next);
  if (next.email) return document.getElementById("dk-email")?.focus();
  if (next.password) return document.getElementById("dk-mat-khau")?.focus();
  if (next.consent) return document.getElementById("dk-adult")?.focus();
  const res = await run(async () => {
   const t = await client.consentTexts(); // the server owns the text hash that proves what was shown
   await client.register({ email: email.trim(), password, adult: true, consent: { policyVersion: t.policyVersion, textHash: t.texts.account.textHash } });
  });
  if (res.ok) setSent(true);
 }
 if (sent) return <section className={`${card} space-y-3`} role="status"><MailCheck aria-hidden="true" className="size-8 text-primary"/><h2 className="text-xl font-extrabold">Hãy kiểm tra email</h2><p>Nếu địa chỉ này dùng được, BeeJunior đã gửi một liên kết xác minh (hiệu lực 24 giờ). Mở liên kết đó để kích hoạt tài khoản. Chưa thấy thư? Hãy xem cả mục Spam.</p><p><Link className={link} href={loginPath()}>Đã xác minh? Đăng nhập</Link></p></section>;
 return <form onSubmit={submit} noValidate className={`${card} space-y-5`} aria-label="Đăng ký tài khoản phụ huynh">
  <p>Tài khoản dành cho <strong>cha/mẹ hoặc người giám hộ</strong>. Con em sẽ có hồ sơ riêng chỉ gồm biệt danh và lớp.</p>
  <Field id="dk-email" label="Email của phụ huynh" error={errs.email}>{a => <input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}/>}</Field>
  <Field id="dk-mat-khau" label="Mật khẩu" hint="Ít nhất 10 ký tự, không quá phổ biến." error={errs.password}>{a => <input {...a} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>
  <fieldset aria-describedby="dk-consent-error" className="min-w-0"><legend className="sr-only">Xác nhận và đồng ý</legend>
   <CheckRow id="dk-adult" checked={adult} onChange={setAdult}>{ADULT_LABEL}</CheckRow>
   <CheckRow id="dk-policy" checked={policy} onChange={setPolicy}>{POLICY_LABEL_PREFIX}<Link className={link} href={privacyPath()} target="_blank">{POLICY_LINK_TEXT}</Link> và <Link className={link} href={termsPath()} target="_blank">{TERMS_LINK_TEXT}</Link>{POLICY_LABEL_SUFFIX}</CheckRow>
   <p id="dk-consent-error" role={errs.consent ? "alert" : undefined} className={errs.consent ? "mt-1 text-sm font-semibold text-red-700" : "sr-only"}>{errs.consent}</p>
  </fieldset>
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending} className={ctaCls}><Busy pending={pending} text="Tạo tài khoản"/></button>
  <p className="text-center">Đã có tài khoản? <Link className={link} href={loginPath()}>Đăng nhập</Link></p>
 </form>;
}

export function LoginForm() {
 const client = useClient(); const router = useRouter();
 const { run, pending, error } = useAction();
 const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
 const [errs, setErrs] = useState<{ email?: string; password?: string }>({});
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  const next: typeof errs = {};
  if (!EMAIL_RE.test(email.trim())) next.email = "Hãy nhập email hợp lệ.";
  if (!password) next.password = "Hãy nhập mật khẩu.";
  setErrs(next);
  if (next.email) return document.getElementById("dn-email")?.focus();
  if (next.password) return document.getElementById("dn-mat-khau")?.focus();
  const res = await run(() => client.login(email.trim().toLowerCase(), password));
  if (res.ok) router.replace(accountPath());
 }
 return <form onSubmit={submit} noValidate className={`${card} space-y-5`} aria-label="Đăng nhập">
  <Field id="dn-email" label="Email" error={errs.email}>{a => <input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}/>}</Field>
  <Field id="dn-mat-khau" label="Mật khẩu" error={errs.password}>{a => <input {...a} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending} className={ctaCls}><Busy pending={pending} text="Đăng nhập"/></button>
  <p className="flex flex-col gap-1 text-center sm:flex-row sm:justify-between"><Link className={`${link} inline-flex min-h-11 items-center justify-center`} href={resetPasswordPath()}>Quên mật khẩu?</Link><Link className={`${link} inline-flex min-h-11 items-center justify-center`} href={registerPath()}>Tạo tài khoản mới</Link></p>
 </form>;
}

export function VerifyEmail() {
 const client = useClient(); const router = useRouter();
 const token = useUrlToken();
 const { run, pending, error } = useAction();
 if (token === undefined) return <section className={card} aria-busy="true"><p>Đang tải…</p></section>;
 if (!token) return <section className={`${card} space-y-3`}><p role="alert" className="font-semibold">Liên kết xác minh không hợp lệ hoặc thiếu mã.</p><p>Hãy mở lại liên kết trong email, hoặc <Link className={link} href={registerPath()}>đăng ký lại</Link>.</p></section>;
 const verify = async () => { const res = await run(() => client.verifyEmail(token)); if (res.ok) router.replace(accountPath()); };
 return <section className={`${card} space-y-4`}><p>Nhấn nút bên dưới để xác minh email và kích hoạt tài khoản phụ huynh.</p><ErrorLine message={error}/><button type="button" disabled={pending} onClick={verify} className={ctaCls}><Busy pending={pending} text="Xác minh email"/></button></section>;
}

export function ResetPassword() {
 const client = useClient();
 const token = useUrlToken();
 const { run, pending, error } = useAction();
 const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
 const [err, setErr] = useState<string | undefined>();
 const [done, setDone] = useState<"sent" | "reset" | null>(null);
 if (token === undefined) return <section className={card} aria-busy="true"><p>Đang tải…</p></section>;
 if (done === "sent") return <section className={`${card} space-y-3`} role="status"><MailCheck aria-hidden="true" className="size-8 text-primary"/><h2 className="text-xl font-extrabold">Hãy kiểm tra email</h2><p>Nếu email này đã đăng ký, BeeJunior đã gửi liên kết đặt lại mật khẩu (hiệu lực 1 giờ).</p></section>;
 if (done === "reset") return <section className={`${card} space-y-3`} role="status"><h2 className="text-xl font-extrabold">Đã đặt lại mật khẩu</h2><p>Các thiết bị khác đã bị đăng xuất. Hãy đăng nhập bằng mật khẩu mới.</p><Link className={ctaCls} href={loginPath()}>Đăng nhập</Link></section>;
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (pending) return;
  if (token) {
   if (password.length < 10) { setErr("Mật khẩu cần ít nhất 10 ký tự."); return document.getElementById("dl-mat-khau")?.focus(); }
   setErr(undefined);
   const res = await run(() => client.resetConfirm(token, password));
   if (res.ok) setDone("reset");
  } else {
   if (!EMAIL_RE.test(email.trim())) { setErr("Hãy nhập email hợp lệ."); return document.getElementById("dl-email")?.focus(); }
   setErr(undefined);
   const res = await run(() => client.resetRequest(email.trim().toLowerCase()));
   if (res.ok) setDone("sent");
  }
 }
 return <form onSubmit={submit} noValidate className={`${card} space-y-5`} aria-label={token ? "Đặt mật khẩu mới" : "Quên mật khẩu"}>
  {token
   ? <Field id="dl-mat-khau" label="Mật khẩu mới" hint="Ít nhất 10 ký tự, không quá phổ biến." error={err}>{a => <input {...a} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}/>}</Field>
   : <Field id="dl-email" label="Email đã đăng ký" hint="BeeJunior sẽ gửi liên kết đặt lại mật khẩu." error={err}>{a => <input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}/>}</Field>}
  <ErrorLine message={error}/>
  <button type="submit" disabled={pending} className={ctaCls}><Busy pending={pending} text={token ? "Đặt mật khẩu mới" : "Gửi liên kết"}/></button>
  <Link className={`${ghostCls} w-full`} href={loginPath()}>Quay lại đăng nhập</Link>
 </form>;
}
