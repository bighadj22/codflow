import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectVariant = "default" | "bare" | "inverted" | "pill";
export type SelectSize = "default" | "sm";

interface SelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "children" | "className" | "size" | "value" | "onChange" | "prefix"
  > {
  children?: ReactNode;
  className?: string;
  wrapperClassName?: string;
  triggerClassName?: string;
  variant?: SelectVariant;
  size?: SelectSize;
  prefix?: ReactNode;
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}

type Option = { value: string; label: string; disabled: boolean };

function parseOptions(children: ReactNode): Option[] {
  return Children.toArray(children)
    .filter(
      (child): child is ReactElement =>
        isValidElement(child) && child.type === "option",
    )
    .map((child) => {
      const props = child.props as {
        value?: unknown;
        disabled?: boolean;
        children?: ReactNode;
      };
      return {
        value: String(props.value ?? ""),
        label: String(props.children ?? ""),
        disabled: Boolean(props.disabled),
      };
    });
}

const triggerBase =
  "group/select relative flex w-full items-center gap-2 rounded-lg outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 select-none";

function triggerClasses(variant: SelectVariant, size: SelectSize): string {
  const dimensions =
    variant === "default"
      ? size === "sm"
        ? "h-8 text-xs px-2.5 pe-7"
        : "h-9 text-[13.5px] px-3 pe-8"
      : "";
  const perVariant: Record<SelectVariant, string> = {
    default:
      "border border-input/80 bg-card text-foreground shadow-2xs hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20",
    bare: "h-9 bg-transparent ps-0.5 pe-6 text-sm text-foreground focus:ring-2 focus:ring-ring/20",
    inverted:
      "h-9 border border-white/15 bg-white/10 px-2.5 pe-8 text-xs font-semibold text-white hover:bg-white/15 focus:ring-2 focus:ring-white/30",
    pill: "h-auto min-w-0 rounded-full border border-border/80 px-2.5 pe-6 py-1 text-xs font-semibold focus:ring-2 focus:ring-ring/20 bg-card",
  };
  return `${triggerBase} ${perVariant[variant]} ${dimensions}`;
}

const chevronClass: Record<SelectVariant, string> = {
  default: "end-2.5 text-muted-foreground/70",
  bare: "end-0 text-muted-foreground/70",
  inverted: "end-2 text-white/60",
  pill: "end-1.5 text-muted-foreground/70",
};

export function Select({
  children,
  className = "",
  wrapperClassName = "",
  triggerClassName = "",
  variant = "default",
  size = "default",
  prefix,
  value: rawValue,
  onChange,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
  ...rest
}: SelectProps) {
  const value = rawValue == null ? "" : String(rawValue);
  const options = useMemo(() => parseOptions(children), [children]);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const hiddenRef = useRef<HTMLSelectElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const placeholder = options.find((option) => option.value === "");
  const showingPlaceholder = value === "" && placeholder != null;
  const label =
    selectedIndex >= 0
      ? options[selectedIndex].label
      : showingPlaceholder
        ? placeholder!.label
        : value;

  function openDropdown() {
    if (rest.disabled) return;
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setPos({ left: rect.left, top: rect.bottom + 6, width: rect.width });
      setOpenUp(false);
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Close only on external scroll/resize so internal list scrolling works smoothly
  useEffect(() => {
    if (!open) return;
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (
        panelRef.current &&
        target &&
        (panelRef.current === target || panelRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setActiveIndex(-1);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || !panelRef.current || !pos) return;
    const panel = panelRef.current;
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = pos.left;
    let top = pos.top;
    let up = openUp;
    if (rect.right > vw - 8) left = Math.max(8, vw - rect.width - 8);
    if (rect.left < 8) left = 8;
    if (rect.bottom > vh - 8) {
      const trigger = triggerRef.current;
      if (trigger) {
        top = trigger.getBoundingClientRect().top - rect.height - 6;
        up = true;
      }
    } else if (rect.top < 8) {
      const trigger = triggerRef.current;
      if (trigger) {
        top = trigger.getBoundingClientRect().bottom + 6;
        up = false;
      }
    }
    if (left !== pos.left || top !== pos.top || up !== openUp) {
      setPos({ left, top, width: pos.width });
      setOpenUp(up);
    }
  }, [open, pos, openUp]);

  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    if (hiddenRef.current) hiddenRef.current.value = option.value;
    onChange?.({
      currentTarget: { value: option.value },
      target: { value: option.value },
    } as ChangeEvent<HTMLSelectElement>);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (rest.disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const panel = open ? (
    createPortal(
      <ul
        ref={panelRef}
        id={`${rootId}-listbox`}
        role="listbox"
        aria-label={ariaLabel}
        style={
          pos
            ? { left: pos.left, top: pos.top, width: Math.max(pos.width, 180) }
            : undefined
        }
        className="fixed z-[80] max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return (
            <li
              key={option.value}
              id={`${rootId}-opt-${index}`}
              role="option"
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              data-option-index={index}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event: MouseEvent<HTMLLIElement>) => {
                event.preventDefault();
                commit(index);
              }}
              className={`flex min-h-[34px] cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium outline-none transition-colors ${
                isActive ? "bg-muted/80 text-foreground" : ""
              } ${
                isSelected
                  ? "bg-brand/[0.08] font-semibold text-brand dark:bg-brand/15 dark:text-brand"
                  : "text-foreground/85"
              } ${option.disabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate text-start">
                {option.label}
              </span>
              {isSelected && (
                <Check
                  size={14}
                  strokeWidth={2.2}
                  className="shrink-0 text-brand"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ul>,
      document.body,
    )
  ) : null;

  return (
    <div ref={wrapperRef} className={`relative ${wrapperClassName}`}>
      <select
        ref={hiddenRef}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={onChange}
        {...rest}
      >
        {children}
      </select>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${rootId}-listbox` : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${rootId}-opt-${activeIndex}` : undefined
        }
        disabled={rest.disabled}
        onClick={() => {
          if (rest.disabled) return;
          if (open) setOpen(false);
          else openDropdown();
        }}
        onKeyDown={onTriggerKeyDown}
        className={`${triggerClasses(variant, size)} ${triggerClassName} ${className}`}
      >
        {prefix && (
          <span
            className="pointer-events-none shrink-0 text-muted-foreground/70"
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-start ${
            showingPlaceholder ? "text-muted-foreground" : ""
          }`}
        >
          {label}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          } ${chevronClass[variant]}`}
        />
      </button>

      {panel}
    </div>
  );
}
