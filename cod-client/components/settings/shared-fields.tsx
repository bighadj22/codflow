"use client";

import { useState } from "react";
import { Save, Loader2, Eye, EyeOff } from "lucide-react";

// ── Input class constant ──────────────────────────────────────────────────────

export const inputCls =
  "w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

// ── Section card ──────────────────────────────────────────────────────────────

export interface SectionProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
}

export function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  onSave,
  saving,
  saveLabel,
  savingLabel,
}: SectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-6 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon size={18} className="text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-5 px-6 py-5">{children}</div>
      <div className="flex justify-end border-t border-border px-6 py-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}

// ── Color picker row ──────────────────────────────────────────────────────────

export interface ColorFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, hint, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 space-y-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          dir="ltr"
          className="h-9 w-28 rounded-lg border border-border bg-muted px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}

// ── Password input with show/hide toggle ─────────────────────────────────────

export interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  error,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  
  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={[
            inputCls,
            "pe-10",
            error ? "border-destructive focus:ring-destructive" : "",
          ].join(" ")}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

export interface FieldRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
