import { Card } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { ProductImage } from "@/features/products/types";

export function ProductImagesCard({
  productName,
  images,
}: {
  productName: string;
  images: ProductImage[];
}) {
  const t = useT("products");

  if (!images || images.length === 0) return null;

  return (
    <Card title={`${t("form.images_label")} (${images.length})`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
          >
            <img
              src={image.srcMd || image.src}
              alt={image.altText || `${productName} - ${index + 1}`}
              className="size-full object-cover"
            />
            <span className="absolute bottom-2 start-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
              #{image.position}
            </span>
            {index === 0 && (
              <span className="absolute end-2 top-2 rounded-md bg-primary px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                {t("form.primary_image")}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
