import { useState } from "react";
import {
  Button,
  Card,
  Confirm,
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
import { GRADES, SKILL_LABEL, SKILLS } from "../lib/consts";
import { useList } from "../lib/form";

const blank = { name: "", grade: "6", skill: "", size: "10", d1: "", d2: "", d3: "", maxGroup: "" };
type Form = typeof blank;

export function Presets() {
  const list = useList("/mixer-presets?limit=100");
  const [f, setF] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const num = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors["name"] = "Bắt buộc";
  const size = Number(f.size);
  if (!Number.isInteger(size) || size < 1 || size > 100) errors["size"] = "Số câu 1–100";
  for (const k of ["d1", "d2", "d3", "maxGroup"] as const) {
    const n = num(f[k]);
    if (n !== undefined && !(n >= 0)) errors[k] = "Số ≥ 0";
  }
  const err = (k: string): string | undefined => (touched ? errors[k] : undefined);

  const body = (): Row => {
    const mix: Row = {};
    for (const [k, key] of [
      ["d1", "1"],
      ["d2", "2"],
      ["d3", "3"],
    ] as const) {
      const n = num(f[k]);
      if (n !== undefined) mix[key] = n;
    }
    const mg = num(f.maxGroup);
    return {
      name: f.name,
      grade: Number(f.grade),
      skill: f.skill || null,
      config: {
        size,
        ...(Object.keys(mix).length ? { difficultyMix: mix } : {}),
        ...(mg !== undefined ? { maxGroup: mg } : {}),
      },
    };
  };
  const save = async (): Promise<void> => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    try {
      if (editing) await api("PATCH", `/mixer-presets/${editing}`, body());
      else await api("POST", "/mixer-presets", body());
      setMsg({ ok: true, text: "Đã lưu preset." });
      setOpen(false);
      setEditing(null);
      setF(blank);
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };
  const edit = (r: Row): void => {
    const c = (r["config"] ?? {}) as {
      size?: number;
      difficultyMix?: Record<string, number>;
      maxGroup?: number;
    };
    setF({
      name: str(r, "name"),
      grade: str(r, "grade"),
      skill: str(r, "skill"),
      size: String(c.size ?? ""),
      d1: String(c.difficultyMix?.["1"] ?? ""),
      d2: String(c.difficultyMix?.["2"] ?? ""),
      d3: String(c.difficultyMix?.["3"] ?? ""),
      maxGroup: String(c.maxGroup ?? ""),
    });
    setEditing(str(r, "id"));
    setOpen(true);
    setTouched(false);
  };
  const remove = async (): Promise<void> => {
    if (!del) return;
    try {
      await api("DELETE", `/mixer-presets/${str(del, "id")}`);
      setMsg({ ok: true, text: "Đã xoá preset." });
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
    setDel(null);
  };
  const input = (k: keyof Form, text: string, hint?: string) => (
    <Field label={text} error={err(k)} {...(hint ? { hint } : {})}>
      {(id, d) => (
        <input
          id={id}
          aria-describedby={d}
          aria-invalid={!!err(k)}
          value={f[k]}
          onChange={(e) => {
            setF({ ...f, [k]: e.target.value });
          }}
          className={inputCls}
        />
      )}
    </Field>
  );
  return (
    <>
      <PageTitle>Preset trộn đề</PageTitle>
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      {!open && (
        <Button
          variant="primary"
          className="mb-3"
          onClick={() => {
            setF(blank);
            setEditing(null);
            setOpen(true);
            setTouched(false);
          }}
        >
          + Thêm preset
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
            <h2 className="text-lg font-bold">{editing ? "Sửa preset" : "Preset mới"}</h2>
            {input("name", "Tên")}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lớp">
                {(id) => (
                  <select
                    id={id}
                    value={f.grade}
                    onChange={(e) => {
                      setF({ ...f, grade: e.target.value });
                    }}
                    className={inputCls}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Kỹ năng">
                {(id) => (
                  <select
                    id={id}
                    value={f.skill}
                    onChange={(e) => {
                      setF({ ...f, skill: e.target.value });
                    }}
                    className={inputCls}
                  >
                    <option value="">Tất cả</option>
                    {SKILLS.map((s) => (
                      <option key={s} value={s}>
                        {SKILL_LABEL[s]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            {input("size", "Số câu (1–100)")}
            <div className="grid grid-cols-3 gap-3">
              {input("d1", "Tỉ lệ dễ")}
              {input("d2", "Tỉ lệ vừa")}
              {input("d3", "Tỉ lệ khó")}
            </div>
            {input("maxGroup", "Tối đa câu cùng bài đọc", "Để trống nếu không giới hạn")}
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
        <Empty>Chưa có preset.</Empty>
      ) : (
        <DataTable
          head={["Tên", "Lớp", "Số câu", "Thao tác"]}
          rows={list.items.map((r) => ({
            key: str(r, "id"),
            cells: [
              str(r, "name"),
              str(r, "grade"),
              String((r["config"] as { size?: number } | null)?.size ?? ""),
              <span key="a" className="flex gap-2">
                <Button
                  onClick={() => {
                    edit(r);
                  }}
                >
                  Sửa
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDel(r);
                  }}
                >
                  Xoá
                </Button>
              </span>,
            ],
          }))}
        />
      )}
      <Confirm
        open={del !== null}
        danger
        title="Xoá preset"
        confirmText="Xoá"
        onConfirm={() => void remove()}
        onCancel={() => {
          setDel(null);
        }}
      >
        Xoá preset "{del ? str(del, "name") : ""}"? Không hoàn tác được.
      </Confirm>
    </>
  );
}
