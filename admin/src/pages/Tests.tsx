import { useState } from "react";
import {
  Badge,
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
import { GRADES, SKILL_LABEL, SKILLS } from "../lib/consts";
import { useList } from "../lib/form";
import { allowed, label } from "../lib/transitions";

const blank = {
  slug: "",
  grade: "6",
  kind: "topic",
  skill: "ngu-phap",
  topic_id: "",
  title: "",
  items: "",
};

export function Tests() {
  const list = useList("/tests?limit=50");
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; version: string; title: string } | null>(
    null,
  );

  const lines = f.items
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const items = lines.map((l) => {
    const [questionId = "", order = "ABCD"] = l.split(/[:\s]+/);
    return { question_id: questionId, option_order: order };
  });
  const errors: Record<string, string> = {};
  if (!f.slug.trim()) errors["slug"] = "Bắt buộc";
  if (!f.title.trim()) errors["title"] = "Bắt buộc";
  if (f.kind !== "entrance10" && !/^\d+$/.test(f.topic_id))
    errors["topic_id"] = "Đề theo chủ đề/trộn cần mã chủ đề (số)";
  if (
    items.some(
      (i) => !/^\d+$/.test(i.question_id) || !/^(?!.*(.).*\1)[ABCD]{4}$/.test(i.option_order),
    )
  )
    errors["items"] = "Mỗi dòng: mã câu và thứ tự đáp án, ví dụ 12:BADC";
  if (new Set(items.map((i) => i.question_id)).size !== items.length)
    errors["items"] = "Trùng mã câu";
  const err = (k: string): string | undefined => (touched ? errors[k] : undefined);

  const act = async (fn: () => Promise<unknown>, ok: string): Promise<void> => {
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      list.reload();
      return;
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };
  const create = async (): Promise<void> => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const bare = f.kind === "entrance10";
    await act(
      () =>
        api("POST", "/tests", {
          slug: f.slug,
          grade: Number(f.grade),
          kind: f.kind,
          title: f.title,
          ...(bare ? {} : { skill: f.skill, topic_id: f.topic_id }),
          ...(items.length ? { items } : {}),
        }),
      "Đã tạo đề.",
    );
    setOpen(false);
    setF(blank);
  };
  const input = (k: "slug" | "title" | "topic_id", text: string) => (
    <Field label={text} error={err(k)}>
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
      <PageTitle>Đề thi</PageTitle>
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      {!open && (
        <Button
          variant="primary"
          className="mb-3"
          onClick={() => {
            setOpen(true);
          }}
        >
          + Tạo đề
        </Button>
      )}
      {open && (
        <Card className="mb-4 max-w-2xl">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="flex flex-col gap-3"
          >
            <h2 className="text-lg font-bold">Đề mới</h2>
            {input("slug", "Slug")}
            {input("title", "Tiêu đề")}
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
              <Field label="Loại">
                {(id) => (
                  <select
                    id={id}
                    value={f.kind}
                    onChange={(e) => {
                      setF({ ...f, kind: e.target.value });
                    }}
                    className={inputCls}
                  >
                    <option value="topic">Theo chủ đề</option>
                    <option value="mixed">Trộn</option>
                    <option value="entrance10">Vào 10</option>
                  </select>
                )}
              </Field>
            </div>
            {f.kind !== "entrance10" && (
              <div className="grid grid-cols-2 gap-3">
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
                      {SKILLS.map((s) => (
                        <option key={s} value={s}>
                          {SKILL_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {input("topic_id", "Mã chủ đề")}
              </div>
            )}
            <Field
              label="Câu hỏi (mỗi dòng mã:thứ tự đáp án)"
              hint="Ví dụ 12:BADC. Để trống nếu thêm sau."
              error={err("items")}
            >
              {(id, d) => (
                <textarea
                  id={id}
                  aria-describedby={d}
                  rows={4}
                  value={f.items}
                  onChange={(e) => {
                    setF({ ...f, items: e.target.value });
                  }}
                  className={inputCls}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                Tạo
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
      {renaming && (
        <Card className="mb-4 max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                () =>
                  api(
                    "PATCH",
                    `/tests/${renaming.id}`,
                    { title: renaming.title },
                    { "if-match": renaming.version },
                  ),
                "Đã đổi tiêu đề.",
              ).then(() => {
                setRenaming(null);
              });
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Field label={`Tiêu đề đề #${renaming.id}`}>
              {(id) => (
                <input
                  id={id}
                  required
                  value={renaming.title}
                  onChange={(e) => {
                    setRenaming({ ...renaming, title: e.target.value });
                  }}
                  className={inputCls}
                />
              )}
            </Field>
            <Button type="submit" variant="primary">
              Lưu
            </Button>
            <Button
              onClick={() => {
                setRenaming(null);
              }}
            >
              Huỷ
            </Button>
          </form>
        </Card>
      )}
      {list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <Empty>Chưa có đề.</Empty>
      ) : (
        <DataTable
          head={["Đề", "Loại", "Trạng thái", "Thao tác"]}
          rows={list.items.map((r) => {
            const id = str(r, "id");
            return {
              key: id,
              cells: [
                <span key="t">
                  <strong>{str(r, "title")}</strong>
                  <br />
                  {str(r, "slug")} · lớp {str(r, "grade")}
                </span>,
                str(r, "kind"),
                <Badge key="s" status={str(r, "review_status")} />,
                <span key="a" className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setRenaming({ id, version: str(r, "version"), title: str(r, "title") });
                    }}
                  >
                    Sửa tiêu đề
                  </Button>
                  {allowed("test", str(r, "review_status")).map((to) => (
                    <Button
                      key={to}
                      variant={to === "published" ? "primary" : "outline"}
                      onClick={() =>
                        void act(
                          () => api("POST", `/tests/${id}/transition`, { to }),
                          `Đã chuyển sang "${label(to)}".`,
                        )
                      }
                    >
                      → {label(to)}
                    </Button>
                  ))}
                </span>,
              ],
            };
          })}
        />
      )}
      {list.next && (
        <Button className="mt-3" onClick={() => void list.more()}>
          Tải thêm
        </Button>
      )}
    </>
  );
}
