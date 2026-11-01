"use client";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export const inputCls = "min-h-11 w-full rounded-xl border-2 border-navy/30 bg-white px-3 text-base text-navy placeholder:text-navy-soft/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy aria-[invalid=true]:border-red-700";
export const ctaCls = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta px-5 font-bold text-navy no-underline hover:bg-cta-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60";
export const ghostCls = "inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-navy/30 bg-white px-4 font-semibold text-navy no-underline hover:bg-warm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy";

/** Inline field error. Always rendered (empty when fine) so assistive tech announces changes. */
export function FieldError({ id, message }: { id: string; message?: string | null }) {
 return <p id={id} role={message ? "alert" : undefined} className={message ? "mt-1 flex items-start gap-1.5 text-sm font-semibold text-red-700" : "sr-only"}>
  {message && <><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0"/><span>{message}</span></>}
 </p>;
}

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: (aria: { id: string; "aria-describedby": string; "aria-invalid": boolean }) => ReactNode }) {
 const describedBy = [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(" ");
 return <div>
  <label htmlFor={id} className="block font-semibold">{label}</label>
  {hint && <p id={`${id}-hint`} className="text-sm text-navy-soft">{hint}</p>}
  <div className="mt-1.5">{children({ id, "aria-describedby": describedBy, "aria-invalid": !!error })}</div>
  <FieldError id={`${id}-error`} message={error}/>
 </div>;
}

/** Radio group using native radios, shown as 44px chips. */
export function ChoiceGroup<T extends string | number | null>({ legend, name, value, options, onChange, hint, error, errorId }: {
 legend: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: string; error?: string | null; errorId?: string;
}) {
 return <fieldset aria-describedby={errorId} className="min-w-0">
  <legend className="font-semibold">{legend}</legend>
  {hint && <p className="text-sm text-navy-soft">{hint}</p>}
  <div className="mt-1.5 flex flex-wrap gap-2">
   {options.map(o => <label key={String(o.value)} className="relative cursor-pointer">
    <input type="radio" name={name} className="peer sr-only" checked={value === o.value} onChange={() => onChange(o.value)}/>
    <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-navy/30 bg-white px-4 font-semibold peer-checked:border-navy peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy">{o.label}</span>
   </label>)}
  </div>
  {errorId && <FieldError id={errorId} message={error}/>}
 </fieldset>;
}
