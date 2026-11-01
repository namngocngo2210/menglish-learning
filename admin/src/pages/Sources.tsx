import { useState } from "react";
import {
  Button,
  Card,
  DataTable,
  Empty,
  Field,
  inputCls,
  Loading,
  Notice,
  PageTitle,
} from "../components/ui";
import { api, errorMessage, str } from "../lib/api";
import type { Row } from "../lib/api";
import { useList } from "../lib/form";

const blank = {
  code: "",
  name: "",
  base_url: "",
  license: "",
  attribution: "",
  allowed_hosts: "",
  enabled: true,
};
type Form = typeof blank;
const HOST = /^(\*\.)?[a-z0-9][a-z0-9.-]*$/;

export function Sources() {
  const list = useList("/sources?limit=100");
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const hosts = form.allowed_hosts.split(/[\s,]+/).filter(Boolean);
  const errors: Record<string, string> = {};
  for (const k of ["code", "name", "license", "attribution"] as const)
    if (!form[k].trim()) errors[k] = "Bắt buộc";
  try {
    if (!/^https?:$/.test(new URL(form.base_url).protocol)) throw new Error("x");
  } catch {
    errors["base_url"] = "URL http(s) hợp lệ";
  }
  if (hosts.some((h) => !HOST.test(h)))
    errors["allowed_hosts"] = "Tên miền dạng example.com hoặc *.example.com";
  const err = (k: string): string | undefined => (touched ? errors[k] : undefined);

  const edit = (r: Row): void => {
    setEditing(str(r, "id"));
    setForm({
      code: str(r, "code"),
      name: str(r, "name"),
      base_url: str(r, "base_url"),
      license: str(r, "license"),
      attribution: str(r, "attribution"),
      allowed_hosts: ((r["allowed_hosts"] as string[] | null) ?? []).join(", "),
      enabled: r["enabled"] === true,
    });
    setOpen(true);
    setTouched(false);
  };
  const save = async (): Promise<void> => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const body = { ...form, allowed_hosts: hosts };
    try {
      if (editing) await api("PATCH", `/sources/${editing}`, body);
      else await api("POST", "/sources", body);
      setMsg({ ok: true, text: "Đã lưu nguồn." });
      setOpen(false);
      setEditing(null);
      setForm(blank);
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };
  const field = (k: keyof Omit<Form, "enabled">, text: string, area = false) => (
    <Field label={text} error={err(k)}>
      {(id, d) =>
        area ? (
          <textarea
            id={id}
            aria-describedby={d}
            rows={2}
            value={form[k]}
            onChange={(e) => {
              setForm({ ...form, [k]: e.target.value });
            }}
            className={inputCls}
          />
        ) : (
          <input
            id={id}
            aria-describedby={d}
            aria-invalid={!!err(k)}
            value={form[k]}
            onChange={(e) => {
              setForm({ ...form, [k]: e.target.value });
            }}
            className={inputCls}
          />
        )
      }
    </Field>
  );
  return (
    <>
      <PageTitle>Nguồn nội dung</PageTitle>
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      {!open && (
        <Button
          variant="primary"
          className="mb-3"
          onClick={() => {
            setForm(blank);
            setEditing(null);
            setOpen(true);
            setTouched(false);
          }}
        >
          + Thêm nguồn
        </Button>
      )}
      {open && (
        <Card className="mb-4 max-w-2xl">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex flex-col gap-3"
          >
            <h2 className="text-lg font-bold">{editing ? "Sửa nguồn" : "Nguồn mới"}</h2>
            {field("code", "Mã (code)")}
            {field("name", "Tên")}
            {field("base_url", "URL gốc")}
            {field("license", "Giấy phép")}
            {field("attribution", "Ghi nguồn")}
            {field("allowed_hosts", "Tên miền được phép (cách nhau bằng dấu phẩy)", true)}
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5"
                checked={form.enabled}
                onChange={(e) => {
                  setForm({ ...form, enabled: e.target.checked });
                }}
              />{" "}
              Bật (cho phép crawl)
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                Lưu
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                }}
              >
                Huỷ
              </Button>
            </div>
          </form>
        </Card>
      )}
      {list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <Empty>Chưa có nguồn.</Empty>
      ) : (
        <DataTable
          head={["Mã", "Tên", "Bật", "Sửa"]}
          rows={list.items.map((r) => ({
            key: str(r, "id"),
            cells: [
              str(r, "code"),
              str(r, "name"),
              r["enabled"] === true ? "Có" : "Không",
              <Button
                key="e"
                onClick={() => {
                  edit(r);
                }}
              >
                Sửa {str(r, "code")}
              </Button>,
            ],
          }))}
        />
      )}
    </>
  );
}
