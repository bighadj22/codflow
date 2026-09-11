# ZR Express API — `supplier`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/supplier.json`

Endpoints in this domain: **3**

| Method | Path | Summary |
|--------|------|---------|
| `GET` | `/api/v{version}/supplier/supplier-price-list-assignments/{supplierId}` | List supplier price list assignments by origin territory |
| `POST` | `/api/v{version}/supplier/{supplierId}` | gets supplier item by id |
| `PATCH` | `/api/v{version}/supplier/{supplierId}/blocked` | Update supplier blocked status |

---

### `GET /api/v{version}/supplier/supplier-price-list-assignments/{supplierId}`

**operationId:** `ListSupplierPriceListAssignmentsEndpoint`

**tags:** `supplier`

**summary:** List supplier price list assignments by origin territory

**description:**
> Returns all origin-territory price list assignments configured for a supplier.

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


---

### `POST /api/v{version}/supplier/{supplierId}`

**operationId:** `GetSupplierEndpoint`

**tags:** `supplier`

**summary:** gets supplier item by id

**description:**
> gets supplier item by id. Permissions requises : GlobalAdminRole, GlobalViewerRole, HubAdminRole, HubSuppliersManagerRole, et tous les SupplierRoles.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `supplierId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GetSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetSupplierResponse` |


---

### `PATCH /api/v{version}/supplier/{supplierId}/blocked`

**operationId:** `UpdateSupplierBlockedStatusEndpoint`

**tags:** `supplier`

**summary:** Update supplier blocked status

**description:**
> Sets whether the supplier is blocked from parcel operations. Super-admins and operations admins (root / sub-contractor).

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `supplierId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateSupplierBlockedStatusRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateSupplierBlockedStatusResponse` |


---
