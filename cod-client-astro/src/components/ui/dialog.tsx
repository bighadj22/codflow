import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/react";

export function Dialog({
  open = true,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  className = "",
  role = "dialog",
  initialFocusRef,
  preventClose = false,
  showClose = true,
  placement = "center",
}: {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
  initialFocusRef?: RefObject<HTMLElement | null>;
  preventClose?: boolean;
  showClose?: boolean;
  placement?: "center" | "end";
}) {
  const common = useT("common");
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (initialFocusRef?.current ?? focusable()[0] ?? dialogRef.current)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !preventClose) onCloseRef.current();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [initialFocusRef, open, preventClose]);

  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-[70] flex bg-[var(--overlay)] backdrop-blur-2xs ${
        placement === "end"
          ? "items-end justify-center sm:items-stretch sm:justify-end"
          : "items-end justify-center p-3 sm:items-center sm:p-4"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !preventClose) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative w-full overflow-y-auto border border-border/80 bg-card shadow-2xl ${
          placement === "end"
            ? "max-h-[85dvh] rounded-t-2xl border-b-0 p-4 sm:h-full sm:max-h-full sm:w-[440px] sm:rounded-none sm:border-y-0 sm:border-e-0 sm:p-6"
            : "max-h-[calc(100dvh-1.5rem)] max-w-lg rounded-2xl p-5 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
        } ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            {icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/60 text-muted-foreground shadow-2xs">
                {icon}
              </span>
            )}
            <div className="min-w-0 pt-0.5">
              <h2
                id={titleId}
                className="text-base font-bold tracking-tight text-foreground"
              >
                {title}
              </h2>
              {description && (
                <p
                  id={descriptionId}
                  className="mt-1 text-[13px] leading-relaxed text-muted-foreground"
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={preventClose}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label={common("close")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {children && <div className="mt-5">{children}</div>}
        {footer && (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
