"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAccountClient, hasLoginHint } from "@/lib/account/client";
import { accountPath, loginPath } from "@/lib/account/paths";
import { homePath } from "@/lib/routes";
import { NavLink } from "./NavLink";

const cls = "inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-navy! no-underline hover:bg-warm aria-[current=page]:text-primary!";

/** SSR and first paint are always the anonymous link (HTML stays cacheable); a login hint cookie triggers one /me call after hydrate. */
export function AuthNav() {
 const router = useRouter();
 const [name, setName] = useState<string | null>(null);
 useEffect(() => {
  if (!hasLoginHint()) return;
  createAccountClient().me().then(m => setName(m.username), () => {});
 }, []);
 if (!name) return <NavLink className={cls} href={loginPath()}>Đăng nhập</NavLink>;
 const logout = async () => { try { await createAccountClient().logout(); } catch { /* session already gone */ } setName(null); router.replace(homePath()); };
 return <>
  <NavLink className={`${cls} max-w-32 truncate`} href={accountPath()} title={name}>{name}</NavLink>
  <button type="button" onClick={logout} className={`${cls} cursor-pointer`}>Đăng xuất</button>
 </>;
}
