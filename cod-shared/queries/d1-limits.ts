/**
 * D1 platform constraints that shape how queries are written.
 *
 * Cloudflare documents a hard ceiling of 100 bound parameters per query, so
 * any `inArray(column, ids)` over user-supplied ids must be chunked or it will
 * fail in production the first time a basket, a page size, or a bulk action
 * crosses the line. The margin below the ceiling leaves room for the other
 * bound values in the same statement (wilaya, commune, status, timestamps).
 *
 * https://developers.cloudflare.com/d1/platform/limits/
 */

/** Cloudflare's documented hard limit. */
export const MAX_BOUND_PARAMS = 100;

/** What we actually pack into one `inArray`, leaving room for other params. */
export const MAX_IN_ARRAY_IDS = 90;

/**
 * Split ids into `inArray`-sized chunks. An empty input yields no chunks, so
 * callers can spread the result into a batch without guarding for it.
 */
export function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IN_ARRAY_IDS) {
    chunks.push(ids.slice(i, i + MAX_IN_ARRAY_IDS));
  }
  return chunks;
}
