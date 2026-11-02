import { AccountPage, privateMetadata } from "@/components/account/AccountPage";
import { AccountHome } from "@/components/account/AccountHome";

// Static: the flag is read at build time, so changing ACCOUNTS_ENABLED needs a rebuild.
export const dynamic = "force-static";
export const metadata = privateMetadata("Tài khoản", "/tai-khoan", "Quản lý tài khoản phụ huynh và hồ sơ của con trên BeeJunior.");
export default function Page() {
 return <AccountPage title="Tài khoản"><AccountHome/></AccountPage>;
}
