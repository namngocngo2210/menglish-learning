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
import { useList } from "../lib/form";

const REASON: Record<string, string> = {
  wrong_answer: "Sai đáp án",
  typo: "Lỗi chính tả",
  unclear: "Khó hiểu",
  offensive: "Không phù hợp",
  other: "Khác",
};

export function Reports() {
  const [status, setStatus] = useState("open");
  const list = useList(`/reports?status=${status}&limit=50`);
  const [target, setTarget] = useState<{ id: string; to: "resolved" | "dismissed" } | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const done = async (): Promise<void> => {
    if (!target) return;
    try {
      await api("PATCH", `/reports/${target.id}`, {
        status: target.to,
        ...(note.trim() ? { handled_note: note.trim() } : {}),
      });
      setMsg({ ok: true, text: "Đã cập nhật báo cáo." });
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
    setTarget(null);
    setNote("");
  };
  return (
    <>
      <PageTitle>Báo cáo câu sai</PageTitle>
      <div className="mb-3 max-w-xs">
        <Field label="Trạng thái">
          {(id) => (
            <select
              id={id}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
              }}
              className={inputCls}
            >
              <option value="open">Đang mở</option>
              <option value="resolved">Đã xử lý</option>
              <option value="dismissed">Bỏ qua</option>
            </select>
          )}
        </Field>
      </div>
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      {list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <Empty>Không có báo cáo.</Empty>
      ) : (
        <DataTable
          head={["Câu", "Lý do", "Ghi chú", "Trạng thái", "Xử lý"]}
          rows={list.items.map((r) => ({
            key: str(r, "id"),
            cells: [
              <a key="q" href={`#/questions/${str(r, "question_id")}`}>
                Câu #{str(r, "question_id")}
              </a>,
              REASON[str(r, "reason")] ?? str(r, "reason"),
              str(r, "note") || "—",
              <Badge
                key="s"
                status={
                  str(r, "status") === "open"
                    ? "quarantine"
                    : str(r, "status") === "resolved"
                      ? "published"
                      : "archived"
                }
              />,
              str(r, "status") === "open" ? (
                <span key="a" className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setTarget({ id: str(r, "id"), to: "resolved" });
                    }}
                  >
                    Đã xử lý
                  </Button>
                  <Button
                    onClick={() => {
                      setTarget({ id: str(r, "id"), to: "dismissed" });
                    }}
                  >
                    Bỏ qua
                  </Button>
                </span>
              ) : (
                str(r, "handled_note") || "—"
              ),
            ],
          }))}
        />
      )}
      {list.next && (
        <Button className="mt-3" onClick={() => void list.more()}>
          Tải thêm
        </Button>
      )}
      <Confirm
        open={target !== null}
        title={target?.to === "resolved" ? "Đánh dấu đã xử lý" : "Bỏ qua báo cáo"}
        confirmText="Xác nhận"
        onConfirm={() => void done()}
        onCancel={() => {
          setTarget(null);
        }}
      >
        <Field label="Ghi chú (tuỳ chọn, tối đa 500 ký tự)">
          {(id) => (
            <textarea
              id={id}
              maxLength={500}
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
              className={inputCls}
            />
          )}
        </Field>
      </Confirm>
    </>
  );
}
