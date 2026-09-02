import { useRef, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { getPresignedUploadUrl } from "@/features/product-groups/api";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_MB = 10;

export function CategoryImageUploader({ value, onChange, disabled }: { value?: string | null; onChange: (url: string | null) => void; disabled?: boolean }) {
  const common = useT("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      notify.error(common("feedback.unsupported_file"));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      notify.error(common("feedback.file_too_large"));
      return;
    }
    setUploading(true);
    try {
      const { presignedUrl, publicUrl } = await getPresignedUploadUrl(file.type);
      const putRes = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
      onChange(publicUrl);
      notify.success(common("feedback.uploaded"));
    } catch {
      notify.error(common("feedback.upload_failed"));
    } finally {
      setUploading(false);
    }
  }

  return <div className="space-y-4">
    {value && <div className="group relative aspect-video max-w-md overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
      <img src={value} alt="Category" className="size-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" disabled={disabled} onClick={() => onChange(null)} className="grid size-10 place-items-center rounded-full bg-destructive text-white hover:bg-destructive/80 disabled:opacity-50" aria-label="Remove image"><X size={20} /></button>
      </div>
    </div>}
    {!value && <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (disabled || uploading) return; const file = event.dataTransfer.files[0]; if (file) void handleFile(file); }}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition-all ${dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border/50 hover:border-primary/50 hover:bg-muted/30"} ${disabled || uploading ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
    >
      {uploading ? <Loader2 size={40} className="animate-spin text-primary" /> : <span className="grid size-14 place-items-center rounded-2xl bg-primary/10"><UploadCloud size={28} className="text-primary" /></span>}
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{uploading ? "Uploading…" : dragging ? "Drop image here" : "Click or drag image here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, GIF · max {MAX_MB} MB</p>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={(event) => event.currentTarget.files?.[0] && void handleFile(event.currentTarget.files[0])} disabled={disabled || uploading} />
    </div>}
  </div>;
}
