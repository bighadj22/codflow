import { useEffect, useRef, useState, type ReactNode } from "react";

function scrollableAncestor(from: HTMLElement): HTMLElement | null {
  let node = from.parentElement;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Action bar that stays pinned to the bottom of the dashboard scroll area
 * while a form is being edited, so the primary action is never scrolled out
 * of reach on a long CRUD page.
 *
 * Render it as the LAST child of the form's vertical stack: it is `sticky`,
 * not `fixed`, so it keeps its place in the flow and needs no spacer.
 */
export function StickyFormActions({
  children,
  info,
  className = "",
}: {
  children: ReactNode;
  /** Optional leading slot — a hint, a validation summary, a save state. */
  info?: ReactNode;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  // The bar is the last element in the form, so it only overlaps content while
  // the page has more to scroll — that is exactly when the elevation should
  // appear, and it settles flat once the form is scrolled to its end.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const scroller = scrollableAncestor(bar);
    if (!scroller) return;

    const update = () =>
      setPinned(
        scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1,
      );
    update();

    scroller.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(scroller);
    if (bar.parentElement) observer?.observe(bar.parentElement);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={barRef}
      className={`sticky bottom-0 z-30 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card/95 px-3 py-2.5 backdrop-blur-sm transition-shadow duration-200 supports-[backdrop-filter]:bg-card/85 ${
        pinned ? "border-border shadow-lg" : "border-border/70 shadow-xs"
      } ${className}`}
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {info && (
        <div className="me-auto min-w-0 text-xs text-muted-foreground">
          {info}
        </div>
      )}
      {children}
    </div>
  );
}
