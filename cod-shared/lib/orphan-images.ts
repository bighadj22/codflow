/**
 * Orphaned-image sweep — the decision half (pure, no I/O).
 *
 * Rich descriptions add a second way for an R2 object to be referenced: inline
 * `<img src>` inside stored HTML. Gallery rows can be deleted while the same
 * object is still displayed by a description, so "not in `product_images`" is
 * NOT sufficient evidence of an orphan. This module answers only "which of the
 * objects the bucket lists are safe to delete?", given the set of keys the
 * database says are referenced; the caller supplies both sides.
 *
 * Bias, deliberately: over-collecting references keeps an orphan alive a little
 * longer, while missing one deletes live merchant media. Every judgement call
 * below resolves toward keeping the object.
 */

/** Only keys in this namespace are sweepable. `landing/` uploads belong to the
 *  landing-pages feature and are never this job's business. */
export const MANAGED_IMAGE_PREFIX = "products/";

/**
 * Finds every `products/<token>` occurrence in stored text.
 *
 * Shape-agnostic on purpose: it does not assume the 32-hex UUID form `presign.ts`
 * generates today, so a future uploader with a different key shape is still
 * protected. Matches are later intersected with the keys the bucket actually
 * holds, so a hit on text that merely looks like a key costs nothing.
 */
const KEY_IN_TEXT_RE = /products\/[A-Za-z0-9][A-Za-z0-9._-]*/g;

export function isManagedImageKey(key: string): boolean {
  return key.startsWith(MANAGED_IMAGE_PREFIX) && key.length > MANAGED_IMAGE_PREFIX.length;
}

export function imageKeysInText(
  ...values: readonly (string | null | undefined)[]
): string[] {
  const keys = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(KEY_IN_TEXT_RE)) keys.add(match[0]);
  }
  return [...keys];
}

export interface OrphanCandidate {
  key: string;
  /** R2's upload time. `null` (unknown) must never make an object sweepable. */
  uploaded: Date | null;
  /** Carried through for the report; the decision never reads it. */
  size?: number;
}

export interface OrphanDecisionInput<T extends OrphanCandidate> {
  /** Every object the bucket lists under the managed prefix. */
  candidates: readonly T[];
  /** Keys the database still references (gallery rows, descriptions, category images). */
  referenced: ReadonlySet<string>;
  olderThanDays: number;
  now: Date;
}

/**
 * The one place the keep/delete judgement lives, as a type guard: it is also
 * what proves to the compiler that a returned candidate has a known upload
 * time, so callers never cast to report it.
 */
function isSweepable<T extends OrphanCandidate>(
  candidate: T,
  { referenced, cutoff }: { referenced: ReadonlySet<string>; cutoff: Date },
): candidate is T & { uploaded: Date } {
  return (
    isManagedImageKey(candidate.key) &&
    !referenced.has(candidate.key) &&
    candidate.uploaded !== null &&
    candidate.uploaded.getTime() < cutoff.getTime()
  );
}

/**
 * The objects safe to delete: managed, unreferenced, and older than the
 * grace period. A key that is referenced, unmanaged, fresh, or of unknown age
 * is kept.
 */
export function selectOrphanImageKeys<T extends OrphanCandidate>({
  candidates,
  referenced,
  olderThanDays,
  now,
}: OrphanDecisionInput<T>): (T & { uploaded: Date })[] {
  const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
  const context = { referenced, cutoff };
  return candidates.filter((candidate) => isSweepable(candidate, context));
}
