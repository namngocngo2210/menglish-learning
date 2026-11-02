import { AccountPage, privateMetadata } from "@/components/account/AccountPage";
import { LoginForm } from "@/components/account/AuthForms";

// Static: the flag is read at build time, so changing ACCOUNTS_ENABLED needs a rebuild.
export const dynamic = "force-static";
export const metadata = privateMetadata("Đăng nhập", "/log-in", "Đăng nhập tài khoản phụ huynh BeeJunior.");
export default function Page() {
 return <AccountPage title="Đăng nhập"><LoginForm/></AccountPage>;
}
