import type { ReactNode } from "react";

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
  as: Tag = "label",
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * `div` for children that are not one labelable control — a composite widget
   * such as the rich-text editor. A `label` forwards every click inside it to
   * its first labelable descendant, which for that editor is the toolbar's
   * first button (Undo), so typing then clicking the text would undo the edit.
   */
  as?: "label" | "div";
}) {
  return (
    <Tag className={`block space-y-1.5 ${className}`}>
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
    </Tag>
  );
}
