# ZR Express API — `webhooks`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/webhooks.json`

Endpoints in this domain: **7**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/webhooks/endpoints` | Create a webhook endpoint |
| `GET` | `/api/v{version}/webhooks/endpoints` | List webhook endpoints |
| `PUT` | `/api/v{version}/webhooks/endpoints/{endpointId}` | Update a webhook endpoint |
| `GET` | `/api/v{version}/webhooks/endpoints/{endpointId}` | Get a webhook endpoint |
| `DELETE` | `/api/v{version}/webhooks/endpoints/{endpointId}` | Delete a webhook endpoint |
| `GET` | `/api/v{version}/webhooks/endpoints/{endpointId}/headers` | Get webhook endpoint headers |
| `GET` | `/api/v{version}/webhooks/endpoints/{endpointId}/secret` | Get webhook endpoint secret |

---

### `POST /api/v{version}/webhooks/endpoints`

**operationId:** `CreateEndpointEndpoint`

**tags:** `webhooks`

**summary:** Create a webhook endpoint

**description:**
> Creates a new webhook endpoint for the supplier to receive webhook events

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateEndpointRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateEndpointResponse` |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |


---

### `GET /api/v{version}/webhooks/endpoints`

**operationId:** `ListEndpointsEndpoint`

**tags:** `webhooks`

**summary:** List webhook endpoints

**description:**
> Retrieves all webhook endpoints configured for the supplier

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ListEndpointsResponse` |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |


---

### `PUT /api/v{version}/webhooks/endpoints/{endpointId}`

**operationId:** `UpdateEndpointEndpoint`

**tags:** `webhooks`

**summary:** Update a webhook endpoint

**description:**
> Updates an existing webhook endpoint configuration

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `endpointId` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateEndpointRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateEndpointResponse` |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |
| 404 | Not Found | `ProblemDetails` |


---

### `GET /api/v{version}/webhooks/endpoints/{endpointId}`

**operationId:** `GetEndpointEndpoint`

**tags:** `webhooks`

**summary:** Get a webhook endpoint

**description:**
> Retrieves the details of a specific webhook endpoint by its ID

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `endpointId` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetEndpointResponse` |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |
| 404 | Not Found | `ProblemDetails` |


---

### `DELETE /api/v{version}/webhooks/endpoints/{endpointId}`

**operationId:** `DeleteEndpointEndpoint`

**tags:** `webhooks`

**summary:** Delete a webhook endpoint

**description:**
> Deletes a webhook endpoint permanently

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `endpointId` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 204 | No Content | - |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |
| 404 | Not Found | `ProblemDetails` |


---

### `GET /api/v{version}/webhooks/endpoints/{endpointId}/headers`

**operationId:** `GetEndpointHeadersEndpoint`

**tags:** `webhooks`

**summary:** Get webhook endpoint headers

**description:**
> Retrieves the custom headers configured for a specific webhook endpoint

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `endpointId` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetEndpointHeadersResponse` |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |
| 404 | Not Found | `ProblemDetails` |


---

### `GET /api/v{version}/webhooks/endpoints/{endpointId}/secret`

**operationId:** `GetEndpointSecretEndpoint`

**tags:** `webhooks`

**summary:** Get webhook endpoint secret

**description:**
> Retrieves the signing secret for a specific webhook endpoint. This secret should be used to verify webhook signatures.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `endpointId` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetEndpointSecretResponse` |
| 400 | Bad Request | `ProblemDetails` |
| 401 | Unauthorized | `ProblemDetails` |
| 403 | Forbidden | `ProblemDetails` |
| 404 | Not Found | `ProblemDetails` |


---
