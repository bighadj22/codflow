# Content Keys Reference

All **155** content keys of the `StoreFrontContent` interface. The interface
lives in `src/theme/content/types.ts` and is implemented exactly by the three
locale files `ar.ts`, `fr.ts`, and `en.ts`. Adding or removing a key means
updating **all three** files — TypeScript fails the build otherwise.

> Icons are **not** content keys. Trust/step icons come from the
> `astro-icon`/Heroicons set (`heroicons:check-badge`, `heroicons:truck`, …)
> configured in `astro.config.mjs` — see `global.css`/components for usage.
> There is no `trust1Icon`/`step1Icon` content key.

## Groups and keys

### Announcement bar (1)
| Key | Notes |
|-----|-------|
| `announcementText` | Fallback text when the store has no announcement bar set |

### Hero (5)
| Key | Notes |
|-----|-------|
| `heroEyebrow` | Eyebrow above the title |
| `heroTitle` | Main hero heading |
| `heroSubtitle` | Hero subheading |
| `heroPlaceholderTitle` | Shown when the store has no products yet |
| `heroPlaceholderSub` | Subtitle for the empty-store hero |

### Trust badges (6)
| Key | Notes |
|-----|-------|
| `trust1Title` / `trust1Sub` | Badge 1 (COD) |
| `trust2Title` / `trust2Sub` | Badge 2 (nationwide delivery) |
| `trust3Title` / `trust3Sub` | Badge 3 (fast confirmation) |

### Hero CTAs (2)
| Key | Notes |
|-----|-------|
| `heroCtaPrimary` | Primary CTA ("Shop Now") |
| `heroCtaSecondary` | Secondary CTA ("View Best Sellers") |

### Navigation (5)
| Key | Notes |
|-----|-------|
| `navHome`, `navProducts`, `navNewArrivals`, `navBestSellers`, `navCategories` | Header + mobile nav labels |

### Section headings (8)
| Key | Notes |
|-----|-------|
| `categoriesSection` | "Shop by Category" |
| `featuredSection` | Featured-products heading |
| `allProductsSection` | All-products heading |
| `bestSellersSection` / `bestSellersSub` | Best-sellers heading + subtitle |
| `newArrivalsSection` / `newArrivalsSub` | New-arrivals heading + subtitle |
| `viewAllCta` | "View all" link on section headers |

### How It Works — COD trust (8)
| Key | Notes |
|-----|-------|
| `howItWorksTitle` / `howItWorksSub` | Section heading + subtitle |
| `howStep1Title` / `howStep1Sub` | Place order |
| `howStep2Title` / `howStep2Sub` | Confirm via WhatsApp |
| `howStep3Title` / `howStep3Sub` | Pay cash on delivery |

### Features bar (4)
| Key | Notes |
|-----|-------|
| `feature1Title`, `feature2Title`, `feature3Title`, `feature5Title` | Trust strip titles (note: there is no `feature4Title`) |

### Promo banner (3)
| Key | Notes |
|-----|-------|
| `promoTitle`, `promoSub`, `promoCtaText` | WhatsApp CTA banner |

### Testimonials (2)
| Key | Notes |
|-----|-------|
| `testimonialsTitle`, `testimonialsSub` | Review/testimonial section |

### Footer (6)
| Key | Notes |
|-----|-------|
| `footerAbout`, `footerQuickLinks`, `footerSupport`, `footerShipping`, `footerReturns`, `footerRights` | Footer headings + copyright line |

### Order form (23)
| Key | Notes |
|-----|-------|
| `orderCta` / `orderCtaSubtext` | Product-card CTA + "Cash on delivery" subtext |
| `formTitle` | Form heading |
| `formDeliverySection` | Delivery-info section label |
| `formNameLabel` / `formNamePlaceholder` | Full name |
| `formPhoneLabel` / `formPhonePlaceholder` | Phone |
| `formWilayaLabel` / `formWilayaPlaceholder` | Wilaya selector |
| `formCommuneLabel` / `formCommunePlaceholder` | Commune selector |
| `formCommuneLoading` | Loading state |
| `formCommuneDisabled` | "Select a wilaya first" |
| `formAddressLabel` / `formAddressPlaceholder` | Detailed address |
| `formDeliveryLabel` | Delivery method label |
| `formHomeDelivery` / `formStopDesk` | Delivery method options |
| `formNotesLabel` / `formNotesPlaceholder` | Order notes |
| `formSubmit` | Submit button |
| `formConfirmNote` | Post-submit confirmation note |

### Order summary (7)
| Key | Notes |
|-----|-------|
| `qtyLabel`, `qtyUnit` | Quantity + unit label |
| `shippingLabel` | Delivery fee label |
| `shippingCalculated` | "Calculated after selecting wilaya" |
| `shippingFree` | Free-shipping label |
| `totalLabel`, `itemsLabel` | Totals |

### Thank-you page (12)
| Key | Notes |
|-----|-------|
| `thankYouTitle`, `thankYouSubtitle` | Page heading + subtitle |
| `orderNumberLabel`, `totalAmountLabel` | Order/total field labels |
| `codNote` | "No prepayment required" |
| `step1Title` / `step1Sub`, `step2Title` / `step2Sub`, `step3Title` / `step3Sub` | "What happens next" steps |
| `backToStore` | Return link |

### Empty / error states (5)
| Key | Notes |
|-----|-------|
| `noProductsTitle`, `noProductsSub` | Empty category |
| `emptyStoreTitle`, `emptyStoreSub` | Empty store |
| `productNotFoundTitle` | Product 404 |

### Reviews (18)
| Key | Notes |
|-----|-------|
| `reviewsTitle`, `reviewsNoReviews`, `reviewsBeFirst`, `reviewsVerifiedBuyer` | Reviews section |
| `reviewFormTitle` | Form heading |
| `reviewFormOrderLabel` / `reviewFormOrderPlaceholder` / `reviewFormOrderHelp` | Order-number field |
| `reviewFormRatingLabel` | Rating field |
| `reviewFormTitleLabel` / `reviewFormTitlePlaceholder` | Review-title field |
| `reviewFormBodyLabel` / `reviewFormBodyPlaceholder` | Review body |
| `reviewFormSubmit` | Submit button |
| `reviewFormSuccess` | Post-submit message |
| `reviewFormErrorDuplicate` | Duplicate-review error |
| `reviewFormErrorInvalidOrder` | Order-not-found error |
| `reviewFormErrorGeneric` | Generic error |

### Offers (12)
| Key | Notes |
|-----|-------|
| `offerAutoApplied` | "Automatically applied at checkout" |
| `offerFreeLabel` | Free-item label |
| `offerActive` | Card header before threshold |
| `offerUnlocked` | Card header when unlocked |
| `offerAddMore` | Hint with `{n}` placeholder |
| `offerAddOne` | Hint when 1 more needed |
| `offerYouGet` | Free-item hint when unlocked |
| `offerSectionTitle` | Offer selector heading |
| `offerFreeShippingBadge` | Free-shipping badge |
| `offerBuyOne` | Base tier label |
| `offerFullPrice` | Base tier badge |
| `offerMostPopular` | Tier badge |

### Misc (28)
| Key | Notes |
|-----|-------|
| `breadcrumbHome` | Breadcrumb home link |
| `required` | Required-field indicator |
| `viewProduct`, `featured` | Link/badge text |
| `lowStock`, `outOfStock`, `qtyMaxStock` | Stock warnings (`lowStock`/`qtyMaxStock` use `{n}`) |
| `freeShippingBadge` | Badge text |
| `searchLabel`, `noResultsLabel`, `loadMoreLabel`, `allLabel`, `productCountLabel` | Search/filter/pagination |
| `reviewFormMinLengthError`, `reviewFormRatingRequired` | Review validation errors |
| `offerSaveBadge`, `offerSavingsText`, `offerUnitLabel` | Offer savings UI (`offerSaveBadge` uses `{n}`; `offerSavingsText` uses `{amount}` + `{currency}`; `offerUnitLabel` uses `{n}`) |
| `ariaMainNavigation`, `ariaQuantity`, `ariaGoToImage`, `ariaBrowseAllProducts`, `ariaBrowseCategoryProducts`, `ariaProductCard`, `ariaStarRating` | Accessibility labels |
| `navContact` | Contact nav label |
| `thankYouPageTitle` | `<title>` for the thank-you page |
| `defaultMetaDescription` | Default meta description — uses `{storeName}` |

## Placeholders

Some keys are templates resolved with `.replace()`:

- `{n}` — number: `lowStock`, `qtyMaxStock`, `offerAddMore`, `offerSaveBadge`, `offerUnitLabel`
- `{amount}` + `{currency}` — `offerSavingsText`
- `{storeName}` — `defaultMetaDescription`

## Sample defaults

| Key | AR (default) | EN |
|-----|--------------|----|
| `heroTitle` | اكتشف أفضل المنتجات | Discover amazing products |
| `heroSubtitle` | توصيل لجميع ولايات الجزائر — الدفع عند الاستلام | Delivery to all wilayas in Algeria — Cash on delivery |
| `trust1Title` / `trust1Sub` | الدفع عند الاستلام / بدون دفع مسبق | Cash on Delivery / No prepayment |
| `orderCta` | اطلب الآن | Order Now |
| `formSubmit` | تأكيد الطلب | Confirm order |
| `totalLabel` | المجموع الكلي | Total |

The complete AR/FR/EN defaults live in `src/theme/content/{ar,fr,en}.ts`.

## Override via the dashboard

Store owners can override any key through the store's `contentJson` setting
(`StoreConfig.contentJson` → `resolveContent(lang, contentJson)` in
`src/theme/content/index.ts`). Unknown keys or invalid JSON are ignored and the
locale defaults are used.

```json
{ "heroTitle": "My Custom Title", "orderCta": "Buy Now!" }
```

## Adding a language

1. Add the key to `src/theme/content/types.ts` and fill it in `ar.ts`, `fr.ts`,
   `en.ts` (all three must stay exact).
2. Create `xx.ts` typed as `StoreFrontContent`.
3. Register it in the `languages` object in `src/theme/content/index.ts`.
4. Add the code to the `lang` enum in `cod-shared` (`stores.lang`) and
   `cod-astro/theme01/src/core/api/types.ts` (`StoreConfig.lang`). Today the
   schema exposes `"ar" | "en"`.