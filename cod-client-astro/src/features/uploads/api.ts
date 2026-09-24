import { apiFetch } from "@/lib/api";

export type ImageUploadFolder = "products" | "landing";

interface PresignedUpload {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

export interface UploadedImage {
  key: string;
  url: string;
  width: number | null;
  height: number | null;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
export const MAX_UPLOAD_MB = 10;

export type ImageUploadRejection = "unsupported_type" | "file_too_large";

export class ImageUploadRejectedError extends Error {
  constructor(public readonly reason: ImageUploadRejection) {
    super(reason === "unsupported_type" ? "Unsupported file type" : `File exceeds ${MAX_UPLOAD_MB} MB`);
    this.name = "ImageUploadRejectedError";
  }
}

export class ImageUploadFailedError extends Error {
  constructor(public readonly status: number) {
    super(`R2 upload failed: ${status}`);
    this.name = "ImageUploadFailedError";
  }
}

interface DataEnvelope<T> {
  success: boolean;
  data: T;
}

function json(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, "Content-Type": "application/json" } };
}

/** The one presign call — every dashboard image upload goes through here. */
export async function presignImageUpload(contentType: string, folder: ImageUploadFolder): Promise<PresignedUpload> {
  return (
    await apiFetch<DataEnvelope<PresignedUpload>>(
      "/api/images/presign",
      json({ method: "POST", body: JSON.stringify({ contentType, folder }) }),
    )
  ).data;
}

/** Direct browser → R2 PUT against the presigned URL. */
export async function putFileToR2(presignedUrl: string, file: File): Promise<void> {
  const putRes = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!putRes.ok) throw new ImageUploadFailedError(putRes.status);
}

/** Same selection semantics the three uploaders had: unsupported types are
 *  counted over ALL selected files, oversized only over the type-accepted
 *  ones; `accepted` passes both filters. */
export function partitionUploadFiles(files: File[]): {
  accepted: File[];
  unsupportedCount: number;
  tooLargeCount: number;
} {
  const unsupportedCount = files.filter((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type)).length;
  const typeAccepted = files.filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type));
  const tooLargeCount = typeAccepted.filter((file) => file.size > MAX_UPLOAD_MB * 1024 * 1024).length;
  return {
    accepted: typeAccepted.filter((file) => file.size <= MAX_UPLOAD_MB * 1024 * 1024),
    unsupportedCount,
    tooLargeCount,
  };
}

/** Throws ImageUploadRejectedError for a file that must not be uploaded. */
export function validateUploadFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new ImageUploadRejectedError("unsupported_type");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new ImageUploadRejectedError("file_too_large");
}

/** Intrinsic pixel size of a file, measured locally. Resolves null on decode
 *  failure or in non-DOM runtimes — dimension capture is fail-open, never
 *  blocks an upload; the storefront just renders that image without reserved
 *  space. Moved here from the landing-page studio. */
export function measureImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof Image === "undefined" || typeof URL?.createObjectURL !== "function") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Presign → PUT → measure. One implementation for all dashboard uploads. */
export async function uploadImageFile(file: File, folder: ImageUploadFolder): Promise<UploadedImage> {
  validateUploadFile(file);
  const { presignedUrl, key, publicUrl } = await presignImageUpload(file.type, folder);
  await putFileToR2(presignedUrl, file);
  const dims = await measureImageDimensions(file);
  return { key, url: publicUrl, width: dims?.width ?? null, height: dims?.height ?? null };
}
