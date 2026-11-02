"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { accountErrorMessage } from "@/lib/account/messages";

export { ErrorLine, ConfirmDialog, card } from "@/components/rooms/ui";
export { Field, FieldError, inputCls, ctaCls, ghostCls } from "@/components/rooms/fields";

/** Runs one API call at a time and keeps a readable Vietnamese error for role="alert". */
export function useAction() {
 const [pending, setPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const alive = useRef(true);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
  setPending(true); setError(null);
  try { return { ok: true, value: await fn() }; }
  catch (e) { if (alive.current) setError(accountErrorMessage(e)); return { ok: false }; }
  finally { if (alive.current) setPending(false); }
 }, []);
 return { run, pending, error, setError };
}

/** Native checkbox with a 44px row; the label may contain links. */
export function CheckRow({ id, checked, onChange, children, describedBy }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; describedBy?: string }) {
 return <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
  <input id={id} type="checkbox" checked={checked} aria-describedby={describedBy} onChange={e => onChange(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy"/>
  <span>{children}</span>
 </label>;
}

/** Reads and strips ?token= so the one-time token does not stay in the address bar or history. */
export function useUrlToken(): string | null | undefined {
 const [token, setToken] = useState<string | null | undefined>(undefined);
 useEffect(() => {
  const t = new URLSearchParams(window.location.search).get("token");
  if (t) window.history.replaceState(null, "", window.location.pathname);
  setToken(t); // eslint-disable-line react-hooks/set-state-in-effect -- window is only readable after mount
 }, []);
 return token;
}
