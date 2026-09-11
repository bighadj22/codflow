# ZR Express — API Endpoints Index

Source: `https://api.zrexpress.app/swagger/public-v1/swagger.json`
OpenAPI `3.0.4` · `ZRExpress.Api (Public)` v1
> Do not alter. Machine-generated verbatim from `swagger.json`. Fetched 2026-09-10.

- **129 unique endpoints** · **116 paths** · **313 component schemas**
- Base URL: `https://api.zrexpress.app` (path prefix `/api/v1/…`)
- Auth: `X-Api-Key: {apiKey}` + `X-Tenant: {tenantId}` headers (bearer also accepted)

| Domain | File | Endpoints |
|--------|------|-----------|
| catalog | `references/catalog.md` | 17 |
| claims | `references/claims.md` | 11 |
| customers | `references/customers.md` | 15 |
| orders | `references/orders.md` | 50 |
| delivery-pricing | `references/delivery-pricing.md` | 5 |
| hubs | `references/hubs.md` | 2 |
| supplier | `references/supplier.md` | 3 |
| treasury | `references/treasury.md` | 15 |
| users | `references/users.md` | 4 |
| webhooks | `references/webhooks.md` | 7 |
| **total** | | **129** |

## Auth

| Scheme | Where | Value |
|--------|-------|-------|
| `bearerAuth` | `Authorization: Bearer {token}` | JWT bearer token |
| `apiKey` | `X-Api-Key: {apiKey}` | API key |

Most endpoints **also require the `X-Tenant` header** (tenant/supplier Id). The `version` path parameter defaults to `1`.

## Endpoint inventory by domain

### catalog

- `POST   /api/v{version}/catalog/reports/search`
- `POST   /api/v{version}/catalog/reports/{reportId}/download`
- `POST   /api/v{version}/categories/search`
- `POST   /api/v{version}/products`
- `POST   /api/v{version}/products/export`
- `POST   /api/v{version}/products/import`
- `GET    /api/v{version}/products/import/template`
- `PATCH  /api/v{version}/products/product/{productId}/local-stock`
- `POST   /api/v{version}/products/search`
- `POST   /api/v{version}/products/{id}`
- `PUT    /api/v{version}/products/{id}`
- `DELETE /api/v{version}/products/{id}`
- `PATCH  /api/v{version}/products/{id}/discount`
- `PATCH  /api/v{version}/products/{id}/price`
- `POST   /api/v{version}/receipts/search`
- `GET    /api/v{version}/receipts/{id}`
- `POST   /api/v{version}/stock-movements/product/warehouse-stock/user`

### claims

- `POST   /api/v{version}/claim-categories/search`
- `GET    /api/v{version}/claim-categories/{id}`
- `PATCH  /api/v{version}/claim-comments/{claimId}`
- `POST   /api/v{version}/claim-comments/{claimId}/search`
- `POST   /api/v{version}/claim-workflows/search`
- `POST   /api/v{version}/claims`
- `POST   /api/v{version}/claims/search`
- `POST   /api/v{version}/claims/{claimId}`
- `PATCH  /api/v{version}/claims/{claimId}`
- `DELETE /api/v{version}/claims/{id}`
- `GET    /api/v{version}/claims/{id}/state-histories`

### customers

- `POST   /api/v{version}/customers/company`
- `POST   /api/v{version}/customers/export`
- `GET    /api/v{version}/customers/global/search`
- `POST   /api/v{version}/customers/import/individual`
- `GET    /api/v{version}/customers/import/individual/template`
- `POST   /api/v{version}/customers/individual`
- `PUT    /api/v{version}/customers/individual/{id}`
- `POST   /api/v{version}/customers/reports/search`
- `POST   /api/v{version}/customers/reports/{reportId}/download`
- `POST   /api/v{version}/customers/search`
- `POST   /api/v{version}/customers/{customerId}/address`
- `PUT    /api/v{version}/customers/{customerId}/address/{addressId}`
- `DELETE /api/v{version}/customers/{customerId}/address/{addressId}`
- `GET    /api/v{version}/customers/{id}`
- `DELETE /api/v{version}/customers/{id}`

### delivery-pricing

- `GET    /api/v{version}/delivery-pricing/price-lists/{id}`
- `GET    /api/v{version}/delivery-pricing/rates`
- `GET    /api/v{version}/delivery-pricing/rates/{toTerritoryId}`
- `GET    /api/v{version}/delivery-pricing/service-pricing`
- `GET    /api/v{version}/delivery-pricing/supplier-specific-prices/{supplierId}`

### hubs

- `POST   /api/v{version}/hubs/search`
- `POST   /api/v{version}/hubs/{id}`

### orders

- `POST   /api/v{version}/orders/reports/search`
- `POST   /api/v{version}/orders/reports/{reportId}/download`
- `POST   /api/v{version}/parcel-modification-requests`
- `POST   /api/v{version}/parcel-modification-requests/phone`
- `POST   /api/v{version}/parcel-modification-requests/search`
- `GET    /api/v{version}/parcel-modification-requests/{id}`
- `DELETE /api/v{version}/parcel-modification-requests/{id}`
- `POST   /api/v{version}/parcel-modification-requests/{parcelId}`
- `PATCH  /api/v{version}/parcel-modification-requests/{requestId}`
- `POST   /api/v{version}/parcels`
- `POST   /api/v{version}/parcels/bulk`
- `DELETE /api/v{version}/parcels/bulk`
- `POST   /api/v{version}/parcels/bulk-exchange`
- `POST   /api/v{version}/parcels/bulk-refund`
- `DELETE /api/v{version}/parcels/bulk/by-tracking-number`
- `POST   /api/v{version}/parcels/exchange`
- `POST   /api/v{version}/parcels/export`
- `POST   /api/v{version}/parcels/import-parcels`
- `GET    /api/v{version}/parcels/import-parcels/template`
- `POST   /api/v{version}/parcels/labels/individual`
- `POST   /api/v{version}/parcels/labels/individual/pdf`
- `POST   /api/v{version}/parcels/labels/multiple`
- `POST   /api/v{version}/parcels/labels/multiple/pdf`
- `POST   /api/v{version}/parcels/refund`
- `POST   /api/v{version}/parcels/search`
- `GET    /api/v{version}/parcels/search/global`
- `GET    /api/v{version}/parcels/stats/workflow/{workflowId}/state/{stateId}`
- `GET    /api/v{version}/parcels/stats/{workflowId}`
- `GET    /api/v{version}/parcels/{id}`
- `DELETE /api/v{version}/parcels/{id}`
- `PATCH  /api/v{version}/parcels/{id}/amount`
- `PATCH  /api/v{version}/parcels/{id}/customer`
- `PATCH  /api/v{version}/parcels/{id}/deliveryAddress`
- `PATCH  /api/v{version}/parcels/{parcelId}/products`
- `PATCH  /api/v{version}/parcels/{parcelId}/state`
- `GET    /api/v{version}/parcels/{parcelId}/state-history`
- `POST   /api/v{version}/parcels/{parcelId}/state-history/{parcelStateHistoryId}/workflow/{workflowId}/situation-history`
- `PATCH  /api/v{version}/parcels/{parcelId}/state/refund`
- `GET    /api/v{version}/parcels/{trackingNumber}`
- `POST   /api/v{version}/pickup-bags`
- `POST   /api/v{version}/pickup-bags/labels/pdf`
- `POST   /api/v{version}/pickup-bags/search`
- `PATCH  /api/v{version}/pickup-bags/{bagId}/add-parcel`
- `PATCH  /api/v{version}/pickup-bags/{bagId}/remove-parcel`
- `GET    /api/v{version}/pickup-bags/{id}`
- `DELETE /api/v{version}/pickup-bags/{id}`
- `GET    /api/v{version}/pickup-bags/{trackingNumber}`
- `POST   /api/v{version}/pickup-bags/{trackingNumber}/parcels/search`
- `POST   /api/v{version}/territories/search`
- `POST   /api/v{version}/workflows/search`

### supplier

- `GET    /api/v{version}/supplier/supplier-price-list-assignments/{supplierId}`
- `POST   /api/v{version}/supplier/{supplierId}`
- `PATCH  /api/v{version}/supplier/{supplierId}/blocked`

### treasury

- `POST   /api/v{version}/payment-request`
- `POST   /api/v{version}/payment-request/search`
- `GET    /api/v{version}/payment-request/{id}`
- `DELETE /api/v{version}/payment-request/{id}`
- `PATCH  /api/v{version}/payment-request/{id}/date`
- `POST   /api/v{version}/supplier-payment/export`
- `POST   /api/v{version}/supplier-payment/search`
- `GET    /api/v{version}/supplier-payment/stats/current-supplier`
- `GET    /api/v{version}/supplier-payment/supplier-balance`
- `POST   /api/v{version}/supplier-payment/{id}/details`
- `PUT    /api/v{version}/supplier-payment/{referenceId}`
- `PUT    /api/v{version}/supplier-payment/{supplierPaymentId}`
- `POST   /api/v{version}/treasury-transactions/search/supplier-payment/by-supplier-payment/{supplierPaymentId}`
- `POST   /api/v{version}/treasury/reports/search`
- `POST   /api/v{version}/treasury/reports/{reportId}/download`

### users

- `POST   /api/v{version}/users/keys`
- `POST   /api/v{version}/users/keys/search`
- `DELETE /api/v{version}/users/keys/{id}`
- `GET    /api/v{version}/users/profile`

### webhooks

- `POST   /api/v{version}/webhooks/endpoints`
- `GET    /api/v{version}/webhooks/endpoints`
- `PUT    /api/v{version}/webhooks/endpoints/{endpointId}`
- `GET    /api/v{version}/webhooks/endpoints/{endpointId}`
- `DELETE /api/v{version}/webhooks/endpoints/{endpointId}`
- `GET    /api/v{version}/webhooks/endpoints/{endpointId}/headers`
- `GET    /api/v{version}/webhooks/endpoints/{endpointId}/secret`

