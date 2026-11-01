import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import type { Row } from "./api";

export interface Page {
  items: Row[];
  next_cursor: string | null;
}

/** Cursor-paged list; `path` includes the query string. */
export function useList(path: string) {
  const [items, setItems] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(
    async (cursor?: string): Promise<void> => {
      setLoading(true);
      setError("");
      try {
        const sep = path.includes("?") ? "&" : "?";
        const page = await api<Page>("GET", cursor ? `${path}${sep}cursor=${cursor}` : path);
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNext(page.next_cursor);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [path],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return {
    items,
    next,
    loading,
    error,
    reload: () => {
      void load();
    },
    more: () => next && load(next),
  };
}
