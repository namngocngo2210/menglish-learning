"use client";
import { createContext, useContext } from "react";

/** Lets Quiz and the page footer start a random exam without owning the pool logic (RandomQuiz provides it). */
export const RandomStartContext = createContext<{ start: () => void; again: boolean; loading: boolean } | null>(null);

export function RandomTrigger({ className, onDone }: { className: string; onDone?: () => void }) {
 const random = useContext(RandomStartContext);
 if (!random) return null;
 return <button type="button" className={className} disabled={random.loading} onClick={() => { random.start(); onDone?.(); }}>{random.again ? "Làm đề ngẫu nhiên khác" : "Làm đề ngẫu nhiên"}</button>;
}
