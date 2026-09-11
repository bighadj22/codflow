# ZR Express API — `customers`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/customers.json`

Endpoints in this domain: **15**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/customers/company` | Creates a customer |
| `POST` | `/api/v{version}/customers/export` | Export a list of customers |
| `GET` | `/api/v{version}/customers/global/search` | Top global customer search |
| `POST` | `/api/v{version}/customers/import/individual` | Imports individual customers from an Excel file |
| `GET` | `/api/v{version}/customers/import/individual/template` | Download template for importing individual customers |
| `POST` | `/api/v{version}/customers/individual` | Creates a customer |
| `PUT` | `/api/v{version}/customers/individual/{id}` | update individual customer. |
| `POST` | `/api/v{version}/customers/reports/search` | Gets a list of customer export reports |
| `POST` | `/api/v{version}/customers/reports/{reportId}/download` | Download a customer export report file by ID |
| `POST` | `/api/v{version}/customers/search` | Gets a list of customers |
| `POST` | `/api/v{version}/customers/{customerId}/address` | add customer address |
| `PUT` | `/api/v{version}/customers/{customerId}/address/{addressId}` | update customer address |
| `DELETE` | `/api/v{version}/customers/{customerId}/address/{addressId}` | delete customer address |
| `GET` | `/api/v{version}/customers/{id}` | Get customer details |
| `DELETE` | `/api/v{version}/customers/{id}` | Deletes customer by id |

---

### `POST /api/v{version}/customers/company`

**operationId:** `CreateCompanyCustomerEndpoint`

**tags:** `customers`

**summary:** Creates a customer

**description:**
> Creates a customer, the 'TimeSlot' paramater indicates time slot preference and accepts 'morning','afternoon', or 'evening'. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateCompanyCustomerRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `Result_CreateCompanyCustomerResponse` |


---

### `POST /api/v{version}/customers/export`

**operationId:** `ExportCustomersEndpoint`

**tags:** `customers`

**summary:** Export a list of customers

**description:**
> Export a list of customers to an Excel file. The export is processed asynchronously and returns a report ID. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `ExportCustomersRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline string (uuid))` |


---

### `GET /api/v{version}/customers/global/search`

**operationId:** `SearchGlobalCustomersEndpointTop`

**tags:** `customers`

**summary:** Top global customer search

**description:**
> Search customers by phone number for the GlobalSearch component without pagination or count queries.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `keyword` | query | no | `string` |
| 3 | `top` | query | no | `integer (int32)` — default=`10` |
| 4 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline array of SearchGlobalCustomerResponse)` |


---

### `POST /api/v{version}/customers/import/individual`

**operationId:** `ImportIndividualCustomersEndpoint`

**tags:** `customers`

**summary:** Imports individual customers from an Excel file

**description:**
> Imports individual customers using an Excel file. Supports two formats: 1) multipart/form-data with 'file' field (recommended, more efficient), 2) JSON body with 'excelFileBase64' (legacy). Optionally provide a dictionary of columns and their matching propertyNames.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `multipart/form-data` → schema `ImportIndividualCustomersFormData`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `CustomerImportResult` |
| 400 | Bad Request | `ProblemDetails` |


---

### `GET /api/v{version}/customers/import/individual/template`

**operationId:** `DownloadTemplateBulkIndividualCustomersEndpoint`

**tags:** `customers`

**summary:** Download template for importing individual customers

**description:**
> Returns an Excel template file for bulk importing individual customers.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | - |


---

### `POST /api/v{version}/customers/individual`

**operationId:** `CreateIndividualCustomerEndpoint`

**tags:** `customers`

**summary:** Creates a customer

**description:**
> Creates a customer, The 'Gender' paramater indicates the gender of the customer and accepts 'male', or 'female', the 'TimeSlot' paramater indicates time slot preference and accepts 'morning','afternoon', or 'evening',the 'DeliveryPreference' paramater indicates delivery preference and accepts 'home', or 'pickup-point'. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateIndividualCustomerRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateIndividualCustomerResponse` |


---

### `PUT /api/v{version}/customers/individual/{id}`

**operationId:** ``

**tags:** `customers`

**summary:** update individual customer.

**description:**
> update individual customer by id, The 'Gender' paramater indicates the gender of the customer and accepts 'male', or 'female', the 'TimeSlot' paramater indicates time slot preference and accepts 'morning','afternoon', or 'evening',the 'DeliveryPreference' paramater indicates delivery preference and accepts 'home', or 'pickup-point' .

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateIndividualCustomerRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateIndividualCustomerResponse` |


---

### `POST /api/v{version}/customers/reports/search`

**operationId:** `SearchExportReportsEndpoint`

**tags:** `customers`

**summary:** Gets a list of customer export reports

**description:**
> Gets a list of customer export reports with pagination and filtering support. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchExportReportsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_ExportReportResponse` |


---

### `POST /api/v{version}/customers/reports/{reportId}/download`

**operationId:** `DownloadExportReportEndpoint`

**tags:** `customers`

**summary:** Download a customer export report file by ID

**description:**
> Returns a SAS URL to download the customer export report file by its ID. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `reportId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DownloadExportReportResponse` |


---

### `POST /api/v{version}/customers/search`

**operationId:** `SearchCustomersEndpoint`

**tags:** `customers`

**summary:** Gets a list of customers

**description:**
> Gets a list of customers with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchCustomersRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_CustomerResponse` |


---

### `POST /api/v{version}/customers/{customerId}/address`

**operationId:** ``

**tags:** `customers`

**summary:** add customer address

**description:**
> add new address to existing customer. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `customerId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateCustomerAddressRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `CreateCustomerAddressResponse` |


---

### `PUT /api/v{version}/customers/{customerId}/address/{addressId}`

**operationId:** ``

**tags:** `customers`

**summary:** update customer address

**description:**
> update customer address using customer id

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `customerId` | path | yes | `string (uuid)` |
| 3 | `addressId` | path | yes | `string (uuid)` |
| 4 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateCustomerAddressRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateCustomerAddressResponse` |


---

### `DELETE /api/v{version}/customers/{customerId}/address/{addressId}`

**operationId:** ``

**tags:** `customers`

**summary:** delete customer address

**description:**
> delete customer address using customer id and address id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `customerId` | path | yes | `string (uuid)` |
| 3 | `addressId` | path | yes | `string (uuid)` |
| 4 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeleteCustomerAddressResponse` |


---

### `GET /api/v{version}/customers/{id}`

**operationId:** `GetCustomerEndpoint`

**tags:** `customers`

**summary:** Get customer details

**description:**
> Get the details of a customer by its Id.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetCustomerResponse` |


---

### `DELETE /api/v{version}/customers/{id}`

**operationId:** `DeleteCustomerEndpoint`

**tags:** `customers`

**summary:** Deletes customer by id

**description:**
> Delete a customer by Id with related address. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 204 | No Content | `DeleteCustomerResponse` |


---
