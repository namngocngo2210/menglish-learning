import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import { label, PATH } from "../lib/transitions";

export function Stepper({ status }: { status: string }) {
  const at = PATH.indexOf(status as (typeof PATH)[number]);
  return (
    <ol aria-label="Quy trình duyệt" className="mb-3 flex flex-wrap gap-2 text-sm">
      {PATH.map((s, i) => (
        <li
          key={s}
          aria-current={s === status ? "step" : undefined}
          className={cn(
            "flex items-center gap-1 rounded-full border px-3 py-1",
            s === status
              ? "border-ink bg-cta font-bold"
              : i < at
                ? "border-ok text-ok"
                : "border-line text-ink-soft",
          )}
        >
          {i < at && <Check aria-hidden className="size-4" />} {label(s)}
        </li>
      ))}
      {at < 0 && (
        <li className="rounded-full border border-ink px-3 py-1 font-bold">{label(status)}</li>
      )}
    </ol>
  );
}
