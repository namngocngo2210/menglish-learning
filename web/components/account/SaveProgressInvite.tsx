"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createAccountClient, type Profile } from "@/lib/account/client";
import { accountPath, loginPath, registerPath } from "@/lib/account/paths";
import { readAllProgress, type ProgressItem } from "@/lib/progress";
import { card, ctaCls, ErrorLine, Field, ghostCls, inputCls, useAction } from "./kit";

const linkCls = "inline-flex min-h-11 items-center font-semibold text-primary underline";

/** Optional invitation under the test (never inside the question area, never blocks practice). Asks again on every visit. */
export function SaveProgressInvite() {
 const [client] = useState(createAccountClient);
 const [offer, setOffer] = useState<{ profiles: Profile[]; items: ProgressItem[] } | null>(null);
 const [hidden, setHidden] = useState(false);
 const [done, setDone] = useState<number | null>(null);
 const [profileId, setProfileId] = useState("");
 const { run, pending, error } = useAction();
 useEffect(() => {
  let alive = true;
  (async () => {
   const items = readAllProgress();
   if (items.length === 0) return;
   try { await client.me(); const profiles = await client.profiles(); if (alive) { setOffer({ profiles, items }); setProfileId(profiles[0]?.id ?? ""); } } catch { /* not signed in: keep the plain invitation */ }
  })();
  return () => { alive = false; };
 }, [client]);

 if (hidden) return null;
 if (done !== null) return <aside role="status" className={`mt-6 ${card}`}><p className="font-semibold">Đã lưu {done} kết quả vào hồ sơ. <Link className={linkCls} href={accountPath()}>Xem tài khoản</Link></p></aside>;
 if (offer) return <aside aria-labelledby="luu-tien-do" className="mt-6 space-y-3 rounded-2xl border-2 border-navy/20 bg-sky-soft p-5">
  <h2 id="luu-tien-do" className="text-lg font-bold">Lưu tiến độ</h2>
  {offer.profiles.length === 0
   ? <p>Trên thiết bị này có {offer.items.length} kết quả luyện tập. <Link className={linkCls} href={accountPath()}>Tạo hồ sơ cho con</Link> để lưu chúng.</p>
   : <>
    <p>Trên thiết bị này có {offer.items.length} kết quả luyện tập. Phụ huynh có muốn lưu chúng vào hồ sơ của con không? Chỉ lưu khi bạn đồng ý; kết quả trên thiết bị vẫn được giữ nguyên.</p>
    <Field id="luu-ho-so" label="Hồ sơ của con">{a => <select {...a} value={profileId} onChange={e => setProfileId(e.target.value)} className={inputCls}>{offer.profiles.map(p => <option key={p.id} value={p.id}>{p.nickname} (Lớp {p.grade})</option>)}</select>}</Field>
    <div className="flex flex-wrap gap-3">
     <button type="button" className={ctaCls} disabled={pending || !profileId} onClick={async () => { const r = await run(() => client.importProgress(profileId, offer.items)); if (r.ok) setDone(r.value.imported); }}>Lưu vào hồ sơ</button>
     <button type="button" className={ghostCls} disabled={pending} onClick={() => setHidden(true)}>Không, cảm ơn</button>
    </div>
    <ErrorLine message={error}/>
   </>}
 </aside>;
 return <aside aria-labelledby="luu-tien-do" className="mt-6 space-y-2 rounded-2xl border-2 border-navy/20 bg-sky-soft p-5">
  <h2 id="luu-tien-do" className="text-lg font-bold">Lưu tiến độ</h2>
  <p>Phụ huynh có thể tạo tài khoản để lưu tiến độ của con và xem lại trên nhiều thiết bị. Không bắt buộc — em vẫn luyện tập bình thường.</p>
  <p className="flex flex-wrap gap-x-5"><Link className={linkCls} href={registerPath()}>Tạo tài khoản phụ huynh</Link><Link className={linkCls} href={loginPath()}>Đăng nhập</Link></p>
 </aside>;
}
