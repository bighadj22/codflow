"use client";

import { useRef, useState } from "react";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPresignedUploadUrlForCategory } from "@/actions/product-groups";
import { toast } from "sonner";

interface CategoryImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_MB = 10;

export function CategoryImageUploader({ value, onChange, disabled }: CategoryImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Only JPG, PNG, WebP and GIF images are allowed.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image exceeds ${MAX_MB} MB limit.`);
      return;
    }

    setUploading(true);
    try {
      const { presignedUrl, publicUrl } = await getPresignedUploadUrlForCategory(file.type);
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
      onChange(publicUrl);
      toast.success("Image uploaded successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {value && (
        <div className="relative group aspect-video max-w-md rounded-xl overflow-hidden border border-border/50 bg-muted shadow-sm">
          <img src={value} alt="Category" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {!value && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (disabled || uploading) return;
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-12 px-6",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
            (disabled || uploading) && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          {uploading ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UploadCloud className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">
              {uploading ? "Uploading…" : dragging ? "Drop image here" : "Click or drag image here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, WebP, GIF · max {MAX_MB} MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={disabled || uploading}
          />
        </div>
      )}
    </div>
  );
}
