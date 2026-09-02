import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const DropdownCloseContext = createContext<() => void>(() => undefined);

export function DropdownMenu({
  trigger,
  triggerLabel,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  triggerLabel: string;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function close({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const isRtl = document.documentElement.dir === "rtl";
    const alignRight = align === "end" ? !isRtl : isRtl;
    const preferredLeft = alignRight
      ? triggerRect.right - menuRect.width
      : triggerRect.left;
    const left = Math.max(
      8,
      Math.min(preferredLeft, window.innerWidth - menuRect.width - 8),
    );
    const preferredTop = triggerRect.bottom + 4;
    const top =
      preferredTop + menuRect.height <= window.innerHeight - 8
        ? preferredTop
        : Math.max(8, triggerRect.top - menuRect.height - 4);
    setPosition({ top, left });
  }, [align, open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close({ restoreFocus: true });
        return;
      }
      if (event.key === "Tab") {
        close();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href][role="menuitem"]',
        ) ?? [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(
        document.activeElement as HTMLElement,
      );
      const next =
        event.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    const onClick = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      )
        close();
    };
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (
        menuRef.current &&
        target &&
        (menuRef.current === target || menuRef.current.contains(target))
      ) {
        return;
      }
      close();
    };
    const onResize = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-2xs transition-all hover:bg-muted hover:text-foreground active:scale-[0.98]"
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <DropdownCloseContext.Provider
            value={() => close({ restoreFocus: true })}
          >
            <div
              ref={menuRef}
              role="menu"
              aria-label={triggerLabel}
              style={position}
              className="fixed z-[80] max-h-72 min-w-44 overflow-y-auto overscroll-contain rounded-xl border border-border/80 bg-popover p-1 shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150"
            >
              {children}
            </div>
          </DropdownCloseContext.Provider>,
          document.body,
        )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const close = useContext(DropdownCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={() => {
        if (!disabled) {
          onClick?.();
          close();
        }
      }}
      disabled={disabled}
      className={`flex min-h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-[13px] font-medium transition-colors disabled:opacity-40 select-none ${
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </button>
  );
}

export function DropdownLink({
  children,
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const close = useContext(DropdownCloseContext);
  return (
    <a
      {...props}
      role="menuitem"
      tabIndex={-1}
      onClick={(event) => {
        props.onClick?.(event);
        close();
      }}
      className={`flex min-h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-[13px] font-medium text-foreground transition-colors hover:bg-muted/80 select-none ${className}`}
    >
      {children}
    </a>
  );
}
