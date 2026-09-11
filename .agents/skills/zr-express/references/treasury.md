# ZR Express API — `treasury`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/treasury.json`

Endpoints in this domain: **15**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/payment-request` | Creates a payment request |
| `POST` | `/api/v{version}/payment-request/search` | Search payment requests (supplier) |
| `GET` | `/api/v{version}/payment-request/{id}` | Gets a payment request by id (supplier) |
| `DELETE` | `/api/v{version}/payment-request/{id}` | Deletes a payment request |
| `PATCH` | `/api/v{version}/payment-request/{id}/date` | Updates the requested date of a payment request |
| `POST` | `/api/v{version}/supplier-payment/export` | Export a list of SupplierPayment current supplier |
| `POST` | `/api/v{version}/supplier-payment/search` | Gets a list of SupplierPayment current supplier |
| `GET` | `/api/v{version}/supplier-payment/stats/current-supplier` | Get transactions stats current supplier. |
| `GET` | `/api/v{version}/supplier-payment/supplier-balance` | get supplier balance by a supplier |
| `POST` | `/api/v{version}/supplier-payment/{id}/details` | Get supplier payment details |
| `PUT` | `/api/v{version}/supplier-payment/{referenceId}` | Accept a payment by a supplier |
| `PUT` | `/api/v{version}/supplier-payment/{supplierPaymentId}` | Accept a payment by a supplier |
| `POST` | `/api/v{version}/treasury-transactions/search/supplier-payment/by-supplier-payment/{supplierPaymentId}` | Gets a list of transactions linked to a supplier payment |
| `POST` | `/api/v{version}/treasury/reports/search` | Gets a list of Reports |
| `POST` | `/api/v{version}/treasury/reports/{reportId}/download` | Download a report file by ID in treasury module |

---

### `POST /api/v{version}/payment-request`

**operationId:** `CreatePaymentRequestEndpoint`

**tags:** `treasury`

**summary:** Creates a payment request

**description:**
> Creates a payment request. The requested date must be at least tomorrow. Permissions required: SupplierAdminRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreatePaymentRequestRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreatePaymentRequestResponse` |


---

### `POST /api/v{version}/payment-request/search`

**operationId:** `SearchPaymentRequestsCurrentSupplierEndpoint`

**tags:** `treasury`

**summary:** Search payment requests (supplier)

**description:**
> Search payment requests for the current supplier. Permissions required: SupplierAdminRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchPaymentRequestsCurrentSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_PaymentRequestResponse` |


---

### `GET /api/v{version}/payment-request/{id}`

**operationId:** `GetPaymentRequestCurrentSupplierEndpoint`

**tags:** `treasury`

**summary:** Gets a payment request by id (supplier)

**description:**
> Gets a payment request by id. Permissions required: SupplierAdminRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PaymentRequestResponse` |


---

### `DELETE /api/v{version}/payment-request/{id}`

**operationId:** `DeletePaymentRequestEndpoint`

**tags:** `treasury`

**summary:** Deletes a payment request

**description:**
> Deletes a payment request. Only pending requests can be deleted. Permissions required: SupplierAdminRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeletePaymentRequestResponse` |


---

### `PATCH /api/v{version}/payment-request/{id}/date`

**operationId:** `UpdatePaymentRequestDateEndpoint`

**tags:** `treasury`

**summary:** Updates the requested date of a payment request

**description:**
> Updates the requested date. Only pending requests can be updated. The date must be at least tomorrow. Permissions required: SupplierAdminRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdatePaymentRequestDateRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdatePaymentRequestDateResponse` |


---

### `POST /api/v{version}/supplier-payment/export`

**operationId:** `ExportSupplierPaymentsCurrentSupplierEndpoint`

**tags:** `treasury`

**summary:** Export a list of SupplierPayment current supplier

**description:**
> Export a list of SupplierPayment current supplier with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `ExportSupplierPaymentsCurrentSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline string (uuid))` |


---

### `POST /api/v{version}/supplier-payment/search`

**operationId:** `SearchSupplierPaymentsCurrentSupplierEndpoint`

**tags:** `treasury`

**summary:** Gets a list of SupplierPayment current supplier

**description:**
> Gets a list of SupplierPayment current supplier with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchSupplierPaymentsCurrentSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SupplierPaymentResponse` |


---

### `GET /api/v{version}/supplier-payment/stats/current-supplier`

**operationId:** `GetTransactionsStatsCurrentSupplierEndpoint`

**tags:** `treasury`

**summary:** Get transactions stats current supplier.

**description:**
> Get transactions stats current supplier.Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `SupplierTransactionStatsDto` |


---

### `GET /api/v{version}/supplier-payment/supplier-balance`

**operationId:** `GetSupplierStatsAmountEndpoint`

**tags:** `treasury`

**summary:** get supplier balance by a supplier

**description:**
> E-commerce supplier FO balance badges. Classic-mail suppliers must use /supplier-balance/classic-mail. Permissions: SupplierAdminRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetSupplierStatsAmountResponse` |


---

### `POST /api/v{version}/supplier-payment/{id}/details`

**operationId:** `GetSupplierPaymentCurrentSupplierEndpoint`

**tags:** `treasury`

**summary:** Get supplier payment details

**description:**
> Get the details of a supplier payment by its ID.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GetSupplierPaymentCurrentSupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `SupplierPaymentSupplierResponse` |


---

### `PUT /api/v{version}/supplier-payment/{referenceId}`

**operationId:** `AcceptSupplierPaymentByReferenceIdEndpoint`

**tags:** `treasury`

**summary:** Accept a payment by a supplier

**description:**
> Accept a payment by a supplier

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `referenceId` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `AcceptSupplierPaymentByReferenceIdRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `AcceptSupplierPaymentByReferenceIResponse` |


---

### `PUT /api/v{version}/supplier-payment/{supplierPaymentId}`

**operationId:** `AcceptSupplierPaymentEndpoint`

**tags:** `treasury`

**summary:** Accept a payment by a supplier

**description:**
> Accept a payment by a supplier

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `supplierPaymentId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `AcceptSupplierPaymentRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `AcceptSupplierPaymentResponse` |


---

### `POST /api/v{version}/treasury-transactions/search/supplier-payment/by-supplier-payment/{supplierPaymentId}`

**operationId:** `SearchTreasuryTransactionsSupplierPaymentBySupplierPaymentIdEndpoint`

**tags:** `treasury-transactions`

**summary:** Gets a list of transactions linked to a supplier payment

**description:**
> Gets a list of transactions with pagination and filtering support linked to a supplier payment

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `supplierPaymentId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchTreasuryTransactionsSupplierPaymentBySupplierPaymentIdRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_TreasurySupplierPaymentTransactionResponse` |


---

### `POST /api/v{version}/treasury/reports/search`

**operationId:** `SearchTreasuryReportsEndpoint`

**tags:** `treasury`

**summary:** Gets a list of Reports

**description:**
> Gets a list of Reports in treasury module with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchTreasuryReportsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchReportsResponse` |


---

### `POST /api/v{version}/treasury/reports/{reportId}/download`

**operationId:** `DownloadTreasuryReportByIdEndpoint`

**tags:** `treasury`

**summary:** Download a report file by ID in treasury module

**description:**
> Returns a SAS URL to download the report file by its ID.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `reportId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DownloadReportByIdResponse` |


---
