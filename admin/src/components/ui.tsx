import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { label } from "../lib/transitions";

type Variant = "primary" | "outline" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-cta text-ink hover:bg-cta-hover font-bold",
  outline: "border border-ink/40 bg-white text-ink hover:bg-warm",
  danger: "bg-danger text-white hover:opacity-90 font-bold",
  ghost: "text-primary hover:bg-sky-soft",
};

export function Button({
  variant = "outline",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label: text,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const desc = error || hint ? `${id}-d` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {text}
      </label>
      {children(id, desc)}
      {error ? (
        <p id={desc} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={desc} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputCls =
  "min-h-11 w-full rounded-lg border border-ink/40 bg-white px-3 py-2 text-base text-ink";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-white p-4", className)}>
      {children}
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  published: "bg-green-100 text-ok",
  in_review: "bg-sky-soft text-primary",
  quarantine: "bg-warm text-ink",
  draft: "bg-neutral-100 text-ink",
  rejected: "bg-red-100 text-danger",
  archived: "bg-neutral-200 text-ink",
};
export const Badge = ({ status }: { status: string }) => (
  <span
    className={cn(
      "inline-block rounded-full px-2 py-0.5 text-xs font-bold",
      STATUS_TONE[status] ?? "bg-neutral-100",
    )}
  >
    {label(status)}
  </span>
);

export const PageTitle = ({ children }: { children: ReactNode }) => (
  <h1 className="mb-4 text-2xl font-bold">{children}</h1>
);

export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "ok";
  children: ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "mb-3 rounded-lg px-3 py-2 text-sm",
        kind === "error" ? "bg-red-50 text-danger" : "bg-green-50 text-ok",
      )}
    >
      {children}
    </p>
  );
}

export const Loading = () => (
  <p role="status" className="flex items-center gap-2 py-6 text-ink-soft">
    <Loader2 aria-hidden className="size-4 animate-spin" /> Đang tải…
  </p>
);
export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg border border-dashed border-line py-8 text-center text-ink-soft">
    {children}
  </p>
);

/** Modal confirm on the native <dialog>: focus trap and Esc come from the platform. */
export function Confirm({
  open,
  title,
  children,
  confirmText,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,28rem)] rounded-xl p-5 text-ink backdrop:bg-black/50"
    >
      <h2 id="confirm-title" className="mb-2 text-lg font-bold">
        {title}
      </h2>
      <div className="mb-4 text-sm">{children}</div>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Huỷ</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </dialog>
  );
}

/** Table on wide screens, stacked cards below md (each cell carries its own label). */
export function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <table className="w-full text-left text-sm max-md:block">
        <thead className="max-md:sr-only">
          <tr className="bg-warm">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line max-md:block max-md:p-3">
              {r.cells.map((c, i) => (
                <td
                  key={head[i]}
                  className="px-3 py-2 align-top max-md:flex max-md:gap-2 max-md:px-0 max-md:py-1"
                >
                  <span className="font-bold md:hidden">{head[i]}:</span>
                  <span className="min-w-0">{c}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
