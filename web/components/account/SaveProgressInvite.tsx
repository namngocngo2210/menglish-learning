import Link from "next/link";
import { loginPath, registerPath } from "@/lib/account/paths";

/** Optional invitation under the test (never inside the question area, never blocks practice). */
export function SaveProgressInvite() {
 return <aside aria-labelledby="luu-tien-do" className="mt-6 space-y-2 rounded-2xl border-2 border-navy/20 bg-sky-soft p-5">
  <h2 id="luu-tien-do" className="text-lg font-bold">Lưu tiến độ</h2>
  <p>Phụ huynh có thể tạo tài khoản để lưu tiến độ của con và xem lại trên nhiều thiết bị. Không bắt buộc — em vẫn luyện tập bình thường.</p>
  <p className="flex flex-wrap gap-x-5"><Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href={registerPath()}>Tạo tài khoản phụ huynh</Link><Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href={loginPath()}>Đăng nhập</Link></p>
 </aside>;
}
