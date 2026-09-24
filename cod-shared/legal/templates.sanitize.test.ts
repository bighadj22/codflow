/**
 * Proves the templates survive the real sanitiser byte-for-byte — R5/R6 in
 * report-md/LEGAL_PAGES_PLAN.md.
 *
 * HTMLRewriter does not exist in the Node vitest pool (established in
 * rich-text.test.ts), so `sanitizeRichText`/`toPlainText` run inside a real
 * workerd via Miniflare, same pattern as `cod-shared/lib/rich-text.test.ts`:
 * rich-text.ts is esbuild-transformed and registered as a virtual module, no
 * filesystem bundling needed since it has no imports of its own. The HTML
 * under test is produced on the Node side — the template pack and the
 * serializer are pure functions and need no workerd runtime.
 *
 * If a template ever used a tag or attribute the allow-list would strip,
 * this is the test that catches it: R5 claims the serializer emits nothing
 * else, and this is what makes that claim true rather than merely asserted.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { transform } from "esbuild";
import { Miniflare } from "miniflare";
import { LEGAL_PAGE_KINDS, PAGE_LOCALES } from "./kinds";
import type { LegalPageKind, PageLocale } from "./kinds";
import { TEMPLATES } from "./render";
import { serializeLegalDocument } from "./serialize";
import type { StoreLegalFacts } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const richTextSource = readFileSync(join(here, "../lib/rich-text.ts"), "utf8");

const WORKER = `
import { sanitizeRichText, toPlainText } from "./rich-text.mjs";
export default {
  async fetch(request) {
    const { fn, args } = await request.json();
    try {
      let result;
      if (fn === "sanitizeRichText") result = await sanitizeRichText(args[0]);
      else if (fn === "toPlainText") result = await toPlainText(args[0]);
      else return Response.json({ ok: false, error: "unknown fn: " + fn }, { status: 400 });
      return Response.json({ ok: true, result });
    } catch (e) {
      return Response.json({ ok: false, error: String((e && e.stack) || e) }, { status: 500 });
    }
  },
};
`;

let mf: Miniflare | undefined;

beforeAll(async () => {
  const lib = await transform(richTextSource, { loader: "ts", format: "esm" });
  mf = new Miniflare({
    modules: [
      { type: "ESModule", path: "index.mjs", contents: WORKER },
      { type: "ESModule", path: "rich-text.mjs", contents: lib.code },
    ],
  });
});

afterAll(async () => {
  await mf?.dispose();
});

async function call<T>(fn: string, ...args: unknown[]): Promise<T> {
  const worker = await mf!.getWorker();
  const res = await worker.fetch("http://legal-sanitize-e2e.test/", {
    method: "POST",
    body: JSON.stringify({ fn, args }),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; error?: string };
  if (!data.ok) throw new Error(`workerd call ${fn} failed: ${data.error}`);
  return data.result as T;
}

const BARE: StoreLegalFacts = {
  storeName: "متجر تجريبي",
  legalName: null,
  rcNumber: null,
  nif: null,
  address: null,
  contactEmail: null,
  contactPhone: null,
  returnWindowDays: 0,
  deliveryMinDays: 2,
  deliveryMaxDays: 7,
};

const FULL: StoreLegalFacts = {
  storeName: "Boutique Test",
  legalName: "SARL Test Commerce",
  rcNumber: "16/00-1234567B25",
  nif: "000116001234567",
  address: "12 rue des Frères Bouadou, Bir Mourad Raïs, Alger",
  contactEmail: "contact@example.dz",
  contactPhone: "+213 555 00 00 00",
  returnWindowDays: 7,
  deliveryMinDays: 1,
  deliveryMaxDays: 5,
};

const CASES: ReadonlyArray<[PageLocale, LegalPageKind]> = PAGE_LOCALES.flatMap(
  (locale) => LEGAL_PAGE_KINDS.map((kind) => [locale, kind] as [PageLocale, LegalPageKind]),
);

describe("template output passes sanitizeRichText unchanged", () => {
  it.each(CASES)("%s / %s (bare facts)", async (locale, kind) => {
    const html = serializeLegalDocument(TEMPLATES[locale][kind](BARE));
    const { html: sanitised, removed } = await call<{ html: string; removed: unknown[] }>(
      "sanitizeRichText",
      html,
    );
    expect(removed, `sanitizer stripped something from ${locale}/${kind}`).toEqual([]);
    expect(sanitised).toBe(html);
  });

  it.each(CASES)("%s / %s (full facts)", async (locale, kind) => {
    const html = serializeLegalDocument(TEMPLATES[locale][kind](FULL));
    const { html: sanitised, removed } = await call<{ html: string; removed: unknown[] }>(
      "sanitizeRichText",
      html,
    );
    expect(removed, `sanitizer stripped something from ${locale}/${kind}`).toEqual([]);
    expect(sanitised).toBe(html);
  });
});

describe("toPlainText derives non-empty, tag-free body_plain", () => {
  it.each(CASES)("%s / %s", async (locale, kind) => {
    const html = serializeLegalDocument(TEMPLATES[locale][kind](FULL));
    const plain = await call<string>("toPlainText", html);
    expect(plain.length).toBeGreaterThan(100);
    expect(plain).not.toMatch(/<[a-z]/i);
  });
});
