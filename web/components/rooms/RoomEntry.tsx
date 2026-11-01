"use client";
import { DoorOpen, PlusCircle } from "lucide-react";

/** Extension point: the create-room and join-by-code forms land here in the next card. No network calls yet. */
export function RoomEntry() {
 const card = "rounded-2xl border-2 border-navy/20 bg-white p-5 shadow-sm sm:p-6";
 return <div id="tao-phong" data-slot="room-entry" className="grid gap-5 md:grid-cols-2">
  <section aria-labelledby="tao-phong-heading" className={card}>
   <h2 id="tao-phong-heading" className="flex items-center gap-2 text-xl font-bold"><PlusCircle aria-hidden="true" className="size-6 text-primary"/>Tạo phòng</h2>
   <p className="mt-2 text-navy-soft">Chọn đề có sẵn hoặc trộn câu theo lớp, kỹ năng và chủ đề. Tính năng đang được hoàn thiện.</p>
  </section>
  <section aria-labelledby="vao-phong-heading" className={card}>
   <h2 id="vao-phong-heading" className="flex items-center gap-2 text-xl font-bold"><DoorOpen aria-hidden="true" className="size-6 text-primary"/>Vào phòng bằng mã</h2>
   <p className="mt-2 text-navy-soft">Nhập mã 6 ký tự do chủ phòng gửi để cùng làm bài. Tính năng đang được hoàn thiện.</p>
  </section>
 </div>;
}
