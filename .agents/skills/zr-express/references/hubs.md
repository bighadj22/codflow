# ZR Express API — `hubs`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/hubs.json`

Endpoints in this domain: **2**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/hubs/search` | Get a list of hubs |
| `POST` | `/api/v{version}/hubs/{id}` | Get a hub by Id |

---

### `POST /api/v{version}/hubs/search`

**operationId:** `SearchSupplierHubsEndpoint`

**tags:** `hubs`

**summary:** Get a list of hubs

**description:**
> Get a list of hubs with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchSupplierHubsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SupplierHubResponse` |


---

### `POST /api/v{version}/hubs/{id}`

**operationId:** `GetSupplierHubEndpoint`

**tags:** `hubs`

**summary:** Get a hub by Id

**description:**
> Get a hub by Id

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GetSupplierHubRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `SupplierHubResponse` |


---
