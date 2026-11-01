import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomShell } from "@/components/rooms/RoomShell";
import { normalizeRoomCode } from "@/lib/rooms/code";
import { roomsEnabled } from "@/lib/rooms/flag";

// Private shell: no canonical/OG, never indexed (the response header is set in next.config.ts).
export const metadata: Metadata = { title: "Phòng luyện tập", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function RoomPage({ params }: { params: Promise<{ ma: string }> }) {
 const code = normalizeRoomCode((await params).ma);
 if (!roomsEnabled() || !code) notFound();
 return <RoomShell code={code}/>;
}
