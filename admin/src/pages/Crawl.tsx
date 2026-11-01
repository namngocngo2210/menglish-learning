import { useEffect, useState } from "react";
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
import type { Row } from "../lib/api";
import { useList } from "../lib/form";

export function Crawl() {
  const list = useList("/crawl-jobs?limit=50");
  const [sources, setSources] = useState<Row[]>([]);
  const [code, setCode] = useState("");
  const [view, setView] = useState<"all" | "failures">("all");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void api<{ items: Row[] }>("GET", "/sources?limit=100")
      .then((s) => {
        setSources(s.items.filter((x) => x["enabled"] === true));
      })
      .catch(() => undefined);
  }, []);
  const act = async (fn: () => Promise<unknown>, ok: string): Promise<void> => {
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };
  const failed = (r: Row): boolean => str(r, "status") === "failed" || Number(r["error_count"]) > 0;
  const rows = view === "failures" ? list.items.filter(failed) : list.items;
  return (
    <>
      <PageTitle>Crawl</PageTitle>
      <Card className="mb-4 max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api("POST", "/crawl-jobs", { sourceCode: code }), "Đã tạo job crawl.");
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <Field label="Nguồn đang bật">
            {(id) => (
              <select
                id={id}
                required
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">Chọn nguồn…</option>
                {sources.map((s) => (
                  <option key={str(s, "id")} value={str(s, "code")}>
                    {str(s, "name")}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button type="submit" variant="primary" disabled={!code}>
            Tạo job
          </Button>
        </form>
      </Card>
      <div role="group" aria-label="Bộ lọc" className="mb-3 flex gap-2">
        <Button
          aria-pressed={view === "all"}
          variant={view === "all" ? "primary" : "outline"}
          onClick={() => {
            setView("all");
          }}
        >
          Tất cả job
        </Button>
        <Button
          aria-pressed={view === "failures"}
          variant={view === "failures" ? "primary" : "outline"}
          onClick={() => {
            setView("failures");
          }}
        >
          Lỗi
        </Button>
      </div>
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      {list.loading && list.items.length === 0 ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>{view === "failures" ? "Không có job lỗi." : "Chưa có job."}</Empty>
      ) : (
        <DataTable
          head={["Job", "Trạng thái", "Lấy / cách ly / lỗi", "Tạo lúc", ""]}
          rows={rows.map((r) => ({
            key: str(r, "id"),
            cells: [
              `#${str(r, "id")}`,
              <Badge key="s" status={str(r, "status")} />,
              `${str(r, "fetched_count")} / ${str(r, "quarantined_count")} / ${str(r, "error_count")}`,
              str(r, "created_at"),
              str(r, "status") === "queued" ? (
                <Button
                  key="c"
                  onClick={() =>
                    void act(
                      () => api("POST", `/crawl-jobs/${str(r, "id")}/cancel`, {}),
                      "Đã huỷ job.",
                    )
                  }
                >
                  Huỷ #{str(r, "id")}
                </Button>
              ) : (
                ""
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
    </>
  );
}
