import { AccountPage, privateMetadata } from "@/components/account/AccountPage";
import { VerifyEmail } from "@/components/account/AuthForms";

// Static: the flag is read at build time, so changing ACCOUNTS_ENABLED needs a rebuild.
export const dynamic = "force-static";
export const metadata = privateMetadata("Xác minh email", "/verify-email", "Xác minh email tài khoản phụ huynh BeeJunior.");
export default function Page() {
 return <AccountPage title="Xác minh email"><VerifyEmail/></AccountPage>;
}
