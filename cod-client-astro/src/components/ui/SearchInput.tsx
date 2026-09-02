import { Search, X } from "lucide-react";
import { useT } from "@/i18n/react";

/** Search field with a one-click clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const common = useT("common");
  return (
    <label className={`relative block min-w-0 flex-1 ${className}`}>
      <Search
        size={15}
        strokeWidth={1.9}
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input/80 bg-card ps-9 pe-8 text-sm outline-none transition-all placeholder:text-muted-foreground/60 hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20 shadow-2xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={common("cancel")}
          className="absolute end-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={13} />
        </button>
      )}
    </label>
  );
}
