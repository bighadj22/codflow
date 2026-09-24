import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff } from "lucide-react";
import { useT } from "@/i18n/react";
import type { ProductImage } from "@/features/products/types";

const GAP = 6;
const EDGE = 8;

interface VariantImagePickerProps {
  images: ProductImage[];
  value: string | null;
  onChange: (imageId: string | null) => void;
  disabled?: boolean;
}

/**
 * Picks which product image represents one variant row.
 *
 * The panel is portalled and fixed rather than absolutely positioned in the
 * cell: the variants table scrolls horizontally, and an `overflow-x` container
 * clips on both axes, so a panel positioned inside it is invisible however high
 * its z-index. This is the same escape the Select and DropdownMenu primitives
 * make, and it is why the trigger's rect is measured on open instead of relying
 * on the cell for placement.
 */
export function VariantImagePicker({
  images,
  value,
  onChange,
  disabled = false,
}: VariantImagePickerProps) {
  const t = useT("products");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const selected = value ? images.find((img) => img.id === value) : undefined;

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const anchor = trigger.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const left = Math.min(
      Math.max(EDGE, anchor.left + anchor.width / 2 - width / 2),
      Math.max(EDGE, window.innerWidth - width - EDGE),
    );
    const below = anchor.bottom + GAP;
    const top =
      below + height > window.innerHeight - EDGE && anchor.top - GAP - height > EDGE
        ? anchor.top - GAP - height
        : below;
    setPos((prev) =>
      prev && prev.left === left && prev.top === top ? prev : { left, top },
    );
  }, []);

  // Before paint, so the panel never shows at the wrong spot first.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Capture: the table and the dashboard shell both scroll, and neither
    // scroll event reaches window by bubbling.
    const onScroll = () => place();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function pick(imageId: string | null) {
    onChange(imageId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("form.variant_image_select")}
        title={t("form.variant_image_select")}
        className={`mx-auto grid size-10 place-items-center overflow-hidden rounded-lg border-2 transition-colors disabled:opacity-50 ${
          selected
            ? "border-primary"
            : "border-dashed border-border bg-muted/20 text-muted-foreground hover:border-primary/40"
        }`}
      >
        {selected ? (
          <img src={selected.src} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="text-base leading-none">
            +
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("form.variant_image_select")}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
            className="fixed z-[80] w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-border/80 bg-popover p-2 shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95 duration-150"
          >
            <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {t("form.variant_image_select")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {images.map((img) => {
                const isSelected = img.id === value;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => pick(isSelected ? null : img.id)}
                    aria-pressed={isSelected}
                    className={`size-14 overflow-hidden rounded-lg border-2 transition-opacity ${
                      isSelected
                        ? "border-primary shadow-md"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.src}
                      alt=""
                      className="size-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
            {value && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <ImageOff size={13} />
                {t("form.variant_image_remove")}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
