/** Outbound email port. The real provider is not chosen yet (docs/user-accounts.md decision 5). */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  /** False for the placeholder mailer: sends are known to fail. */
  configured?: boolean;
  send(message: MailMessage): Promise<void>;
}

/** Test double: keeps messages in memory instead of speaking SMTP. */
export function createMemoryMailer(): Mailer & { outbox: MailMessage[] } {
  const outbox: MailMessage[] = [];
  return {
    outbox,
    send: (message) => {
      outbox.push(message);
      return Promise.resolve();
    },
  };
}

/** Placeholder adapter: fails every send until a provider (Resend, Brevo, SES) is wired in. */
export function createUnconfiguredMailer(): Mailer {
  return {
    configured: false,
    send: () => Promise.reject(new Error("mail provider is not configured")),
  };
}

const SIGNATURE = "\n\nBeeJunior";

export const verifyEmailMessage = (to: string, link: string): MailMessage => ({
  to,
  subject: "Xác minh email BeeJunior",
  text: `Xin chào,\n\nHãy mở liên kết sau để xác minh email và kích hoạt tài khoản phụ huynh (hiệu lực 24 giờ):\n${link}\n\nNếu bạn không đăng ký, hãy bỏ qua email này.${SIGNATURE}`,
});

export const resetPasswordMessage = (to: string, link: string): MailMessage => ({
  to,
  subject: "Đặt lại mật khẩu BeeJunior",
  text: `Xin chào,\n\nHãy mở liên kết sau để đặt lại mật khẩu (hiệu lực 1 giờ):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn an toàn.${SIGNATURE}`,
});

export const existingAccountMessage = (to: string, link: string): MailMessage => ({
  to,
  subject: "Email này đã có tài khoản BeeJunior",
  text: `Xin chào,\n\nCó người vừa đăng ký BeeJunior bằng email này nhưng tài khoản đã tồn tại. Nếu là bạn và quên mật khẩu, hãy đặt lại tại:\n${link}\n\nNếu không phải bạn, hãy bỏ qua email này.${SIGNATURE}`,
});
