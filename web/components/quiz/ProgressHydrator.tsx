"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readProgress } from "@/lib/progress";
import { QUIZ_STORAGE_PREFIX } from "@/lib/quiz/persist";

const inProgress = (slug: string) => { try { return Boolean(window.localStorage.getItem(QUIZ_STORAGE_PREFIX + slug)); } catch { return false; } };

/** Fill server-rendered progress labels with one subscription for the whole list. */
export function ProgressHydrator() {
 const pathname = usePathname();
 useEffect(() => {
  function refresh() {
   for (const target of document.querySelectorAll<HTMLElement>("[data-progress-slug]")) {
    const progress = readProgress(target.dataset.progressSlug!);
    if (target.dataset.progressStyle === "tile") { target.textContent = progress ? `✓ Tốt nhất ${progress.best}/${progress.total}` : inProgress(target.dataset.progressSlug!) ? "Đang làm dở" : ""; continue; }
    target.textContent = progress ? `Lần trước: ${progress.last}/${progress.total} (${(progress.last / progress.total * 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} điểm)` : "";
   }
  }
  refresh();
  window.addEventListener("storage", refresh);
  window.addEventListener("ml:progress", refresh);
  return () => {
   window.removeEventListener("storage", refresh);
   window.removeEventListener("ml:progress", refresh);
  };
 }, [pathname]);
 return null;
}
