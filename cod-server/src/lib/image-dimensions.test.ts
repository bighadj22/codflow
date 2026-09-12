/**
 * Image dimension parsing + magic-byte sniffing.
 *
 * Fixtures are real binary headers (plus one real 1x1 PNG) — the parser must
 * read the same bytes a browser would. Dimension parsing is fail-open: any
 * unrecognized or truncated input yields null, never a throw.
 */

import { describe, it, expect } from "vitest";
import { parseImageDimensions, sniffImageType } from "./image-dimensions";

/** Real 1x1 px PNG file (70 bytes). */
const REAL_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function jpegHeader(width: number, height: number, withApp0: boolean): Buffer {
  const b = Buffer.alloc(64);
  let offset = 0;
  b.writeUInt16BE(0xffd8, offset); // SOI
  offset += 2;
  if (withApp0) {
    b.writeUInt16BE(0xffe0, offset); // APP0 marker
    b.writeUInt16BE(16, offset + 2); // segment length (includes itself)
    b.write("JFIF\0", offset + 4, "ascii");
    offset += 2 + 16;
  }
  b.writeUInt16BE(0xffc0, offset); // SOF0 marker
  b.writeUInt16BE(17, offset + 2); // segment length
  b.writeUInt8(8, offset + 4); // precision
  b.writeUInt16BE(height, offset + 5);
  b.writeUInt16BE(width, offset + 7);
  return b;
}

function gifHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(13);
  b.write("GIF89a", 0, "ascii");
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

function webpLossless(width: number, height: number): Buffer {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(18, 4);
  b.write("WEBP", 8, "ascii");
  b.write("VP8L", 12, "ascii");
  b.writeUInt32LE(5, 16);
  b.writeUInt8(0x2f, 20); // lossless signature
  const bits = (width - 1) | ((height - 1) << 14);
  b.writeUInt32LE(bits, 21);
  return b;
}

function webpExtended(width: number, height: number): Buffer {
  const b = Buffer.alloc(32);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(20, 4);
  b.write("WEBP", 8, "ascii");
  b.write("VP8X", 12, "ascii");
  b.writeUInt32LE(10, 16);
  b.writeUInt8(0x10, 20); // flags
  b.writeUIntLE(width - 1, 24, 3);
  b.writeUIntLE(height - 1, 27, 3);
  return b;
}

function webpLossy(width: number, height: number): Buffer {
  const b = Buffer.alloc(32);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(20, 4);
  b.write("WEBP", 8, "ascii");
  b.write("VP8 ", 12, "ascii");
  b.writeUInt32LE(10, 16);
  b.writeUIntLE(0x83, 20, 3); // keyframe tag
  b.writeUIntLE(0x2a019d, 23, 3); // sync code 9d 01 2a
  b.writeUInt16LE(width, 26);
  b.writeUInt16LE(height, 28);
  return b;
}

describe("sniffImageType", () => {
  it("recognizes a real PNG file", () => {
    expect(sniffImageType(new Uint8Array(REAL_1X1_PNG))).toBe("image/png");
  });

  it("recognizes jpeg, gif, and webp signatures", () => {
    expect(sniffImageType(new Uint8Array(jpegHeader(10, 10, false)))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array(gifHeader(10, 10)))).toBe("image/gif");
    expect(sniffImageType(new Uint8Array(webpLossless(10, 10)))).toBe("image/webp");
    expect(sniffImageType(new Uint8Array(webpExtended(10, 10)))).toBe("image/webp");
    expect(sniffImageType(new Uint8Array(webpLossy(10, 10)))).toBe("image/webp");
  });

  it("returns null for non-image bytes", () => {
    expect(sniffImageType(new Uint8Array(Buffer.from("<html><body></body></html>")))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull();
  });
});

describe("parseImageDimensions", () => {
  it("parses a real 1x1 PNG as 1x1", () => {
    expect(parseImageDimensions(new Uint8Array(REAL_1X1_PNG))).toEqual({ width: 1, height: 1 });
  });

  it("parses PNG IHDR (big-endian) — phone-width creative 1080x1350", () => {
    expect(parseImageDimensions(new Uint8Array(pngHeader(1080, 1350)))).toEqual({
      width: 1080,
      height: 1350,
    });
  });

  it("parses JPEG SOF0 directly after SOI", () => {
    expect(parseImageDimensions(new Uint8Array(jpegHeader(1920, 1080, false)))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("skips APP segments before the JPEG frame header", () => {
    expect(parseImageDimensions(new Uint8Array(jpegHeader(1080, 1350, true)))).toEqual({
      width: 1080,
      height: 1350,
    });
  });

  it("parses GIF logical screen size (little-endian)", () => {
    expect(parseImageDimensions(new Uint8Array(gifHeader(386, 200)))).toEqual({
      width: 386,
      height: 200,
    });
  });

  it("parses WebP lossless (VP8L) packed dimensions", () => {
    expect(parseImageDimensions(new Uint8Array(webpLossless(386, 200)))).toEqual({
      width: 386,
      height: 200,
    });
  });

  it("parses WebP extended (VP8X) canvas size", () => {
    expect(parseImageDimensions(new Uint8Array(webpExtended(4096, 2304)))).toEqual({
      width: 4096,
      height: 2304,
    });
  });

  it("parses WebP lossy (VP8) keyframe dimensions", () => {
    expect(parseImageDimensions(new Uint8Array(webpLossy(320, 240)))).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("fails open to null on truncated and unrecognized input", () => {
    const truncatedPng = new Uint8Array(REAL_1X1_PNG.subarray(0, 15));
    expect(parseImageDimensions(truncatedPng)).toBeNull();
    expect(parseImageDimensions(new Uint8Array(Buffer.from("not an image at all")))).toBeNull();
    expect(parseImageDimensions(new Uint8Array(0))).toBeNull();
  });
});
