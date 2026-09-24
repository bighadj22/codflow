import type { UploadFunction } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { uploadImageFile } from "@/features/uploads/api";

/**
 * Inline description images go through the dashboard's single upload seam
 * (`features/uploads`), not the template's demo uploader: presign → direct
 * PUT to R2 → return the public URL the editor stores in `img src`.
 *
 * Rejections (wrong type, over the size cap) propagate as thrown errors, which
 * the upload node reports through its `onError` handler.
 */
export const uploadDescriptionImage: UploadFunction = async (file, onProgress) => {
  onProgress?.({ progress: 0 });
  const uploaded = await uploadImageFile(file, "products");
  onProgress?.({ progress: 100 });
  return uploaded.url;
};
