import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button";

export function LinkButton({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <a {...props} className={buttonVariants({ variant, size, className })} />
  );
}

export function IconButton({
  variant = "ghost",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "solid" | "secondary" | "danger";
  size?: "default" | "sm";
}) {
  const variants = {
    ghost: "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted",
    solid: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95",
    secondary:
      "border border-border/90 bg-card text-foreground shadow-xs hover:bg-muted/70 hover:border-input active:bg-muted",
    danger: "text-destructive hover:bg-destructive/10 active:bg-destructive/15",
  };
  const sizeClasses = {
    default: "size-9 rounded-lg",
    sm: "size-8 rounded-md",
  };
  return (
    <button
      {...props}
      className={`grid shrink-0 place-items-center transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${sizeClasses[size]} ${variants[variant]} ${className}`}
    />
  );
}
