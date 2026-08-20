"use client";

import { useRef } from "react";
import { Upload, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProducts } from "@/lib/translations";

interface Props {
  images: File[];
  onChange: (images: File[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export function ImageGallery({ images, onChange, maxImages = 10, disabled = false }: Props) {
  const t = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => file.type.startsWith("image/"));
    
    if (images.length + validFiles.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }
    
    onChange([...images, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDelete(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter((file) => file.type.startsWith("image/"));
    
    if (images.length + validFiles.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }
    
    onChange([...images, ...validFiles]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground font-bold">
        {t.form.images_label}
      </Label>

      {images.length < maxImages && !disabled && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
        >
          <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground mb-1">
            {t.form.upload_images}
          </p>
          <p className="text-xs text-muted-foreground">
            Drag and drop or click to select
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-xl border border-border overflow-hidden bg-muted group"
            >
              <img
                src={URL.createObjectURL(image)}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1">
                  <Star size={10} fill="currentColor" />
                  {t.form.primary_image}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(index)}
                disabled={disabled}
                className="absolute top-2 right-2 h-7 w-7 p-0 bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
