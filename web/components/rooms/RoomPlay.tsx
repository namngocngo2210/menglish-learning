"use client";
import { Mascot } from "@/components/art/Mascot";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Clock3, Send } from "lucide-react";
import { SectionedPractice } from "@/components/quiz/SectionedPractice";
import type { OptionKey } from "@/lib/content/types";
import { flattenSections } from "@/lib/quiz/sections";
import { answeredCount, initialPlay, playReducer, toRoomSections } from "@/lib/rooms/play-state";
import { clockOffset, formatClock, milestoneCrossed, MILESTONE_TEXT, remainingMs } from "@/lib/rooms/timer";
import { initialLoad, loadReducer } from "@/lib/rooms/results";
import type { QuizResponse } from "@/lib/rooms/types";
import { btnCta, btnSecondary, card, ConfirmDialog, ErrorLine, LeaveButton, useAction, type RoomScreenProps } from "./ui";

/** Clock chip: server-calibrated, role=timer without per-second live announcements. */
function TimerChip({ room }: Pick<RoomScreenProps, "room">) {
 // Calibrate once on mount: clock skew does not change while the room is open.
 const [offset] = useState(() => clockOffset(room.serverNow, Date.now()));
 const [left, setLeft] = useState<number | null>(() => remainingMs(room.deadlineAt, offset, Date.now()));
 const [note, setNote] = useState("");
 const prev = useRef(left);
 useEffect(() => {
  if (!room.deadlineAt) return;
  const id = setInterval(() => {
   const next = remainingMs(room.deadlineAt, offset, Date.now());
   const m = milestoneCrossed(prev.current, next);
   if (m) setNote(MILESTONE_TEXT[m]);
   prev.current = next; setLeft(next);
  }, 1000);
  return () => clearInterval(id);
 }, [room.deadlineAt, offset]);
 if (left === null) return null;
 return <>
  <p role="timer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-navy bg-warm px-3 font-extrabold tabular-nums"><Clock3 aria-hidden="true" className="size-5"/><span className="sr-only">Thời gian còn lại: </span>{formatClock(left)}</p>
  <span role="status" aria-live="polite" className="sr-only">{note}</span>
 </>;
}

export function RoomPlay({ client, room }: RoomScreenProps) {
 const [load, dispatchLoad] = useReducer(loadReducer<QuizResponse>, initialLoad);
 const [play, dispatch] = useReducer(playReducer, initialPlay);
 const [index, setIndex] = useState(0);
 const [confirm, setConfirm] = useState(false);
 const [saveError, setSaveError] = useState(false);
 const submit = useAction();
 const playRef = useRef(play);
 useEffect(() => { playRef.current = play; });

 const fetchQuiz = useCallback(async () => {
  dispatchLoad({ type: "load" });
  try { const q = await client.quiz(room.code); dispatchLoad({ type: "ok", data: q }); dispatch({ type: "restore", answers: q.answers }); }
  catch (error) { dispatchLoad({ type: "fail", error }); }
 }, [client, room.code]);
 useEffect(() => { void fetchQuiz(); }, [fetchQuiz]);

 const sections = useMemo(() => (load.status === "ready" ? toRoomSections(load.data) : []), [load]);
 const ids = useMemo(() => flattenSections(sections).map(q => q.id), [sections]);

 const save = useCallback(async (id: string, key: OptionKey) => {
  try { await client.putAnswer(room.code, id, key); dispatch({ type: "synced", id, key }); setSaveError(false); }
  catch { setSaveError(true); }
 }, [client, room.code]);
 // Retry unsaved choices every few seconds until the server confirms them.
 useEffect(() => {
  if (!Object.keys(play.unsynced).length) return;
  const id = setTimeout(() => { for (const [q, k] of Object.entries(playRef.current.unsynced)) void save(q, k); }, 3000);
  return () => clearTimeout(id);
 }, [play.unsynced, save]);

 const select = (id: string, key: OptionKey) => { dispatch({ type: "select", id, key }); void save(id, key); };
 const answered = answeredCount(play, ids);
 const unanswered = ids.length - answered;
 const doSubmit = async () => {
  // Store pending choices first; submit is final.
  for (const [q, k] of Object.entries(playRef.current.unsynced)) await save(q, k);
  const ok = await submit.run(async () => { await client.submit(room.code); return true; });
  if (ok) setConfirm(false);
 };

 if (load.status === "error") return <div className={card} data-slot="play"><h1 className="text-2xl font-extrabold">Không tải được đề</h1><div className="mt-3"><ErrorLine message="Không tải được đề thi. Kiểm tra mạng rồi thử lại."/></div><button type="button" className={`${btnCta} mt-4`} onClick={() => void fetchQuiz()}>Thử lại</button></div>;
 if (load.status !== "ready") return <p role="status" className={`${card} flex min-h-32 items-center gap-3`} data-slot="play"><Mascot pose="sleepy" size={64}/>Đang tải đề…</p>;

 const footer = <>
  <TimerChip room={room}/>
  <p role="status" className="inline-flex min-h-11 items-center font-semibold">Đã nộp: {room.submittedCount}/{room.playerCount} người</p>
  <button type="button" className={btnCta} onClick={() => setConfirm(true)}><Send aria-hidden="true" className="size-5"/>Nộp bài</button>
  <LeaveButton client={client} room={room}/>
 </>;
 return <div className="space-y-3" data-slot="play">
  <h1 className="sr-only">Làm bài: {room.settings.test.title ?? "Bài luyện tập nhóm"}</h1>
  {saveError && <p role="alert" className="rounded-xl border-2 border-red-700/40 bg-red-50 p-3 font-semibold text-red-800">Chưa lưu được một số đáp án. Đang tự thử lại…</p>}
  <SectionedPractice sections={sections} answers={play.answers} checked={{}} feedback="none" activeIndex={index} onActiveChange={setIndex} onSelect={select} footer={footer}/>
  <ConfirmDialog open={confirm} title="Nộp bài?" onClose={() => setConfirm(false)}>
   <p>{unanswered > 0 ? `Em còn ${unanswered} câu chưa trả lời. ` : "Em đã trả lời tất cả các câu. "}Sau khi nộp, em không sửa được nữa.</p>
   <ErrorLine message={submit.error}/>
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={btnSecondary} onClick={() => setConfirm(false)}>Làm tiếp</button><button type="button" className={btnCta} disabled={submit.pending} onClick={doSubmit}>{submit.pending ? "Đang nộp…" : "Nộp bài"}</button></div>
  </ConfirmDialog>
 </div>;
}
