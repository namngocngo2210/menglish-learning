import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RoomRedirect } from "@/components/rooms/RoomRedirect";
import { roomsEnabled } from "@/lib/rooms/flag";

export const metadata: Metadata = { title: "Vào phòng", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function JoinRedirectPage() {
 if (!roomsEnabled()) notFound();
 return <Suspense><RoomRedirect/></Suspense>;
}
