"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeRoomCode } from "@/lib/rooms/code";
import { roomPath, roomsLandingPath } from "@/lib/routes";

/** /group-practice/join?ma=XXXXXX -> room shell, or back to the landing for an invalid code. */
export function RoomRedirect() {
 const router = useRouter();
 const code = normalizeRoomCode(useSearchParams().get("ma") ?? "");
 useEffect(() => { router.replace(code ? roomPath(code) : roomsLandingPath()); }, [router, code]);
 return <main className="mx-auto max-w-lg px-5 py-16 text-center" role="status">Đang chuyển đến phòng…</main>;
}
