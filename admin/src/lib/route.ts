import { useSyncExternalStore } from "react";

/** Hash routing (`#/review`): no router dependency, no server fallback, and no redirect parameter to abuse. */
export const parse = (hash: string): string[] => {
  const path = hash.replace(/^#/, "").split("?")[0] ?? "";
  return path.split("/").filter(Boolean).map(decodeURIComponent);
};
const subscribe = (cb: () => void): (() => void) => {
  window.addEventListener("hashchange", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
  };
};
export const useRoute = (): string[] =>
  parse(
    useSyncExternalStore(
      subscribe,
      () => window.location.hash,
      () => "",
    ),
  );
