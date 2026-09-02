import type { ReactNode } from "react";

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="block text-[13px] font-semibold tracking-tight text-foreground select-none">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs font-medium text-muted-foreground/75">
          {hint}
        </span>
      )}
      {error && (
        <span
          className="block text-xs font-medium text-destructive animate-in fade-in-0 duration-150"
          role="alert"
        >
          {error}
        </span>
      )}
    </label>
  );
}
