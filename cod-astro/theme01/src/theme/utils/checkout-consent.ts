/**
 * Splits the pre-order consent sentence around its two link tokens.
 *
 * Extracted from OrderForm.astro so this logic — where the real risk is —
 * can be unit tested without standing up the whole order form (product,
 * variants, OTP, Turnstile, astro:actions). The `.astro` file's job is only
 * to render the three parts this returns.
 */
import type { StorePageLink } from "@/core/api/types";

export interface CheckoutConsentParts {
  beforeTerms: string;
  termsPage: StorePageLink;
  betweenLinks: string;
  refundPage: StorePageLink;
  afterRefund: string;
}

/**
 * Returns null — never a dangling sentence — when either page is missing, or
 * when the content pack's sentence is missing a token (a translation bug we
 * want to fail loud on, not paper over with a broken partial render).
 */
export function resolveCheckoutConsent(
  consentText: string,
  pages: StorePageLink[],
): CheckoutConsentParts | null {
  const termsPage = pages.find((p) => p.kind === "terms");
  const refundPage = pages.find((p) => p.kind === "refund");
  if (!termsPage || !refundPage) return null;

  const [beforeTerms, rest] = consentText.split("{terms}");
  if (rest === undefined) return null;
  const [betweenLinks, afterRefund] = rest.split("{refund}");
  if (afterRefund === undefined) return null;

  return { beforeTerms, termsPage, betweenLinks, refundPage, afterRefund };
}
