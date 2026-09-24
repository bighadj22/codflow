/**
 * StoreFront Content Interface
 * 
 * Defines all user-facing text strings used throughout the theme.
 * Each language file (ar.ts, en.ts) must implement this interface completely.
 */

export interface StoreFrontContent {
  // ── Announcement bar ─────────────────────────────────────────────────────
  announcementText: string;

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPlaceholderTitle: string;
  heroPlaceholderSub: string;

  // ── Trust badges ──────────────────────────────────────────────────────────
  trust1Title: string;
  trust1Sub: string;
  trust2Title: string;
  trust2Sub: string;
  trust3Title: string;
  trust3Sub: string;

  // ── Hero CTAs ────────────────────────────────────────────────────────────
  heroCtaPrimary: string;
  heroCtaSecondary: string;

  // ── Navigation ────────────────────────────────────────────────────────────
  navHome: string;
  navProducts: string;
  navNewArrivals: string;
  navBestSellers: string;
  navCategories: string;

  // ── Section headings ──────────────────────────────────────────────────────
  categoriesSection: string;
  featuredSection: string;
  allProductsSection: string;
  bestSellersSection: string;
  bestSellersSub: string;
  newArrivalsSection: string;
  newArrivalsSub: string;
  viewAllCta: string;

  // ── How It Works (COD trust) ────────────────────────────────────────────
  howItWorksTitle: string;
  howItWorksSub: string;
  howStep1Title: string;
  howStep1Sub: string;
  howStep2Title: string;
  howStep2Sub: string;
  howStep3Title: string;
  howStep3Sub: string;

  // ── Features bar ────────────────────────────────────────────────────────
  feature1Title: string;
  feature2Title: string;
  feature3Title: string;
  feature5Title: string;

  // ── Promo banner ────────────────────────────────────────────────────────
  promoTitle: string;
  promoSub: string;
  promoCtaText: string;

  // ── Testimonials ────────────────────────────────────────────────────────
  testimonialsTitle: string;
  testimonialsSub: string;

  // ── Footer ──────────────────────────────────────────────────────────────
  footerAbout: string;
  footerQuickLinks: string;
  footerSupport: string;
  footerRights: string;

  // ── Order form ────────────────────────────────────────────────────────────
  orderCta: string;
  orderCtaSubtext: string;
  formTitle: string;
  formDeliverySection: string;
  formNameLabel: string;
  formNamePlaceholder: string;
  formPhoneLabel: string;
  formPhonePlaceholder: string;
  formPhoneInvalid: string;
  formWilayaLabel: string;
  formWilayaPlaceholder: string;
  formCommuneLabel: string;
  formCommunePlaceholder: string;
  formCommuneLoading: string;
  formCommuneDisabled: string;
  formAddressLabel: string;
  formAddressPlaceholder: string;
  formDeliveryLabel: string;
  formHomeDelivery: string;
  formStopDesk: string;
  formNotesLabel: string;
  formNotesPlaceholder: string;
  formSubmit: string;
  formConfirmNote: string;
  /**
   * The pre-order consent line. Contains exactly two tokens, `{terms}` and
   * `{refund}`, which OrderForm.astro replaces with real links to the
   * store's Terms and Refund pages (resolved by kind, from `config.pages` —
   * never a hardcoded slug). The whole sentence — word order included — is
   * this key's job, because "I agree to X" then "and Y" bolted on afterward
   * does not read naturally in every language this pack supports. The line
   * is skipped entirely when either page is not configured, never rendered
   * with a dead or missing link.
   */
  checkoutConsentText: string;

  // ── WhatsApp OTP verification ─────────────────────────────────────────────
  otpTitle: string;
  otpSubtitle: string;
  otpInputLabel: string;
  otpInputPlaceholder: string;
  otpVerifyBtn: string;
  otpVerifying: string;
  otpResendIn: string;
  otpResend: string;
  otpChangePhone: string;
  otpErrorWrong: string;
  otpErrorAttempts: string;
  otpErrorExpired: string;
  otpErrorRate: string;
  otpErrorGeneric: string;

  // ── Cloudflare Turnstile (checkout bot protection) ─────────────────────────
  turnstileErrorFailed: string;
  turnstileVerifying: string;

  // ── Order summary ──────────────────────────────────────────────────────────
  qtyLabel: string;
  qtyUnit: string;
  shippingLabel: string;
  shippingCalculated: string;
  shippingFree: string;
  totalLabel: string;
  itemsLabel: string;

  // ── Thank you page ────────────────────────────────────────────────────────
  thankYouTitle: string;
  thankYouSubtitle: string;
  orderNumberLabel: string;
  totalAmountLabel: string;
  codNote: string;
  step1Title: string;
  step1Sub: string;
  step2Title: string;
  step2Sub: string;
  step3Title: string;
  step3Sub: string;
  backToStore: string;

  // ── Empty / error states ──────────────────────────────────────────────────
  noProductsTitle: string;
  noProductsSub: string;
  emptyStoreTitle: string;
  emptyStoreSub: string;
  productNotFoundTitle: string;

  // ── Reviews ───────────────────────────────────────────────────────────────
  reviewsTitle: string;
  reviewsNoReviews: string;
  reviewsBeFirst: string;
  reviewsVerifiedBuyer: string;
  reviewFormTitle: string;
  reviewFormOrderLabel: string;
  reviewFormOrderPlaceholder: string;
  reviewFormOrderHelp: string;
  reviewFormRatingLabel: string;
  reviewFormTitleLabel: string;
  reviewFormTitlePlaceholder: string;
  reviewFormBodyLabel: string;
  reviewFormBodyPlaceholder: string;
  reviewFormSubmit: string;
  reviewFormSuccess: string;
  reviewFormErrorDuplicate: string;
  reviewFormErrorInvalidOrder: string;
  reviewFormErrorGeneric: string;

  // ── Offers ───────────────────────────────────────────────────────────────
  /** Sub-text under offer banner: "Automatically applied at checkout" */
  offerAutoApplied: string;
  /** Label for the free item row in the order summary */
  offerFreeLabel: string;
  /** Offer card header when threshold not yet reached */
  offerActive: string;
  /** Offer card header when threshold reached */
  offerUnlocked: string;
  /** Hint when {n} more units needed — use {n} as placeholder */
  offerAddMore: string;
  /** Hint when exactly 1 more unit needed */
  offerAddOne: string;
  /** Hint shown when offer is unlocked */
  offerYouGet: string;
  /** Title above the offer tier selector section */
  offerSectionTitle: string;
  /** Badge text on free-shipping offer tiers */
  offerFreeShippingBadge: string;
  /** "Buy 1" label on the base tier card */
  offerBuyOne: string;
  /** "Full Price" badge on the base tier card */
  offerFullPrice: string;
  /** "Most Popular" badge on the first offer tier */
  offerMostPopular: string;

  // ── Misc ──────────────────────────────────────────────────────────────────
  breadcrumbHome: string;
  required: string;
  viewProduct: string;
  featured: string;
  lowStock: string;
  outOfStock: string;
  qtyMaxStock: string;
  freeShippingBadge: string;
  searchLabel: string;
  noResultsLabel: string;
  loadMoreLabel: string;
  allLabel: string;
  productCountLabel: string;
  reviewFormMinLengthError: string;
  reviewFormRatingRequired: string;
  offerSaveBadge: string;
  offerSavingsText: string;
  offerUnitLabel: string;
  ariaMainNavigation: string;
  ariaQuantity: string;
  ariaGoToImage: string;
  ariaBrowseAllProducts: string;
  ariaBrowseCategoryProducts: string;
  ariaProductCard: string;
  ariaStarRating: string;
  thankYouPageTitle: string;
  defaultMetaDescription: string;

  // ── Shopping cart ─────────────────────────────────────────────────────────
  cartTitle: string;
  cartItemsLabel: string;
  cartEmptyTitle: string;
  cartEmptyHint: string;
  cartAddToCart: string;
  cartAdded: string;
  cartOpenLabel: string;
  cartCloseLabel: string;
  cartSubtotalLabel: string;
  cartCheckoutCta: string;
  cartRemoveLabel: string;
  cartIncreaseLabel: string;
  cartDecreaseLabel: string;
  cartFreeDeliveryEarned: string;
  cartFreeDeliveryRemaining: string;
  cartLineUnavailable: string;
  cartLineOutOfStock: string;
  cartGiftLabel: string;
  cartFixBeforeCheckout: string;
  cartDeliveryNote: string;
  cartUnavailableNotice: string;
  cartContinueShopping: string;

  // ── Checkout page ─────────────────────────────────────────────────────────
  checkoutTitle: string;
  checkoutSummaryTitle: string;
  checkoutLoading: string;

  // ── Related products ──────────────────────────────────────────────────────
  relatedTitle: string;
  relatedSub: string;

  // ── 404 page ──────────────────────────────────────────────────────────────
  notFoundTitle: string;
  notFoundSubtitle: string;
  notFoundCtaHome: string;
  notFoundCtaProducts: string;
  notFoundPageTitle: string;
}
