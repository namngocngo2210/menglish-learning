"use client";
import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
type Api = { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; "expired-callback": () => void }) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Api } }

/** Cloudflare Turnstile widget; renders nothing (captcha off) unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. */
export const turnstileOn = !!SITE_KEY;
export function Turnstile({ onToken }: { onToken: (t: string | undefined) => void }) {
 const box = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (!SITE_KEY || !box.current) return;
  const el = box.current; let id: string | undefined; let cancelled = false;
  const draw = () => { if (!cancelled && window.turnstile) id = window.turnstile.render(el, { sitekey: SITE_KEY, callback: onToken, "expired-callback": () => onToken(undefined) }); };
  if (window.turnstile) draw();
  else {
   let s = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
   if (!s) { s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.dataset.turnstile = "1"; document.head.appendChild(s); }
   s.addEventListener("load", draw);
  }
  return () => { cancelled = true; if (id && window.turnstile) window.turnstile.remove(id); };
 }, [onToken]);
 return SITE_KEY ? <div ref={box} aria-label="Xác nhận bạn không phải máy"/> : null;
}
