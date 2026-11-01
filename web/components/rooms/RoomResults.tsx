"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { BookOpen, Flag, RotateCcw, Trophy } from "lucide-react";
import { duelHeadline, hasTies, initialLoad, isSharedRank, loadReducer, REPORT_REASONS, reviewStatus, reviewSummary } from "@/lib/rooms/results";
import type { ReportReason, ResultsResponse, ReviewItem } from "@/lib/rooms/types";
import { btnCta, btnSecondary, card, ConfirmDialog, ErrorLine, LeaveButton, useAction, type RoomScreenProps } from "./ui";

function Review({ client, code }: { client: RoomScreenProps["client"]; code: string }) {
 const [state, dispatch] = useReducer(loadReducer<ReviewItem[]>, initialLoad);
 const [open, setOpen] = useState(false);
 const load = useCallback(async () => {
  dispatch({ type: "load" });
  try { dispatch({ type: "ok", data: await client.review(code) }); } catch (error) { dispatch({ type: "fail", error }); }
 }, [client, code]);
 const sum = state.status === "ready" ? reviewSummary(state.data) : null;
 return <section className={card} aria-labelledby="review-title">
  <h2 id="review-title" className="text-xl font-bold">Xem lại bài của em</h2>
  {!open && <button type="button" className={`${btnSecondary} mt-3`} onClick={() => { setOpen(true); void load(); }}><BookOpen aria-hidden="true" className="size-5"/>Xem đáp án và lời giải</button>}
  {open && state.status === "loading" && <p role="status" className="mt-3">Đang tải…</p>}
  {open && state.status === "error" && <div className="mt-3"><ErrorLine message="Không tải được phần xem lại."/><button type="button" className={`${btnSecondary} mt-2`} onClick={() => void load()}>Thử lại</button></div>}
  {sum && state.status === "ready" && <>
   <p className="mt-2 font-semibold">Đúng {sum.correct} · Sai {sum.wrong} · Bỏ trống {sum.blank}</p>
   <ol className="mt-3 space-y-4">{state.data.map((it, i) => { const st = reviewStatus(it); return <li key={it.questionId} className="rounded-xl border-2 border-navy/20 p-4">
    <p className="font-bold text-primary">Câu {i + 1} · {st === "correct" ? "Đúng" : st === "wrong" ? "Sai" : "Bỏ trống"}</p>
    <p lang="en" className="mt-1 font-semibold">{it.stem}</p>
    <ul className="mt-2 space-y-1">{it.options.map(o => <li key={o.key} lang="en" className={`rounded-lg px-3 py-1 ${o.key === it.correctKey ? "bg-green-100 font-bold" : o.key === it.selectedKey ? "bg-red-50 font-bold" : ""}`}>{o.key}. {o.text}{o.key === it.correctKey && " (đáp án đúng)"}{o.key === it.selectedKey && " (em chọn)"}</li>)}</ul>
    {it.explanation && <p className="mt-2 text-navy-soft">{it.explanation}</p>}
   </li>; })}</ol>
  </>}
 </section>;
}

function ReportButton({ client, code }: { client: RoomScreenProps["client"]; code: string }) {
 const [open, setOpen] = useState(false);
 const [reason, setReason] = useState<ReportReason | "">("");
 const [sent, setSent] = useState(false);
 const trigger = useRef<HTMLButtonElement>(null);
 const act = useAction();
 const send = async () => { if (!reason) return; const ok = await act.run(async () => { await client.report(code, reason); return true; }); if (ok) { setSent(true); setOpen(false); } };
 return <>
  <button ref={trigger} type="button" className={btnSecondary} disabled={sent} onClick={() => setOpen(true)}><Flag aria-hidden="true" className="size-5"/>{sent ? "Đã gửi báo cáo" : "Báo cáo"}</button>
  <ConfirmDialog open={open} title="Báo cáo ẩn danh" onClose={() => { setOpen(false); trigger.current?.focus(); }}>
   <fieldset className="space-y-2"><legend className="mb-2">Chọn một lý do. Báo cáo không kèm tên và không có chữ tự do.</legend>
    {REPORT_REASONS.map(r => <label key={r.value} className="flex min-h-11 items-center gap-3 font-semibold"><input type="radio" name="report" className="size-5 accent-primary" checked={reason === r.value} onChange={() => setReason(r.value)}/>{r.label}</label>)}
   </fieldset>
   <ErrorLine message={act.error}/>
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={btnSecondary} onClick={() => setOpen(false)}>Hủy</button><button type="button" className={btnCta} disabled={!reason || act.pending} onClick={send}>Gửi báo cáo</button></div>
  </ConfirmDialog>
 </>;
}

export function RoomResults({ client, room }: RoomScreenProps) {
 const [state, dispatch] = useReducer(loadReducer<ResultsResponse>, initialLoad);
 const act = useAction();
 const load = useCallback(async () => {
  dispatch({ type: "load" });
  try { dispatch({ type: "ok", data: await client.results(room.code) }); } catch (error) { dispatch({ type: "fail", error }); }
 }, [client, room.code]);
 useEffect(() => { void load(); }, [load]);

 if (state.status === "error") return <div className={card} data-slot="results"><h1 className="text-2xl font-extrabold">Không tải được kết quả</h1><div className="mt-3"><ErrorLine message="Không tải được kết quả. Em thử lại nhé."/></div><button type="button" className={`${btnCta} mt-4`} onClick={() => void load()}>Thử lại</button></div>;
 if (state.status !== "ready") return <p role="status" className={card} data-slot="results">Đang tải kết quả…</p>;
 const r = state.data;
 const opponentLeft = r.ranking.some(x => !x.isMe && x.note === "left");
 return <div className="space-y-5" data-slot="results">
  <section className={card} aria-labelledby="res-title">
   <h1 id="res-title" className="flex items-center gap-2 text-2xl font-extrabold"><Trophy aria-hidden="true" className="size-6"/>{r.duel ? duelHeadline(r.duel, opponentLeft) : "Kết quả"}</h1>
   <p className="mt-2 text-lg font-bold">Em đúng {r.me.correct}/{r.me.total} câu · hạng {r.me.rank}</p>
   {hasTies(r.ranking) && <p className="text-navy-soft">Bằng điểm: xếp chung hạng.</p>}
   <ol className="mt-4 divide-y divide-navy/10" aria-label="Bảng xếp hạng">
    {r.ranking.map(row => <li key={row.playerId} className={`flex min-h-14 flex-wrap items-center gap-3 py-2 ${row.isMe ? "bg-warm font-extrabold" : ""}`}>
     <span className="w-20 shrink-0 font-bold">Hạng {row.rank}{isSharedRank(r.ranking, row) && <span className="block text-sm font-semibold">chung hạng</span>}</span>
     <span className="min-w-0 flex-1">{row.name}{row.isMe && " (Bạn)"}{row.note === "left" && <span className="ml-2 text-sm font-semibold text-navy-soft">đã rời phòng</span>}</span>
     <span className="font-bold tabular-nums">{row.correct}/{row.total} · {row.percent}%</span>
    </li>)}
   </ol>
   <div className="mt-5"><ErrorLine message={act.error}/></div>
   <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    {room.me.isHost ? <button type="button" className={btnCta} disabled={act.pending} onClick={() => void act.run(() => client.rematch(room.code))}><RotateCcw aria-hidden="true" className="size-5"/>Chơi lại</button> : <p className="inline-flex min-h-11 items-center font-semibold text-navy-soft">Chờ chủ phòng bấm Chơi lại…</p>}
    <ReportButton client={client} code={room.code}/>
    <LeaveButton client={client} room={room}/>
   </div>
  </section>
  <Review client={client} code={room.code}/>
 </div>;
}
