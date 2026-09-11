# ZR Express API — `delivery-pricing`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/delivery-pricing.json`

Endpoints in this domain: **5**

| Method | Path | Summary |
|--------|------|---------|
| `GET` | `/api/v{version}/delivery-pricing/price-lists/{id}` | [Deprecated] Gets a price list |
| `GET` | `/api/v{version}/delivery-pricing/rates` | Get effective delivery rates for all territories |
| `GET` | `/api/v{version}/delivery-pricing/rates/{toTerritoryId}` | Get effective delivery rate for a specific territory |
| `GET` | `/api/v{version}/delivery-pricing/service-pricing` | Get the service pricing for the current supplier |
| `GET` | `/api/v{version}/delivery-pricing/supplier-specific-prices/{supplierId}` | [Deprecated] Get supplier-specific delivery prices |

---

### `GET /api/v{version}/delivery-pricing/price-lists/{id}`

**operationId:** `GetPriceListEndpoint`

**tags:** `delivery-pricing`, `deprecated`

**summary:** [Deprecated] Gets a price list

**description:**
> Gets a price list. This endpoint is deprecated. Please use GET /delivery-pricing/rates instead to get effective delivery prices with priority logic already applied.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetPriceListResponse` |


---

### `GET /api/v{version}/delivery-pricing/rates`

**operationId:** `GetAllRatesEndpoint`

**tags:** `rates`

**summary:** Get effective delivery rates for all territories

**description:**
> Returns the effective delivery prices for all destination territories. Supply an optional 'fromTerritoryId' (origin wilaya) to resolve the price list from the supplier's explicit assignment for that origin. Returns 404 when no assignment exists. This endpoint automatically applies the priority logic: supplier-specific prices take precedence over PriceList prices.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `fromTerritoryId` | query | no | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetAllRatesResponse` |
| 404 | Not Found | `ProblemDetails` |


---

### `GET /api/v{version}/delivery-pricing/rates/{toTerritoryId}`

**operationId:** `GetRateEndpoint`

**tags:** `rates`

**summary:** Get effective delivery rate for a specific territory

**description:**
> Returns the effective delivery prices for a specific destination territory. This endpoint automatically applies the priority logic: supplier-specific prices take precedence over PriceList prices.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `toTerritoryId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetRateResponse` |
| 404 | Not Found | `ProblemDetails` |


---

### `GET /api/v{version}/delivery-pricing/service-pricing`

**operationId:** `GetCurrentSupplierServicePricingEndpoint`

**tags:** `service-pricing`

**summary:** Get the service pricing for the current supplier

**description:**
> Returns the service pricing (labeling, weighting, switch) for the currently authenticated supplier.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ServicePricingResponse` |
| 404 | Not Found | `ProblemDetails` |


---

### `GET /api/v{version}/delivery-pricing/supplier-specific-prices/{supplierId}`

**operationId:** `GetSupplierSpecificPricesEndpoint`

**tags:** `specific-prices`, `deprecated`

**summary:** [Deprecated] Get supplier-specific delivery prices

**description:**
> Retrieves all supplier-specific delivery prices for a given supplier. This endpoint is deprecated. Please use GET /delivery-pricing/rates instead to get effective delivery prices with priority logic already applied.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `supplierId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | - |
| 404 | Not Found | `ProblemDetails` |


---
