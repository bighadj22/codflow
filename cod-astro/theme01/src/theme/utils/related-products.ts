/**
 * Choosing what to suggest beside a product.
 *
 * Small rules, but each one is a decision about what a shopper sees at the
 * moment they were about to leave, so they live here where they can be tested
 * rather than inside a component's frontmatter.
 */

interface ProductLike {
  id?: string | null;
}

/** Two rows of four on a desktop grid; a short sideways scroll on a phone. */
export const MAX_RELATED = 8;

/**
 * Below this the section stays away entirely.
 *
 * A "You may also like" heading over a single card reads as an accident rather
 * than a selection, and a store with two products in total does not need one.
 */
export const MIN_RELATED = 2;

/**
 * The suggestions worth showing from a list of candidates.
 *
 * Drops the product being viewed — suggesting the page you are already on is
 * the one result nobody needs — along with anything unusable, and caps the
 * rest so a large category cannot turn into an endless wall of cards.
 */
export function usableRelated<T extends ProductLike>(
  rows: T[] | null | undefined,
  productId: string,
  max: number = MAX_RELATED,
): T[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is T => Boolean(row?.id) && row.id !== productId)
    .slice(0, Math.max(0, max));
}

/** Whether a set of suggestions is worth giving a heading to. */
export function shouldShowRelated(count: number): boolean {
  return count >= MIN_RELATED;
}
