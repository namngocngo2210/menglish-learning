import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { latinFont, latinExtFont, vietnameseFont } from "@/lib/fonts";
import { SITE } from "@/lib/site-config";
import { AdSenseLoader } from "@/components/ads/AdSenseLoader";
import "./globals.css";
export const viewport: Viewport = { themeColor: "#ffc001" };
export const metadata: Metadata = { metadataBase: new URL(SITE.baseUrl), title: { default: SITE.name, template: `%s | ${SITE.name}` }, description: SITE.description };
export default function RootLayout({ children }: { children: ReactNode }) {
 return <html lang="vi" className={`${latinFont.variable} ${latinExtFont.variable} ${vietnameseFont.variable}`}><body>{children}{process.env.NEXT_PUBLIC_ADSENSE_CLIENT && <AdSenseLoader client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}/>}</body></html>;
}
