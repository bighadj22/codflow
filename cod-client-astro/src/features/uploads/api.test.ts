import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import {
  ACCEPTED_IMAGE_TYPES,
  ImageUploadFailedError,
  ImageUploadRejectedError,
  MAX_UPLOAD_MB,
  measureImageDimensions,
  partitionUploadFiles,
  presignImageUpload,
  putFileToR2,
  uploadImageFile,
  validateUploadFile,
} from "./api";

function makeFile(input: { type?: string; size?: number } = {}): File {
  const { type = "image/jpeg", size = 100 } = input;
  const bytes = new Uint8Array(size);
  return new File([bytes], "img.jpg", { type });
}

const PRESIGNED = {
  presignedUrl: "https://r2.example/presigned-put",
  key: "products/abc123.jpg",
  publicUrl: "https://media.example/products/abc123.jpg",
};

beforeEach(() => {
  vi.clearAllMocks();
  seam.apiFetch.mockResolvedValue({ success: true, data: PRESIGNED });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presignImageUpload", () => {
  it("posts contentType + folder to the existing presign endpoint and unwraps the envelope", async () => {
    await expect(presignImageUpload("image/png", "products")).resolves.toEqual(PRESIGNED);
    expect(seam.apiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = seam.apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/images/presign");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ contentType: "image/png", folder: "products" }));
  });

  it("sends the landing folder unchanged", async () => {
    await presignImageUpload("image/webp", "landing");
    expect(seam.apiFetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ contentType: "image/webp", folder: "landing" }));
  });

  it("propagates seam errors", async () => {
    seam.apiFetch.mockRejectedValue(new Error("401"));
    await expect(presignImageUpload("image/png", "products")).rejects.toThrow("401");
  });
});

describe("file validation (MIME/size rejection)", () => {
  it("accepts every type the endpoint allow-lists", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(() => validateUploadFile(makeFile({ type }))).not.toThrow();
    }
  });

  it("rejects unsupported MIME before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => validateUploadFile(makeFile({ type: "application/pdf" }))).toThrow(ImageUploadRejectedError);
    expect(() => validateUploadFile(makeFile({ type: "application/pdf" }))).toThrow(
      expect.objectContaining({ reason: "unsupported_type" }) as never,
    );

    await expect(uploadImageFile(makeFile({ type: "image/svg+xml" }), "products")).rejects.toMatchObject({
      reason: "unsupported_type",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(seam.apiFetch).not.toHaveBeenCalled();
  });

  it("rejects files over 10 MB before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const tooBig = makeFile({ size: MAX_UPLOAD_MB * 1024 * 1024 + 1 });
    expect(() => validateUploadFile(tooBig)).toThrow(ImageUploadRejectedError);
    expect(() => validateUploadFile(tooBig)).toThrow(
      expect.objectContaining({ reason: "file_too_large" }) as never,
    );
    await expect(uploadImageFile(tooBig, "products")).rejects.toMatchObject({ reason: "file_too_large" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(seam.apiFetch).not.toHaveBeenCalled();
  });

  it("accepts a file exactly at the size cap", () => {
    expect(() => validateUploadFile(makeFile({ size: MAX_UPLOAD_MB * 1024 * 1024 }))).not.toThrow();
  });

  it("partitionUploadFiles preserves the call sites' selection semantics", () => {
    const good = makeFile({ type: "image/png" });
    const big = makeFile({ type: "image/png", size: MAX_UPLOAD_MB * 1024 * 1024 + 5 });
    const bad = makeFile({ type: "text/html" });

    const result = partitionUploadFiles([good, big, bad, bad]);
    expect(result.accepted).toEqual([good]);
    expect(result.unsupportedCount).toBe(2);
    expect(result.tooLargeCount).toBe(1);

    expect(partitionUploadFiles([])).toEqual({ accepted: [], unsupportedCount: 0, tooLargeCount: 0 });
    expect(partitionUploadFiles([bad]).accepted).toEqual([]);
    expect(partitionUploadFiles([good]).unsupportedCount).toBe(0);
  });
});

describe("putFileToR2", () => {
  it("PUTs the file with its Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const file = makeFile({ type: "image/png" });
    await expect(putFileToR2(PRESIGNED.presignedUrl, file)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      PRESIGNED.presignedUrl,
      expect.objectContaining({ method: "PUT", body: file }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("image/png");
  });

  it.each([403, 500])("throws ImageUploadFailedError on non-2xx PUT (%s)", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(putFileToR2(PRESIGNED.presignedUrl, makeFile())).rejects.toMatchObject({
      name: "ImageUploadFailedError",
      status,
    });
  });
});

describe("uploadImageFile (presign → PUT → measure)", () => {
  it("returns key + publicUrl, measuring dimensions fail-open", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImageFile(makeFile({ type: "image/jpeg" }), "products");
    expect(result).toEqual({ key: PRESIGNED.key, url: PRESIGNED.publicUrl, width: null, height: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seam.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("aborts after a failed PUT and never reports success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImageFile(makeFile(), "products")).rejects.toBeInstanceOf(ImageUploadFailedError);
    expect(seam.apiFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not presign when validation rejects", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(uploadImageFile(makeFile({ type: "application/zip" }), "landing")).rejects.toBeInstanceOf(
      ImageUploadRejectedError,
    );
    expect(seam.apiFetch).not.toHaveBeenCalled();
  });
});

describe("measureImageDimensions", () => {
  it("resolves null in non-DOM runtimes (fail-open)", async () => {
    await expect(measureImageDimensions(makeFile())).resolves.toBeNull();
  });
});
