import { useEffect, useState } from "react";
import { Button, Card, Field, inputCls, Notice } from "../components/ui";
import { api, ApiError, errorMessage } from "../lib/api";

export function Login({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => {
      setWait(wait - 1);
    }, 1000);
    return () => {
      clearTimeout(t);
    };
  }, [wait]);

  const submit = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", "/auth/login", { email, password, ...(needTotp && totp ? { totp } : {}) });
      await onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.detail === "totp_required")
        setNeedTotp(true);
      else {
        if (err instanceof ApiError && err.status === 429) setWait(err.retryAfter ?? 60);
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">BeeJunior Admin</h1>
        <p className="mb-4 text-sm text-ink-soft">Đăng nhập chủ site</p>
        {error && (
          <Notice>
            {wait > 0 ? `Quá nhiều lần thử. Thử lại sau ${String(wait)} giây.` : error}
          </Notice>
        )}
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          <Field label="Email">
            {(id) => (
              <input
                id={id}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Mật khẩu">
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                className={inputCls}
              />
            )}
          </Field>
          {needTotp && (
            <Field
              label="Mã 2FA hoặc mã khôi phục"
              hint="6 chữ số từ ứng dụng xác thực, hoặc một mã khôi phục (dùng một lần)."
            >
              {(id, d) => (
                <input
                  id={id}
                  aria-describedby={d}
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  value={totp}
                  onChange={(e) => {
                    setTotp(e.target.value);
                  }}
                  className={inputCls}
                />
              )}
            </Field>
          )}
          <Button type="submit" variant="primary" disabled={busy || wait > 0}>
            Đăng nhập
          </Button>
        </form>
      </Card>
    </main>
  );
}
