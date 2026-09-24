/**
 * Orphan-image decisions — the pure half. No I/O, no HTMLRewriter: the
 * destructive case is "we deleted a key something still referenced", so these
 * tests pin every path that must KEEP an object.
 */
import { describe, expect, it } from "vitest";
import {
  MANAGED_IMAGE_PREFIX,
  imageKeysInText,
  isManagedImageKey,
  selectOrphanImageKeys,
  type OrphanCandidate,
} from "./orphan-images";

const NOW = new Date("2026-09-17T00:00:00.000Z");
const OLD = new Date("2026-01-01T00:00:00.000Z");
const FRESH = new Date("2026-09-16T23:00:00.000Z");

function candidate(key: string, uploaded: Date | null = OLD, size = 1024): OrphanCandidate {
  return { key, uploaded, size };
}

function keys(prefix = "products/", hex = "a".repeat(32)): string {
  return `${prefix}${hex}.jpg`;
}

describe("isManagedImageKey", () => {
  it("accepts keys under the products prefix only", () => {
    expect(isManagedImageKey("products/abc.jpg")).toBe(true);
    expect(isManagedImageKey("landing/abc.jpg")).toBe(false);
    expect(isManagedImageKey("products/")).toBe(false);
    expect(isManagedImageKey("other/products/abc.jpg")).toBe(false);
  });
});

describe("imageKeysInText", () => {
  it("finds a bare key", () => {
    expect(imageKeysInText(keys())).toEqual([keys()]);
  });

  it("finds a key inside a public URL, ignoring query and hash suffixes", () => {
    expect(imageKeysInText(`https://media.example.com/${keys()}?v=2`)).toEqual([keys()]);
  });

  it("finds inline images in sanitised description HTML", () => {
    const html = `<p>x</p><img src="https://media.example.com/${keys()}" alt="a">`;
    expect(imageKeysInText(html)).toEqual([keys()]);
  });

  it("does not assume the 32-hex UUID shape of today's uploader", () => {
    expect(imageKeysInText("products/legacy-upload_1.webp")).toEqual(["products/legacy-upload_1.webp"]);
  });

  it("ignores null/undefined and text with no keys", () => {
    expect(imageKeysInText(null, undefined, "no images here", "")).toEqual([]);
  });

  it("returns each key once", () => {
    const key = keys();
    expect(imageKeysInText(`${key} and ${key}`)).toEqual([key]);
  });
});

describe("selectOrphanImageKeys", () => {
  const referenced = new Set([keys("products/", "b".repeat(32))]);

  it("selects an unreferenced, old, managed object", () => {
    const orphan = candidate(keys());
    expect(selectOrphanImageKeys({ candidates: [orphan], referenced, olderThanDays: 30, now: NOW })).toEqual([
      orphan,
    ]);
  });

  it("keeps a referenced object even when it is old", () => {
    const kept = candidate(keys("products/", "b".repeat(32)));
    expect(selectOrphanImageKeys({ candidates: [kept], referenced, olderThanDays: 30, now: NOW })).toEqual([]);
  });

  it("keeps an object inside the grace period", () => {
    const fresh = candidate(keys(), FRESH);
    expect(selectOrphanImageKeys({ candidates: [fresh], referenced, olderThanDays: 30, now: NOW })).toEqual([]);
  });

  it("keeps an object whose age is unknown", () => {
    const unknown = candidate(keys(), null);
    expect(selectOrphanImageKeys({ candidates: [unknown], referenced, olderThanDays: 30, now: NOW })).toEqual([]);
  });

  it("never considers a key outside the managed prefix", () => {
    const landing = candidate("landing/abc.jpg");
    expect(selectOrphanImageKeys({ candidates: [landing], referenced, olderThanDays: 30, now: NOW })).toEqual([]);
  });

  it("is exactly on the cutoff boundary: objects older than the period only", () => {
    const boundary = candidate(keys(), new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000));
    expect(selectOrphanImageKeys({ candidates: [boundary], referenced, olderThanDays: 30, now: NOW })).toEqual([]);
    const justPast = candidate(keys(), new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000 - 1));
    expect(selectOrphanImageKeys({ candidates: [justPast], referenced, olderThanDays: 30, now: NOW })).toEqual([
      justPast,
    ]);
  });

  it("carries size through for the report", () => {
    const orphan = candidate(keys(), OLD, 4096);
    expect(selectOrphanImageKeys({ candidates: [orphan], referenced, olderThanDays: 30, now: NOW })[0].size).toBe(
      4096
    );
  });

  it("exposes the managed prefix the sweep lists under", () => {
    expect(MANAGED_IMAGE_PREFIX).toBe("products/");
  });
});
