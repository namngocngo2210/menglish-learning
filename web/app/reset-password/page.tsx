import { AccountPage, privateMetadata } from "@/components/account/AccountPage";
import { ResetPassword } from "@/components/account/AuthForms";

// Static: the flag is read at build time, so changing ACCOUNTS_ENABLED needs a rebuild.
export const dynamic = "force-static";
export const metadata = privateMetadata("Đặt lại mật khẩu", "/reset-password", "Đặt lại mật khẩu tài khoản phụ huynh BeeJunior.");
export default function Page() {
 return <AccountPage title="Đặt lại mật khẩu"><ResetPassword/></AccountPage>;
}
