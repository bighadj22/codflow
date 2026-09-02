import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputClass =
  "h-9 w-full rounded-lg border border-input/80 bg-card px-3 text-sm text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground/60 hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export const textareaClass =
  "min-h-24 w-full resize-y rounded-lg border border-input/80 bg-card px-3 py-2 text-sm text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground/60 hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs";

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${textareaClass} ${className}`} />;
}
