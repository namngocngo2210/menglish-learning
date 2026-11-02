"use client";
import { useState } from "react";
import { Copy, Download, Printer } from "lucide-react";
import { card, CheckRow, ctaCls, ghostCls } from "./kit";

const toText = (codes: string[]) => `Mã khôi phục tài khoản BeeJunior (mỗi mã dùng một lần)\n\n${codes.join("\n")}\n`;

/** Shows one-time recovery codes. Codes live only in React state: never written to storage, cookies or logs. */
export function RecoveryCodes({ codes, doneLabel, onDone }: { codes: string[]; doneLabel: string; onDone: () => void }) {
 const [saved, setSaved] = useState(false);
 const [note, setNote] = useState("");
 function download() {
  const url = URL.createObjectURL(new Blob([toText(codes)], { type: "text/plain" }));
  const a = document.createElement("a"); a.href = url; a.download = "beejunior-ma-khoi-phuc.txt"; a.click();
  URL.revokeObjectURL(url);
 }
 function print() {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return setNote("Trình duyệt chặn cửa sổ in. Hãy tải file .txt hoặc sao chép các mã.");
  const pre = w.document.createElement("pre"); pre.style.fontSize = "18px"; pre.textContent = toText(codes);
  w.document.title = "Mã khôi phục BeeJunior"; w.document.body.appendChild(pre); w.print();
 }
 async function copy() {
  try { await navigator.clipboard.writeText(toText(codes)); setNote("Đã sao chép các mã."); }
  catch { setNote("Không sao chép được. Hãy tải file .txt."); }
 }
 return <section className={`${card} space-y-4`} aria-labelledby="mkp-tieu-de">
  <h2 id="mkp-tieu-de" className="text-xl font-extrabold">Lưu mã khôi phục của bạn</h2>
  <p className="rounded-xl border-2 border-red-700/40 bg-red-50 p-3 font-semibold text-red-900">Các mã này chỉ hiện đúng một lần. Nếu bạn quên mật khẩu mà không có email đã xác minh và không còn mã nào, BeeJunior KHÔNG thể khôi phục tài khoản. BeeJunior không dùng câu hỏi bảo mật.</p>
  <ul aria-label="10 mã khôi phục" className="grid grid-cols-1 gap-2 font-mono text-lg font-bold sm:grid-cols-2">{codes.map(c => <li key={c} className="rounded-lg bg-warm px-3 py-2 select-all">{c}</li>)}</ul>
  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
   <button type="button" className={ghostCls} onClick={download}><Download aria-hidden="true" className="mr-2 size-5"/>Tải .txt</button>
   <button type="button" className={ghostCls} onClick={print}><Printer aria-hidden="true" className="mr-2 size-5"/>In</button>
   <button type="button" className={ghostCls} onClick={copy}><Copy aria-hidden="true" className="mr-2 size-5"/>Sao chép</button>
  </div>
  <p role="status" className="min-h-5 text-sm font-semibold text-primary">{note}</p>
  <CheckRow id="mkp-da-luu" checked={saved} onChange={setSaved}>Tôi đã lưu các mã này ở nơi an toàn.</CheckRow>
  <button type="button" disabled={!saved} onClick={onDone} className={ctaCls}>{doneLabel}</button>
 </section>;
}
