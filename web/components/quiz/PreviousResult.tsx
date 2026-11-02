"use client";
import { useSyncExternalStore } from "react";
import { readProgress } from "@/lib/progress";
function subscribe(callback: () => void) {
 window.addEventListener("storage", callback); window.addEventListener("ml:progress", callback);
 return () => { window.removeEventListener("storage", callback); window.removeEventListener("ml:progress", callback); };
}
export function PreviousResult({ slug }: { slug: string }) {
 const label = useSyncExternalStore(subscribe, () => {
  const p = readProgress(slug);
  return p ? `Lần trước: ${p.last}/${p.total} (${(p.last / p.total * 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} điểm)` : "";
 }, () => "");
 return label ? <span> · {label}</span> : null;
}
