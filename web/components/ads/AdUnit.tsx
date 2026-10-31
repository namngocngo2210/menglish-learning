"use client";
import { useEffect, useRef } from "react";
import type { AdsQueue } from "./AdSenseLoader";
export function AdUnit({ client, slotId, className }: { client: string; slotId: string; className: string }) {
 const requested = useRef(false);
 useEffect(() => {
  if (requested.current) return;
  try {
   const queue: AdsQueue = window.adsbygoogle = window.adsbygoogle || [];
   queue.requestNonPersonalizedAds = 1;
   queue.push({}); requested.current = true;
  } catch { /* Keep the reserved slot if ads are blocked. */ }
 }, []);
 return <ins className={`adsbygoogle ${className}`} style={{ display: "block", minHeight: 120 }} data-ad-client={client} data-ad-slot={slotId} data-ad-format="auto" data-full-width-responsive="true"/>;
}
