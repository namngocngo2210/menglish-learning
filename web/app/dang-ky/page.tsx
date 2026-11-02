import { AccountPage, privateMetadata } from "@/components/account/AccountPage";
import { RegisterForm } from "@/components/account/AuthForms";

// Static: the flag is read at build time, so changing ACCOUNTS_ENABLED needs a rebuild.
export const dynamic = "force-static";
export const metadata = privateMetadata("Đăng ký tài khoản phụ huynh", "/dang-ky", "Tạo tài khoản phụ huynh để lưu tiến độ luyện tập của con trên BeeJunior.");
export default function Page() {
 return <AccountPage title="Đăng ký tài khoản phụ huynh"><RegisterForm/></AccountPage>;
}
