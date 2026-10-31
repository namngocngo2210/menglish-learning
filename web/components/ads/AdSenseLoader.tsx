"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
export type AdsQueue = Array<Record<string, never>> & { requestNonPersonalizedAds?: number };
declare global { interface Window { adsbygoogle?: AdsQueue } }
export function AdSenseLoader({ client }: { client: string }) {
 const [ready, setReady] = useState(false);
 useEffect(() => {
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.requestNonPersonalizedAds = 1;
  // Mount the external script only after configuring the queue on the client.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setReady(true);
 }, []);
 return ready ? <Script id="adsense-loader" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`} async strategy="lazyOnload" crossOrigin="anonymous" data-tag-for-child-directed-treatment={process.env.NEXT_PUBLIC_ADSENSE_CHILD_DIRECTED !== "false" ? "1" : undefined}/> : null;
}
