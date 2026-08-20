# Server Actions

This directory contains Next.js server actions (`"use server"`). They are the
only bridge between the frontend and the backend.

## Read vs write pattern

- **Reads** read D1 directly through the shared query layer (`cod-shared/queries/*`),
  after a `requirePermission(...)` check:

  ```ts
  export async function getProducts(filters?) {
    await requirePermission(SCOPES.PRODUCTS_READ);
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    return getAllProducts(db, filters);
  }
  ```

- **Writes** call the cod-server REST API via `apiClient`, using the signed-in
  user's stored API key (`getUserApiKey()`), then `revalidatePath(...)`:

  ```ts
  export async function createProduct(data) {
    await requirePermission(SCOPES.PRODUCTS_MANAGE);
    const key = await getUserApiKey();
    const res = await apiClient.post("/api/products", key, data);
    revalidatePath("/products");
    return res.data;
  }
  ```

- **Exceptions** — a small set of reads that stay on `apiClient` because there is
  no local D1 table for the data: `fetchCompanyStopDesks`
  (`delivery-companies.ts`), `getShipmentTracking` (`orders.ts`), and
  `getPixelConfig` (`stores.ts`). No new `apiClient.get` calls should be added
  to `actions/*.ts` outside these three.

Errors from `apiClient` are mapped to localized messages with `mapError` from
`@/lib/errors/mapper`.

## Files

| File | Functions |
|------|-----------|
| `users.ts` | `getUsers`, `getUser`, `createUser`, `updateUser`, `updateUserRole`, `grantScope`, `revokeScope`, `rotateApiKey` |
| `products.ts` | `getProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `getVariants`, `createVariant`, `updateVariant`, `deleteVariant`, `getProductImages`, `getPresignedUploadUrl`, `saveProductImage`, `reorderProductImages`, `deleteProductImage` |
| `product-groups.ts` | `getProductGroups`, `getProductGroup`, `createProductGroup`, `updateProductGroup`, `getPresignedUploadUrlForCategory`, `deleteProductGroup` |
| `orders.ts` | `getOrders`, `getOrder`, `createOrder`, `updateOrderStatus`, `assignDriverToOrder`, `deleteOrder`, `dispatchOrder`, `updateShipment`, `cancelShipment`, `addShipmentRemark`, `getShipmentTracking`, `validateShipment` |
| `abandoned-orders.ts` | `getAbandonedOrders`, `getAbandonedOrderStatsAction`, `markAbandonedOrderContactedAction`, `deleteAbandonedOrderAction` |
| `customers.ts` | `getCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `getCustomerOrders`, `getCustomerGroupMemberships`, `getCustomerTagMemberships`, `deleteCustomer` |
| `customer-groups.ts` | `getCustomerGroups`, `getCustomerGroup`, `createCustomerGroup`, `updateCustomerGroup`, `deleteCustomerGroup`, `addCustomerToGroup`, `removeCustomerFromGroup` |
| `customer-tags.ts` | `getCustomerTags`, `getCustomerTag`, `createCustomerTag`, `updateCustomerTag`, `deleteCustomerTag`, `assignCustomerTag`, `unassignCustomerTag` |
| `drivers.ts` | `getDrivers`, `getDriver`, `createDriver`, `updateDriver`, `updateDriverStatus` (`available` \| `busy` \| `inactive`), `getDriverCompensations`, `setDriverCompensation`, `deleteDriverCompensation`, `deleteDriver` |
| `driver-payments.ts` | `createDriverPayment`, `getDriverPayments`, `getPendingSettlementOrders` |
| `delivery-companies.ts` | `getDeliveryCompanies`, `getDeliveryCompany`, `createDeliveryCompany`, `updateDeliveryCompany`, `fetchCompanyStopDesks`, `syncCompanyStopDesks`, `toggleCompanyStopDesk`, `deleteDeliveryCompany`, `registerZrWebhook`, `unregisterZrWebhook`, `saveYalidineSecret`, `saveZrStatusMapping` |
| `shipping-profiles.ts` | `getShippingProfiles`, `getShippingProfile`, `getDefaultShippingRules`, `getShippingRulesByProfileId`, `createShippingProfile`, `updateShippingProfile`, `deleteShippingProfile`, `getShippingRuleCommunes`, `setCommuneOverride`, `deleteCommuneOverride`, `setShippingRules` |
| `wilayas.ts` | `getWilayas`, `getCommunes` |
| `offers.ts` | `getOffers`, `getOffer`, `createOffer`, `updateOffer`, `deleteOffer` |
| `reviews.ts` | `getReviews`, `updateReviewStatus`, `deleteReview` |
| `stock.ts` | `adjustProductStock`, `adjustVariantStock`, `getStockHistory`, `getStockOverview`, `getStockAlerts`, `updateProductStockThreshold`, `updateVariantStockThreshold` |
| `analytics.ts` | `getDashboardStats` |
| `activity-logs.ts` | `getActivityLogs`, `getUserActivityLogs` |
| `stores.ts` | `getMyStore`, `getPixelConfig`, `savePixelConfig`, `updateMyStore` |
| `mcp.ts` | `getMcpConfig`, `listMyMcpConnections`, `listTeamMcpConnections`, `revokeMyMcpConnection`, `revokeUserMcpConnection` |

## Checklist for new actions

1. **Permission:** `await requirePermission(SCOPES.XY_READ / XY_MANAGE)` first.
2. **Read:** use the matching `cod-shared/queries/*` function against `getDb(env.DB)`.
   **Write:** `getUserApiKey()` then `apiClient.post/patch/delete`.
3. **Revalidation:** call `revalidatePath(...)` after any mutation.
4. **Errors:** wrap `ApiClientError`s with `mapError(code, locale, context)`.
5. **Types:** import request/response types from `@/types`.