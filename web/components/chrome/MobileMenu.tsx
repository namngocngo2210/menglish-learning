"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { GRADES, gradePath, aboutPath, privacyPath, contactPath } from "@/lib/routes";
import { NavLink } from "./NavLink";

export function MobileMenu() {
 const pathname = usePathname();
 return <MobileMenuPanel key={pathname}/>;
}

function MobileMenuPanel() {
 const [open, setOpen] = useState(false);
 const root = useRef<HTMLDivElement>(null);
 const button = useRef<HTMLButtonElement>(null);
 const panel = useRef<HTMLElement>(null);
 function close(restoreFocus = false) {
  setOpen(false);
  if (restoreFocus) button.current?.focus();
 }
 useEffect(() => {
  if (!open) return;
  const links = () => Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
  links()[0]?.focus();
  function onKeyDown(event: KeyboardEvent) {
   if (event.key === "Escape") {
    event.preventDefault();
    setOpen(false);
    button.current?.focus();
   }
   if (event.key === "Tab") {
    const items = links();
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
     event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
     event.preventDefault(); first?.focus();
    }
   }
  }
  function onPointerDown(event: PointerEvent) {
   if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
  }
  const desktop = window.matchMedia("(min-width: 1024px)");
  function onResize(event: MediaQueryListEvent) { if (event.matches) setOpen(false); }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerdown", onPointerDown);
  desktop.addEventListener("change", onResize);
  return () => {
   document.removeEventListener("keydown", onKeyDown);
   document.removeEventListener("pointerdown", onPointerDown);
   desktop.removeEventListener("change", onResize);
  };
 }, [open]);
 const linkClass = "flex min-h-11 items-center rounded-xl px-3 font-medium text-navy! hover:bg-warm aria-[current=page]:bg-warm aria-[current=page]:text-primary!";
 return <div ref={root} className="shrink-0 lg:hidden">
  <button ref={button} type="button" aria-label={open ? "Đóng menu" : "Mở menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => open ? close(true) : setOpen(true)} className="flex size-11 items-center justify-center rounded-xl border border-navy-soft/20 text-navy hover:bg-warm">{open ? <X aria-hidden="true" className="size-5"/> : <Menu aria-hidden="true" className="size-5"/>}</button>
  <nav ref={panel} id="mobile-navigation" hidden={!open} aria-label="Điều hướng di động" className="absolute inset-x-0 top-full max-h-[70dvh] overflow-y-auto overscroll-contain border-b border-navy-soft/20 bg-surface px-5 py-5 shadow-lg sm:px-8" onClick={event => { if (event.target instanceof Element && event.target.closest("a")) close(); }}>
   <h2 className="mb-2 px-3 text-sm font-bold text-primary">Chọn lớp</h2><ul className="grid grid-cols-2 gap-2">{GRADES.map(grade => <li key={grade}><NavLink href={gradePath(grade)} className={linkClass}>Lớp {grade}</NavLink></li>)}</ul>
   <h2 className="mt-5 mb-2 px-3 text-sm font-bold text-primary">Thông tin</h2><ul>{[["/thi-vao-lop-10","Thi vào lớp 10"],["/nguon-du-lieu","Nguồn dữ liệu và giấy phép"],[aboutPath(),"Giới thiệu"],[privacyPath(),"Chính sách bảo mật"],[contactPath(),"Liên hệ"]].map(([href,label]) => <li key={href}><NavLink href={href} className={linkClass}>{label}</NavLink></li>)}</ul>
  </nav>
 </div>;
}
