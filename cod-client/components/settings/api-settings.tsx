"use client";

import { useState } from "react";
import { Key, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useSettings } from "@/lib/translations";
import { type StoreConfig } from "@/actions/stores";
import { inputCls } from "./shared-fields";

interface ApiSettingsProps {
  storeConfig: StoreConfig;
}

export function ApiSettings({ storeConfig }: ApiSettingsProps) {
  const t = useSettings();
  const s = t.store;
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const apiKey = storeConfig.storeApiKey;

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border px-6 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Key size={18} className="text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{s.api_key_title}</h2>
          <p className="text-xs text-muted-foreground">{s.api_key_subtitle}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {apiKey ? (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">{s.api_key_label}</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  readOnly
                  dir="ltr"
                  type={revealed ? "text" : "password"}
                  value={apiKey}
                  className={[inputCls, "pe-10 font-mono select-all cursor-default"].join(" ")}
                />
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  title={revealed ? s.api_key_hide : s.api_key_reveal}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                title={s.api_key_copy}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-500" />
                    {s.api_key_copied}
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    {s.api_key_copy}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{s.api_key_missing}</p>
        )}
      </div>
    </div>
  );
}
