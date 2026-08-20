"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloud, X, ImageIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPresignedUploadUrl, reorderProductImages } from "@/actions/products";
import { toast } from "sonner";
import type { ProductImage } from "@/types";

export interface PendingImage {
  clientId: string;
  key: string;
  url: string;
  file: File;
}

interface ProductImageUploaderProps {
  existingImages?: ProductImage[];
  pendingImages: PendingImage[];
  onPendingAdd: (img: PendingImage) => void;
  onPendingRemove: (clientId: string) => void;
  onExistingRemove?: (imageId: string) => void;
  onExistingReorder?: (reordered: ProductImage[]) => void;
  onPendingReorder?: (reordered: PendingImage[]) => void;
  productId?: string;
  disabled?: boolean;
  maxImages?: number;
}

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_MB = 10;

function swapAt<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function ProductImageUploader({
  existingImages = [],
  pendingImages,
  onPendingAdd,
  onPendingRemove,
  onExistingRemove,
  onExistingReorder,
  onPendingReorder,
  productId,
  disabled = false,
  maxImages = 8,
}: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState(false);

  const totalImages = existingImages.length + pendingImages.length;
  const canAddMore = totalImages < maxImages;

  // Unified list for display: existing first, then pending
  const allImages = [
    ...existingImages.map((img) => ({ id: img.id, url: img.src, isExisting: true as const })),
    ...pendingImages.map((img) => ({ id: img.clientId, url: img.url, isExisting: false as const })),
  ];

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => ACCEPTED.includes(f.type));
    if (!arr.length) {
      toast.error("Only JPG, PNG, WebP and GIF images are allowed.");
      return;
    }
    const toUpload = arr.slice(0, maxImages - totalImages);
    setUploading(true);
    try {
      for (const file of toUpload) {
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name} exceeds ${MAX_MB} MB limit.`);
          continue;
        }
        const { presignedUrl, key, publicUrl } = await getPresignedUploadUrl(file.type);
        const putRes = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);
        onPendingAdd({ clientId: crypto.randomUUID(), key, url: publicUrl, file });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || !canAddMore) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, canAddMore, totalImages]
  );

  async function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= allImages.length) return;

    const reordered = swapAt(allImages, index, target);

    const newExisting = reordered
      .filter((i) => i.isExisting)
      .map((i) => existingImages.find((e) => e.id === i.id)!)
      .filter(Boolean);

    const newPending = reordered
      .filter((i) => !i.isExisting)
      .map((i) => pendingImages.find((p) => p.clientId === i.id)!)
      .filter(Boolean);

    onExistingReorder?.(newExisting);
    onPendingReorder?.(newPending);

    if (productId && newExisting.length > 0 && onExistingReorder) {
      setReordering(true);
      try {
        const saved = await reorderProductImages(productId, newExisting.map((img) => img.id));
        onExistingReorder(saved);
      } catch {
        onExistingReorder(existingImages);
        onPendingReorder?.(pendingImages);
        toast.error("Failed to save image order. Please try again.");
      } finally {
        setReordering(false);
      }
    }
  }

  return (
    <div className="space-y-4">
      {allImages.length > 0 && (
        <div className={cn("grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3", reordering && "opacity-60 pointer-events-none")}>
          {allImages.map((img, index) => (
            <div
              key={img.id}
              className="relative group aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted shadow-sm"
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />

              {/* Position badge */}
              <div className="absolute top-1.5 start-1.5">
                <span className="text-[9px] font-black bg-black/50 text-white px-1.5 py-0.5 rounded-md">
                  {index + 1}
                </span>
              </div>

              {/* Pending badge */}
              {!img.isExisting && (
                <div className="absolute top-1.5 end-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    New
                  </span>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Move left/up */}
                {index > 0 && (
                  <button
                    type="button"
                    disabled={disabled || reordering}
                    onClick={() => moveImage(index, -1)}
                    className="absolute start-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors disabled:opacity-30"
                    aria-label="Move earlier"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                {/* Move right/down */}
                {index < allImages.length - 1 && (
                  <button
                    type="button"
                    disabled={disabled || reordering}
                    onClick={() => moveImage(index, 1)}
                    className="absolute end-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors disabled:opacity-30"
                    aria-label="Move later"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {/* Delete */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    img.isExisting
                      ? onExistingRemove?.(img.id)
                      : onPendingRemove(img.id)
                  }
                  className="absolute bottom-1.5 end-1.5 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dropzone */}
      {canAddMore && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-6",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
            (disabled || uploading) && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UploadCloud className="w-6 h-6 text-primary" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">
              {uploading ? "Uploading…" : dragging ? "Drop images here" : "Click or drag images here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, WebP, GIF · max {MAX_MB} MB · up to {maxImages - totalImages} more
            </p>
            {allImages.length > 1 && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">Hover images to reorder with arrows</p>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            disabled={disabled || uploading}
          />
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          Maximum {maxImages} images reached
        </p>
      )}
    </div>
  );
}
