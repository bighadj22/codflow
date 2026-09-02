import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, UploadCloud, X } from "lucide-react";
import { getPresignedUploadUrl, reorderProductImages } from "@/features/products/api";
import type { ProductImage } from "@/features/products/types";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

export interface PendingImage {
  clientId: string;
  key: string;
  url: string;
}

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_MB = 10;

function swapAt<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

interface DisplayImage {
  id: string;
  url: string;
  isExisting: boolean;
}

export function ProductImageUploader({ existingImages, pendingImages, productId, disabled, onPendingAdd, onPendingRemove, onExistingRemove, onExistingReorder, onPendingReorder }: {
  existingImages: ProductImage[];
  pendingImages: PendingImage[];
  productId?: string;
  disabled?: boolean;
  onPendingAdd: (img: PendingImage) => void;
  onPendingRemove: (clientId: string) => void;
  onExistingRemove: (imageId: string) => void;
  onExistingReorder: (reordered: ProductImage[]) => void;
  onPendingReorder: (reordered: PendingImage[]) => void;
}) {
  const common = useT("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState(false);

  const allImages: DisplayImage[] = [
    ...existingImages.map((img) => ({ id: img.id, url: img.src, isExisting: true as const })),
    ...pendingImages.map((img) => ({ id: img.clientId, url: img.url, isExisting: false as const })),
  ];

  async function handleFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.some((file) => !ACCEPTED.includes(file.type)))
      notify.error(common("feedback.unsupported_file"));
    const accepted = selected.filter((file) => ACCEPTED.includes(file.type));
    if (accepted.some((file) => file.size > MAX_MB * 1024 * 1024))
      notify.error(common("feedback.file_too_large"));
    const arr = accepted.filter((file) => file.size <= MAX_MB * 1024 * 1024);
    if (!arr.length) return;
    setUploading(true);
    try {
      for (const file of arr) {
        const { presignedUrl, key, publicUrl } = await getPresignedUploadUrl(file.type);
        const putRes = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);
        onPendingAdd({ clientId: crypto.randomUUID(), key, url: publicUrl });
      }
      notify.success(common("feedback.uploaded"));
    } catch {
      notify.error(common("feedback.upload_failed"));
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    void handleFiles(event.dataTransfer.files);
  }, [disabled]);

  async function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= allImages.length) return;
    const reordered = swapAt(allImages, index, target);
    const newExisting = reordered.filter((item) => item.isExisting).map((item) => existingImages.find((img) => img.id === item.id)!).filter(Boolean);
    const newPending = reordered.filter((item) => !item.isExisting).map((item) => pendingImages.find((img) => img.clientId === item.id)!).filter(Boolean);
    onExistingReorder(newExisting);
    onPendingReorder(newPending);
    if (productId && newExisting.length > 0) {
      setReordering(true);
      try {
        onExistingReorder((await reorderProductImages(productId, newExisting.map((img) => img.id))).data);
        notify.success(common("feedback.updated"));
      } catch {
        notify.error(common("feedback.action_failed"));
      } finally {
        setReordering(false);
      }
    }
  }

  return <div className="space-y-4">
    {allImages.length > 0 && <div className={`grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 ${reordering ? "pointer-events-none opacity-60" : ""}`}>
      {allImages.map((img, index) => <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
        <img src={img.url} alt="" className="size-full object-cover" />
        <span className="absolute start-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">{index + 1}</span>
        {!img.isExisting && <span className="absolute end-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">New</span>}
        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {index > 0 && <button type="button" disabled={disabled || reordering} onClick={() => void moveImage(index, -1)} className="absolute start-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white hover:bg-white/40 disabled:opacity-30" aria-label="Move earlier"><ChevronLeft size={16} /></button>}
          {index < allImages.length - 1 && <button type="button" disabled={disabled || reordering} onClick={() => void moveImage(index, 1)} className="absolute end-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white hover:bg-white/40 disabled:opacity-30" aria-label="Move later"><ChevronRight size={16} /></button>}
          <button type="button" disabled={disabled} onClick={() => img.isExisting ? onExistingRemove(img.id) : onPendingRemove(img.id)} className="absolute bottom-1.5 end-1.5 grid size-7 place-items-center rounded-full bg-destructive text-white hover:bg-destructive/80 disabled:opacity-50" aria-label="Remove"><X size={14} /></button>
        </div>
      </div>)}
    </div>}
    <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-all ${dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border/50 hover:border-primary/50 hover:bg-muted/30"} ${disabled || uploading ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
    >
      {uploading ? <Loader2 size={32} className="animate-spin text-primary" /> : <span className="grid size-12 place-items-center rounded-2xl bg-primary/10"><UploadCloud size={24} className="text-primary" /></span>}
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{uploading ? "Uploading…" : dragging ? "Drop images here" : "Click or drag images here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, GIF · max {MAX_MB} MB</p>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} multiple className="hidden" onChange={(event) => event.currentTarget.files && void handleFiles(event.currentTarget.files)} disabled={disabled || uploading} />
    </div>
  </div>;
}
