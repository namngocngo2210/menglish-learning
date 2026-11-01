import { useState } from "react";
import { Button, Card } from "./ui";
import { KEYS } from "../lib/validate";

/** How the student sees a question. All strings render as text (React escapes them). */
export function Preview({
  passage,
  stem,
  options,
  correct,
  explanation,
}: {
  passage?: string;
  stem: string;
  options: string[];
  correct: string;
  explanation: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <Card aria-label="Xem trước" className="bg-surface">
      <h2 className="mb-2 text-lg font-bold">Xem trước</h2>
      {passage && (
        <p className="mb-3 whitespace-pre-wrap rounded-lg bg-warm p-3 text-sm">{passage}</p>
      )}
      <p className="mb-3 font-bold">{stem || "(chưa có đề bài)"}</p>
      <ul className="mb-3 flex flex-col gap-2">
        {KEYS.map((k, i) => (
          <li
            key={k}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3"
          >
            <span className="grid size-7 place-items-center rounded-full bg-sky-soft font-bold text-primary">
              {k}
            </span>
            <span>{(options[i] ?? "") === "" ? "…" : options[i]}</span>
            {reveal && correct === k && (
              <span className="ml-auto text-sm font-bold text-ok">Đúng</span>
            )}
          </li>
        ))}
      </ul>
      <Button
        aria-expanded={reveal}
        onClick={() => {
          setReveal(!reveal);
        }}
      >
        {reveal ? "Ẩn giải thích" : "Hiện giải thích"}
      </Button>
      {reveal && <p className="mt-3 text-sm">{explanation || "(chưa có giải thích)"}</p>}
    </Card>
  );
}
