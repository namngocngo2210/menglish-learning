import type { Metadata } from "next";
import type { ReactNode } from "react";
import { latinFont, latinExtFont, vietnameseFont } from "@/lib/fonts";
import { SITE } from "@/lib/site-config";
import "./globals.css";
export const metadata: Metadata = { title: SITE.name, description: SITE.description };
export default function RootLayout({ children }: { children: ReactNode }) {
 return <html lang="vi" className={`${latinFont.variable} ${latinExtFont.variable} ${vietnameseFont.variable}`}><body>{children}</body></html>;
}
