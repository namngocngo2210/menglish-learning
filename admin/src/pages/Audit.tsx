import { Button, DataTable, Empty, Loading, Notice, PageTitle } from "../components/ui";
import { str } from "../lib/api";
import { useList } from "../lib/form";

export function Audit() {
  const list = useList("/audit?limit=50");
  return (
    <>
      <PageTitle>Nhật ký thao tác</PageTitle>
      {list.error && <Notice>{list.error}</Notice>}
      {list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <Empty>Chưa có sự kiện.</Empty>
      ) : (
        <DataTable
          head={["Thời gian", "Hành động", "Đối tượng", "Chi tiết"]}
          rows={list.items.map((r) => ({
            key: str(r, "id"),
            cells: [
              str(r, "created_at"),
              str(r, "action"),
              `${str(r, "entity_type")} ${str(r, "entity_id")}`,
              <code key="d" className="whitespace-pre-wrap text-xs">
                {r["details"] ? JSON.stringify(r["details"]) : "—"}
              </code>,
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
