# ZR Express API — `claims`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/claims.json`

Endpoints in this domain: **11**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/claim-categories/search` | Gets a list of claim categories |
| `GET` | `/api/v{version}/claim-categories/{id}` | gets claim category item by id |
| `PATCH` | `/api/v{version}/claim-comments/{claimId}` | Create a comment for a specific claim for current supplier. |
| `POST` | `/api/v{version}/claim-comments/{claimId}/search` | Gets a list of claim comments for a specific claim by Id for current supplier |
| `POST` | `/api/v{version}/claim-workflows/search` | Gets a list of claim workflows |
| `POST` | `/api/v{version}/claims` | Creates a claim |
| `POST` | `/api/v{version}/claims/search` | Gets a list of claims for Current Supplier |
| `POST` | `/api/v{version}/claims/{claimId}` | gets claim item by id |
| `PATCH` | `/api/v{version}/claims/{claimId}` | Update details for a specific claim. |
| `DELETE` | `/api/v{version}/claims/{id}` | Deletes a Claim |
| `GET` | `/api/v{version}/claims/{id}/state-histories` | get claim state histories |

---

### `POST /api/v{version}/claim-categories/search`

**operationId:** `SearchClaimCategoriesEndpoint`

**tags:** `claims`

**summary:** Gets a list of claim categories

**description:**
> Gets a list of claim categories with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchClaimCategoriesRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchClaimCategoryResponse` |


---

### `GET /api/v{version}/claim-categories/{id}`

**operationId:** `GetClaimCategoryEndpoint`

**tags:** `claims`

**summary:** gets claim category item by id

**description:**
> gets claim category item by id

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetCategoryClaimResponse` |


---

### `PATCH /api/v{version}/claim-comments/{claimId}`

**operationId:** `CreateClaimCommentCurrentSupplierEndpoint`

**tags:** `claims`

**summary:** Create a comment for a specific claim for current supplier.

**description:**
> Create a comment for a specific claim for current supplier. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `claimId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateClaimCommentCurrentSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateClaimCommentResponse` |


---

### `POST /api/v{version}/claim-comments/{claimId}/search`

**operationId:** `SearchClaimCommentsCurrentSupplierEndpoint`

**tags:** `claims`

**summary:** Gets a list of claim comments for a specific claim by Id for current supplier

**description:**
> Gets a list of claim comments for a specific claim by Id for current supplier with pagination and filtering support. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `claimId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchClaimCommentsCurrentSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_ClaimCommentResponse` |


---

### `POST /api/v{version}/claim-workflows/search`

**operationId:** `SearchClaimWorkflowsEndpoint`

**tags:** `claims`

**summary:** Gets a list of claim workflows

**description:**
> Gets a list of claim workflows with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchClaimWorkflowsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_ClaimWorkflowResponse` |


---

### `POST /api/v{version}/claims`

**operationId:** `CreateClaimEndpoint`

**tags:** `claims`

**summary:** Creates a claim

**description:**
> Creates a claim. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateClaimRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateClaimResponse` |


---

### `POST /api/v{version}/claims/search`

**operationId:** `SearchClaimsSupplierEndpoint`

**tags:** `claims`

**summary:** Gets a list of claims for Current Supplier

**description:**
> Gets a list of claims for Current Supplier with pagination and filtering support. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchClaimsSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_ClaimResponse` |


---

### `POST /api/v{version}/claims/{claimId}`

**operationId:** `GetClaimSupplierEndpoint`

**tags:** `claims`

**summary:** gets claim item by id

**description:**
> gets claim item by id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `claimId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GetClaimSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ClaimResponse` |


---

### `PATCH /api/v{version}/claims/{claimId}`

**operationId:** `UpdateClaimDetailsEndpoint`

**tags:** `claims`

**summary:** Update details for a specific claim.

**description:**
> Update details for a specific claim. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole, HubAdminRole, HubClaimsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `claimId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateClaimDetailsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateClaimDetailsResponse` |


---

### `DELETE /api/v{version}/claims/{id}`

**operationId:** `DeleteClaimEndpoint`

**tags:** `claims`

**summary:** Deletes a Claim

**description:**
> Deletes a Claim by id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 204 | No Content | `DeleteClaimResponse` |


---

### `GET /api/v{version}/claims/{id}/state-histories`

**operationId:** `GetClaimStateHistoryEndpoint`

**tags:** `claims`

**summary:** get claim state histories

**description:**
> get claim state histories

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline array of ClaimStateHistoryDto)` |


---
