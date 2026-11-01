import { useState } from "react";
import type { Me } from "../lib/api";
import { Button, Card, Field, inputCls, Notice, PageTitle } from "../components/ui";
import { api, errorMessage } from "../lib/api";

export function Settings({ me, onChange }: { me: Me; onChange: () => Promise<void> }) {
  const [secret, setSecret] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<void>): Promise<void> => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <>
      <PageTitle>Bảo mật · Xác thực 2 bước</PageTitle>
      {error && <Notice>{error}</Notice>}
      {codes ? (
        <Card>
          <h2 className="mb-2 text-lg font-bold">Mã khôi phục (chỉ hiện một lần)</h2>
          <ul className="mb-3 grid grid-cols-2 gap-1 font-mono">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button onClick={() => void navigator.clipboard.writeText(codes.join("\n"))}>
            Sao chép
          </Button>
          <label className="my-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => {
                setSaved(e.target.checked);
              }}
              className="size-5"
            />{" "}
            Tôi đã lưu các mã này
          </label>
          <Button
            variant="primary"
            disabled={!saved}
            onClick={() => {
              setCodes(null);
              setSecret(null);
              void onChange();
            }}
          >
            Xong
          </Button>
        </Card>
      ) : me.totpEnabled ? (
        <Card className="max-w-md">
          <p className="mb-3">
            2FA đang <strong>bật</strong>. Tắt cần mật khẩu và một mã.
          </p>
          <div className="flex flex-col gap-3">
            <Field label="Mật khẩu">
              {(id) => (
                <input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  className={inputCls}
                />
              )}
            </Field>
            <Field label="Mã 2FA hoặc khôi phục">
              {(id) => (
                <input
                  id={id}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                  }}
                  className={inputCls}
                />
              )}
            </Field>
            <Button
              variant="danger"
              onClick={() =>
                void run(async () => {
                  await api("POST", "/auth/totp/disable", { password, code });
                  setPassword("");
                  setCode("");
                  await onChange();
                })
              }
            >
              Tắt 2FA
            </Button>
          </div>
        </Card>
      ) : secret ? (
        <Card className="max-w-md">
          <p className="mb-2">
            Thêm khoá vào ứng dụng xác thực (nhập tay), rồi nhập mã 6 số để xác nhận.
          </p>
          <p className="mb-1 text-sm font-bold">Khoá bí mật (chỉ hiện lúc này)</p>
          <p className="mb-3 flex items-center gap-2">
            <code className="break-all rounded bg-warm px-2 py-1">
              {show ? secret.secret : "•".repeat(16)}
            </code>
            <Button
              onClick={() => {
                setShow(!show);
              }}
              aria-pressed={show}
            >
              {show ? "Ẩn" : "Hiện"}
            </Button>
          </p>
          <Field label="Mã 6 số">
            {(id) => (
              <input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                }}
                className={inputCls}
              />
            )}
          </Field>
          <Button
            variant="primary"
            className="mt-3"
            onClick={() =>
              void run(async () => {
                const r = await api<{ recoveryCodes: string[] }>("POST", "/auth/totp/verify", {
                  code,
                });
                setCode("");
                setCodes(r.recoveryCodes);
              })
            }
          >
            Xác nhận
          </Button>
        </Card>
      ) : (
        <Card className="max-w-md">
          <p className="mb-3">
            2FA đang <strong>tắt</strong> (tuỳ chọn, nên bật).
          </p>
          <Button
            variant="primary"
            onClick={() =>
              void run(async () => {
                setSecret(
                  await api<{ secret: string; otpauthUri: string }>(
                    "POST",
                    "/auth/totp/enroll",
                    {},
                  ),
                );
              })
            }
          >
            Bật 2FA
          </Button>
        </Card>
      )}
    </>
  );
}
