import { useState } from "react";
import {
  Badge,
  Button,
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
import { cn } from "../lib/cn";
import { GRADES, SKILL_LABEL, SKILLS } from "../lib/consts";
import { useList } from "../lib/form";
import { allowed, label, STATUSES } from "../lib/transitions";
import type { Status } from "../lib/transitions";

export function Review() {
  const [kind, setKind] = useState<"questions" | "passages">("questions");
  const [status, setStatus] = useState<Status>("quarantine");
  const [grade, setGrade] = useState("");
  const [skill, setSkill] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const params = new URLSearchParams({ status, limit: "50" });
  if (kind === "questions") {
    if (grade) params.set("grade", grade);
    if (skill) params.set("skill", skill);
    if (q.trim()) params.set("q", q.trim());
  }
  const list = useList(`/${kind}?${params.toString()}`);
  const entity = kind === "questions" ? "question" : "passage";
  const targets = allowed(entity, status);

  const run = async (): Promise<void> => {
    setConfirm(false);
    try {
      const r = await api<{ count: number }>("POST", `/${kind}/bulk-transition`, {
        to,
        ids: picked,
        expected_count: picked.length,
      });
      setMsg({ ok: true, text: `Đã chuyển ${String(r.count)} mục sang "${label(to)}".` });
      setPicked([]);
      setTo("");
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };
  const toggle = (id: string): void => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const title = (r: Record<string, unknown>): string =>
    kind === "questions" ? str(r, "stem") : str(r, "title");

  return (
    <>
      <PageTitle>Hàng đợi duyệt</PageTitle>
      <div role="group" aria-label="Loại nội dung" className="mb-3 flex gap-2">
        {(["questions", "passages"] as const).map((k) => (
          <Button
            key={k}
            aria-pressed={kind === k}
            variant={kind === k ? "primary" : "outline"}
            onClick={() => {
              setKind(k);
              setPicked([]);
            }}
          >
            {k === "questions" ? "Câu hỏi" : "Bài đọc"}
          </Button>
        ))}
        <a
          href={`#/${kind}/new`}
          className="inline-flex min-h-11 items-center rounded-lg border border-ink/40 px-4 text-sm font-bold text-ink no-underline"
        >
          + Thêm mới
        </a>
      </div>
      <div role="tablist" aria-label="Trạng thái" className="mb-3 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            type="button"
            onClick={() => {
              setStatus(s);
              setPicked([]);
              setMsg(null);
            }}
            className={cn(
              "min-h-11 rounded-lg px-3 text-sm",
              status === s ? "bg-ink font-bold text-white" : "border border-line bg-white",
            )}
          >
            {label(s)}
          </button>
        ))}
      </div>
      {kind === "questions" && (
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <Field label="Lớp">
            {(id) => (
              <select
                id={id}
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">Tất cả</option>
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
                value={skill}
                onChange={(e) => {
                  setSkill(e.target.value);
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
          <Field label="Tìm trong đề bài">
            {(id) => (
              <input
                id={id}
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                }}
                className={inputCls}
              />
            )}
          </Field>
        </div>
      )}
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {picked.length > 0 && targets.length > 0 && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-sky-soft p-3">
          <Field label={`Đã chọn ${String(picked.length)} mục · chuyển sang`}>
            {(id) => (
              <select
                id={id}
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">Chọn trạng thái…</option>
                {targets.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button
            variant="primary"
            disabled={!to}
            onClick={() => {
              setConfirm(true);
            }}
          >
            Chuyển hàng loạt
          </Button>
        </div>
      )}
      {list.error && <Notice>{list.error}</Notice>}
      {list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <Empty>Không có mục nào ở trạng thái này.</Empty>
      ) : (
        <DataTable
          head={["Chọn", "Nội dung", "Trạng thái", "Mở"]}
          rows={list.items.map((r) => {
            const id = str(r, "id");
            return {
              key: id,
              cells: [
                <input
                  key="c"
                  type="checkbox"
                  className="size-6"
                  aria-label={`Chọn mục ${id}`}
                  checked={picked.includes(id)}
                  onChange={() => {
                    toggle(id);
                  }}
                />,
                <span key="t" className="line-clamp-3">
                  {title(r)}
                </span>,
                <Badge key="s" status={str(r, "review_status")} />,
                <a key="o" href={`#/${kind}/${id}`} className="inline-flex min-h-11 items-center">
                  Mở #{id}
                </a>,
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
      <Confirm
        open={confirm}
        title="Xác nhận chuyển hàng loạt"
        confirmText={`Chuyển ${String(picked.length)} mục`}
        onConfirm={() => void run()}
        onCancel={() => {
          setConfirm(false);
        }}
      >
        Chuyển <strong>{picked.length}</strong> mục từ "{label(status)}" sang "{label(to)}"? Máy chủ
        sẽ từ chối nếu số lượng không khớp.
      </Confirm>
    </>
  );
}
