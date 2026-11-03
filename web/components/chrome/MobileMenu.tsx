"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Hamburger + simple sheet; children are the server-rendered links. Closes on route change, Escape and outside click. */
export function MobileMenu({ children }: { children: ReactNode }) {
 const [open, setOpen] = useState(false);
 const pathname = usePathname();
 const root = useRef<HTMLDivElement>(null);
 const button = useRef<HTMLButtonElement>(null);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet after navigation
 useEffect(() => { setOpen(false); }, [pathname]);
 useEffect(() => {
  if (!open) return;
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
  const click = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
  document.addEventListener("keydown", key); document.addEventListener("mousedown", click);
  return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
 }, [open]);
 const Icon = open ? X : Menu;
 return <div ref={root} className="md:hidden">
  <button ref={button} type="button" aria-expanded={open} aria-controls="menu-di-dong" aria-label="Menu" onClick={() => setOpen(!open)} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-primary text-primary hover:bg-warm"><Icon aria-hidden="true" className="size-5"/></button>
  {open && <div id="menu-di-dong" className="absolute inset-x-0 top-full z-30 border-b border-navy-soft/20 bg-surface px-5 py-2 shadow-lg"><ul className="flex flex-col [&_a]:w-full [&_button]:w-full">{children}</ul></div>}
 </div>;
}
