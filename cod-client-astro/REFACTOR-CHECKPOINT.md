# Feature Component Refactor — Checkpoint

Tracking the decomposition of oversized feature components in `cod-client-astro`.
Goal: split giant `*PageApp.tsx` blobs into the discipline established by the
MCP refactor — a thin page shell, a content orchestrator, and focused leaf
components. No behavior changes; typecheck + build must stay green.

Rule: NO commits, NO pushes — local testing only.

## Cross-cutting foundation (do first — unblocks every list page)

- [x] `src/components/ui/SortHeader.tsx` — shared sortable table header
      (currently copy-pasted in 9 list files)
- [x] `src/components/ui/Pagination.tsx` — shared pagination footer
      (currently duplicated across 12 files)
- [x] `src/components/ui/SearchInput.tsx` — shared search + clear input
- [x] Register the above in `src/components/ui/index.ts`

## Tier 1 — Critical (biggest, most used, hardest to debug)

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | `orders/components/OrderDetailPageApp.tsx` | 1118 | ✅ split → `OrderDetail` + `OrderCustomerCard` + `OrderProductsCard` + `OrderDeliveryCard` + `OrderStatusTimelineCard` + `OrderShipmentActionsCard` + `OrderMobileActionBar` + shell |
| 2 | `products/components/ProductFormPageApp.tsx` | 1030 | ✅ split → `ProductForm` + `ProductBasicInfoCard` + `ProductPricingCard` + `ProductVariantsCard` + `ProductSettingsCard` + shell |
| 3 | `delivery/components/DriversPageApp.tsx` | 871 | ✅ split → `DriversList` + `DriverRow` + `AssignOrdersDialog` + shell |
| 4 | `orders/components/OrdersList.tsx` | 767 | ✅ split → `OrdersList` + `OrderRow` + `OrderStatus` + `OrderDelivery` |
| 5 | `team/components/TeamPageApp.tsx` | 743 | ✅ split → `TeamList` + `TeamRow` + `RotateKeyDialog` + shell |
| 6 | `customers/components/CustomerDetailPageApp.tsx` | 741 | ✅ split → `CustomerDetail` + `CustomerContactCard` + `CustomerOrdersCard` + `CustomerSegmentsCard` + `CustomerStatsSidebar` + shell |
| 7 | `products/components/ProductsPageApp.tsx` | 738 | ✅ split → `ProductsList` + `ProductRow` + shell |
| 8 | `offers/components/OffersPageApp.tsx` | 727 | ✅ split → `OffersList` + `OfferDesktopRow` + `OfferMobileCard` + `OfferFiltersBar` + `OfferBadges` + shell |
| 9 | `orders/components/NewOrderPageApp.tsx` | 715 | ✅ split → `NewOrderForm` + `NewOrderCustomerCard` + `NewOrderDeliveryCard` + `NewOrderProductsCard` + `NewOrderSummaryCard` + shell |
| 10 | `delivery/components/DriverProfilePageApp.tsx` | 653 | ✅ split → `DriverDetail` + `DriverProfileHeader` + `DriverSettlementCard` + `DriverActiveOrdersCard` + shell |

## Tier 2 — High (500–650 lines)

| File | Lines | Status |
|------|-------|--------|
| `customers/CustomersPageApp.tsx` | 610 | ✅ split → `CustomersList` + `CustomerRow` + shell |
| `product-groups/ProductGroupsPageApp.tsx` | 579 | ✅ split → `ProductGroupsList` + `ProductGroupRow` + shell |
| `customer-groups/CustomerGroupsPageApp.tsx` | 552 | ✅ split → `CustomerGroupsList` + `CustomerGroupRow` + shell |
| `customer-tags/CustomerTagsPageApp.tsx` | 543 | ✅ split → `CustomerTagsList` + `CustomerTagRow` + shell |
| `team/TeamMemberPageApp.tsx` | 574 | ✅ split → `TeamMemberDetail` + `TeamMemberBadges` + `TeamActivitySection` + shell |
| `delivery/DriverCompensationsPageApp.tsx` | 574 | ✅ split → `DriverCompensationsDetail` + `DriverCompensationsSection` + `DriverCompensationRow` + shell |
| `delivery/ShippingProfileFormPageApp.tsx` | 535 | ✅ split → `ShippingProfileForm` + `ShippingProfileInfoCard` + `ShippingProfileWilayaRatesCard` + shell |
| `orders/OrderFulfillmentActions.tsx` | 503 | ✅ split → `OrderRowActions` + `AssignDriverDialog` + `DispatchCompanyDialog` |

## Tier 3 — Medium (400–500 lines)

| File | Lines | Status |
|------|-------|--------|
| `products/ProductDetailPageApp.tsx` | 480 | ✅ split → `ProductDetail` + `ProductVariantsTableCard` + `ProductImagesCard` + shell |
| `delivery/CompanyStopDesksPageApp.tsx` | 473 | ✅ split → `CompanyStopDesksDetail` + `CompanyStopDeskRow` + shell |
| `delivery/CompanyProfilePageApp.tsx` | 453 | ✅ split → `CompanyProfileDetail` + `CompanyHeroCard` + `CompanySettingsSection` + shell |
| `delivery/CompanyCredentialsPageApp.tsx` | 447 | ✅ split → `CompanyCredentialsDetail` + `CompanyCredentialsFormCard` + `CompanyCredentialsSidebar` + shell |
| `delivery/CommuneOverridesDrawer.tsx` | 445 | ✅ split → `CommuneOverridesDrawer` + `CommuneOverrideItem` |
| `delivery/ShippingProfilesPageApp.tsx` | 409 | ✅ split → `ShippingProfilesList` + `ShippingProfileCard` + shell |
| `customer-groups/CustomerGroupDetailPageApp.tsx` | 408 | ✅ split → `CustomerGroupDetail` + `CustomerGroupMemberRow` + shell |
| `customer-tags/CustomerTagDetailPageApp.tsx` | 403 | ✅ split → `CustomerTagDetail` + `CustomerTagAssignedRow` + shell |

## Verification

- `cd cod-client-astro && npm run typecheck` — after every file
- `cd cod-client-astro && npm test` — after every tier
- `cd cod-client-astro && npm run build` — at the end of each tier
