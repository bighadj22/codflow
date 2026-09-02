import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerOutline"
  | "outline"
  | "brand";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95",
  secondary:
    "border border-border/90 bg-card text-card-foreground shadow-xs hover:bg-muted/70 hover:border-input active:bg-muted",
  ghost:
    "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted",
  danger:
    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/95",
  dangerOutline:
    "border border-destructive/25 bg-destructive/[0.04] text-destructive hover:bg-destructive/10 active:bg-destructive/15",
  outline:
    "border border-input bg-transparent text-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted",
  brand:
    "bg-brand text-brand-foreground shadow-xs hover:bg-brand/90 active:bg-brand/95",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-9 px-3.5 text-[13.5px]",
  sm: "h-8 px-2.5 text-xs",
  lg: "h-10 px-5 text-sm",
  icon: "size-9 p-0",
};

export function buttonVariants(
  options: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
  } = {},
) {
  const { variant = "primary", size = "default", className = "" } = options;
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(function Button(
  { variant = "primary", size = "default", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={buttonVariants({ variant, size, className })}
    />
  );
});
