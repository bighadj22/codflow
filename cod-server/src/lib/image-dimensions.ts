/**
 * Image magic-byte sniffing and header dimension parsing.
 *
 * Reads only the leading bytes of png/jpeg/webp/gif files — no dependency, no
 * full decode. Dimension parsing is fail-open by design: an unrecognized or
 * truncated header yields null, never an error, so an unmeasurable image
 * still saves (the storefront renders it without reserved layout space).
 */

export type SniffedImageType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export interface ImageDimensions {
  width: number;
  height: number;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isGif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  );
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  );
}

export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (isPng(bytes)) return "image/png";
  if (isJpeg(bytes)) return "image/jpeg";
  if (isGif(bytes)) return "image/gif";
  if (isWebp(bytes)) return "image/webp";
  return null;
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  // IHDR must be the first chunk: signature(8) + length(4), then "IHDR"(4) at
  // offset 12, then big-endian width at 16 and height at 20.
  if (bytes.length < 24) return null;
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
    return null;
  }
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  // Scan segment markers for a start-of-frame (SOF0..SOF15 minus DHT/JPG/DAC);
  // the frame header carries big-endian height then width after the length.
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) return null;
    const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];
    if (
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (segmentLength < 2) return null;
    i += 2 + segmentLength;
  }
  return null;
}

function gifDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 10) return null;
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  return width > 0 && height > 0 ? { width, height } : null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourcc === "VP8X") {
    // Extended format: 1-based canvas size as u24le at offsets 24 (width-1) and 27 (height-1).
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  if (fourcc === "VP8 ") {
    // Lossy keyframe: frame tag (20-22), sync code (23-25), then u16le width/height.
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (fourcc === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    // Lossless: signature 0x2f then packed u32le — width-1 in the low 14 bits, height-1 in the next 14.
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}

export function parseImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (isPng(bytes)) return pngDimensions(bytes);
  if (isJpeg(bytes)) return jpegDimensions(bytes);
  if (isGif(bytes)) return gifDimensions(bytes);
  if (isWebp(bytes)) return webpDimensions(bytes);
  return null;
}
