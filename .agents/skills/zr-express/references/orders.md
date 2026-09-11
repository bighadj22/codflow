# ZR Express API — `orders`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/orders.json`

Endpoints in this domain: **50**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/orders/reports/search` | Gets a list of Reports in orders module |
| `POST` | `/api/v{version}/orders/reports/{reportId}/download` | Download a report file by ID |
| `POST` | `/api/v{version}/parcel-modification-requests` | Creates a parcel modification request |
| `POST` | `/api/v{version}/parcel-modification-requests/phone` | Change parcel phone (auto-applied modification request) |
| `POST` | `/api/v{version}/parcel-modification-requests/search` | Search supplier's parcels' modification requests |
| `GET` | `/api/v{version}/parcel-modification-requests/{id}` | get parcel modification request item by id |
| `DELETE` | `/api/v{version}/parcel-modification-requests/{id}` | Deletes an existing parcel modification request |
| `POST` | `/api/v{version}/parcel-modification-requests/{parcelId}` | Search parcels' modification requests |
| `PATCH` | `/api/v{version}/parcel-modification-requests/{requestId}` | Updates an existing parcel modification request |
| `POST` | `/api/v{version}/parcels` | Creates a parcel |
| `POST` | `/api/v{version}/parcels/bulk` | Create multiple parcels in bulk |
| `DELETE` | `/api/v{version}/parcels/bulk` | Delete multiple parcels in bulk |
| `POST` | `/api/v{version}/parcels/bulk-exchange` | Create multiple exchange parcels in bulk |
| `POST` | `/api/v{version}/parcels/bulk-refund` | Create multiple refund parcels in bulk |
| `DELETE` | `/api/v{version}/parcels/bulk/by-tracking-number` | Delete multiple parcels by tracking numbers in bulk |
| `POST` | `/api/v{version}/parcels/exchange` | Creates an exchange for a parcel |
| `POST` | `/api/v{version}/parcels/export` | Export supplier parcels to CSV |
| `POST` | `/api/v{version}/parcels/import-parcels` | Imports parcels from an Excel file |
| `GET` | `/api/v{version}/parcels/import-parcels/template` | Download template for importing bulk parcels |
| `POST` | `/api/v{version}/parcels/labels/individual` | Generate individual parcel labels |
| `POST` | `/api/v{version}/parcels/labels/individual/pdf` | Generate individual parcel labels as PDF |
| `POST` | `/api/v{version}/parcels/labels/multiple` | Generate multiple parcel labels in one HTML file |
| `POST` | `/api/v{version}/parcels/labels/multiple/pdf` | Generate multiple parcel labels as a single PDF |
| `POST` | `/api/v{version}/parcels/refund` | Creates a parcel refund |
| `POST` | `/api/v{version}/parcels/search` | Get a list of parcels |
| `GET` | `/api/v{version}/parcels/search/global` | Top global search of supplier parcels |
| `GET` | `/api/v{version}/parcels/stats/workflow/{workflowId}/state/{stateId}` | Gets parcels stats per situation Id for a workflow for the current supplier |
| `GET` | `/api/v{version}/parcels/stats/{workflowId}` | Gets parcels stats per state for a workflow for the current tenant |
| `GET` | `/api/v{version}/parcels/{id}` | get parcel item by id |
| `DELETE` | `/api/v{version}/parcels/{id}` | Delete a parcel |
| `PATCH` | `/api/v{version}/parcels/{id}/amount` | Update an order's total amount |
| `PATCH` | `/api/v{version}/parcels/{id}/customer` | Update an parcel's customer infos |
| `PATCH` | `/api/v{version}/parcels/{id}/deliveryAddress` | Update an order's delivery address |
| `PATCH` | `/api/v{version}/parcels/{parcelId}/products` | Update products of an parcel |
| `PATCH` | `/api/v{version}/parcels/{parcelId}/state` | Updates parcel state |
| `GET` | `/api/v{version}/parcels/{parcelId}/state-history` | gets parcel state history |
| `POST` | `/api/v{version}/parcels/{parcelId}/state-history/{parcelStateHistoryId}/workflow/{workflowId}/situation-history` | Creates a parcel state situation history |
| `PATCH` | `/api/v{version}/parcels/{parcelId}/state/refund` | Updates parcel state for a refund |
| `GET` | `/api/v{version}/parcels/{trackingNumber}` | get parcel item by trackingNumber |
| `POST` | `/api/v{version}/pickup-bags` | Creates a pickup bag. |
| `POST` | `/api/v{version}/pickup-bags/labels/pdf` | Generate pickup bag label as PDF |
| `POST` | `/api/v{version}/pickup-bags/search` | Search all supplier's pickup bags |
| `PATCH` | `/api/v{version}/pickup-bags/{bagId}/add-parcel` | Add a parcel to a pickup bag |
| `PATCH` | `/api/v{version}/pickup-bags/{bagId}/remove-parcel` | Remove a parcel from a pickup bag |
| `GET` | `/api/v{version}/pickup-bags/{id}` | Get pickup bag item by id |
| `DELETE` | `/api/v{version}/pickup-bags/{id}` | Deletes an existing pickup bag |
| `GET` | `/api/v{version}/pickup-bags/{trackingNumber}` | Get pickup bag item by tracking number |
| `POST` | `/api/v{version}/pickup-bags/{trackingNumber}/parcels/search` | Search parcels of the given pickup bag tracking number |
| `POST` | `/api/v{version}/territories/search` | Gets a list of territories |
| `POST` | `/api/v{version}/workflows/search` | Gets a list of workflows |

---

### `POST /api/v{version}/orders/reports/search`

**operationId:** `SearchOrdersReportsEndpoint`

**tags:** `orders`

**summary:** Gets a list of Reports in orders module

**description:**
> Gets a list of Reports in orders module with pagination support.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchOrdersReportsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchOrdersReportsResponse` |


---

### `POST /api/v{version}/orders/reports/{reportId}/download`

**operationId:** `DownloadOrdersReportEndpoint`

**tags:** `orders`

**summary:** Download a report file by ID

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
| 200 | OK | `DownloadReportResponse` |


---

### `POST /api/v{version}/parcel-modification-requests`

**operationId:** `CreateParcelModificationRequestEndpoint`

**tags:** `orders`

**summary:** Creates a parcel modification request

**description:**
> Creates a parcel modification request. Permissions required: SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateParcelModificationRequestRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateParcelModificationRequestResponse` |


---

### `POST /api/v{version}/parcel-modification-requests/phone`

**operationId:** `ChangeParcelPhoneEndpoint`

**tags:** `orders`

**summary:** Change parcel phone (auto-applied modification request)

**description:**
> Creates an immediately validated phone modification request and applies Parcel.ChangePhone. Enforces modification-request preconditions and phone-change quota. Permissions required: SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `ChangeParcelPhoneRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ChangeParcelPhoneResponse` |


---

### `POST /api/v{version}/parcel-modification-requests/search`

**operationId:** `SearchSupplierParcelsModificationRequestsEndpoint`

**tags:** `orders`

**summary:** Search supplier's parcels' modification requests

**description:**
> Search supplier's parcels' modification requests. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchSupplierParcelsModificationRequestsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_ParcelModificationRequestResult` |


---

### `GET /api/v{version}/parcel-modification-requests/{id}`

**operationId:** `GetParcelModificationRequestEndpoint`

**tags:** `orders`

**summary:** get parcel modification request item by id

**description:**
> gets parcel modification request item by id.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ParcelModificationRequestResult` |


---

### `DELETE /api/v{version}/parcel-modification-requests/{id}`

**operationId:** `DeleteParcelModificationRequestEndpoint`

**tags:** `orders`

**summary:** Deletes an existing parcel modification request

**description:**
> Deletes an existing parcel modification request before it is validated. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeleteParcelModificationRequestResponse` |


---

### `POST /api/v{version}/parcel-modification-requests/{parcelId}`

**operationId:** `SearchParcelModificationRequestsEndpoint`

**tags:** `orders`

**summary:** Search parcels' modification requests

**description:**
> Search parcels' modification requests. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole, HubAdminRole, HubParcelsManagerRole, GlobalAdminRole, GlobalViewerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `parcelId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchParcelModificationRequestsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_ParcelModificationRequestResult` |


---

### `PATCH /api/v{version}/parcel-modification-requests/{requestId}`

**operationId:** `UpdateParcelModificationRequestEndpoint`

**tags:** `orders`

**summary:** Updates an existing parcel modification request

**description:**
> Updates an existing parcel modification request before it is validated. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `requestId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateParcelModificationRequestRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateParcelModificationRequestResponse` |


---

### `POST /api/v{version}/parcels`

**operationId:** `CreateParcelEndpoint`

**tags:** `orders`

**summary:** Creates a parcel

**description:**
> Creates a parcel with products. The `StockType` parameter indicates the type of stock and accepts 'local' or 'warehouse'. Defaults to 'local' if not specified. the 'DeliveryType' parameter indicates the type of delivery and accepts 'home' or 'pickup-point'. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateParcelRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateParcelResponse` |


---

### `POST /api/v{version}/parcels/bulk`

**operationId:** `CreateBulkParcelsEndpoint`

**tags:** `orders`

**summary:** Create multiple parcels in bulk

**description:**
> Creates up to 100 parcels in a single request. 
                Returns detailed success/failure information for each parcel.

                Response Status Codes:
                - 200 OK: All parcels created successfully
                - 207 Multi-Status: Partial success (some parcels created, some failed)
                - 400 Bad Request: All parcels failed validation or creation

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateBulkParcelsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `CreateBulkParcelsResponse` |
| 207 | Multi-Status | `CreateBulkParcelsResponse` |
| 400 | Bad Request | `CreateBulkParcelsResponse` |


---

### `DELETE /api/v{version}/parcels/bulk`

**operationId:** `DeleteBulkParcelsEndpoint`

**tags:** `orders`

**summary:** Delete multiple parcels in bulk

**description:**
> Deletes up to 200 parcels in a single request. 
            Returns detailed success/failure information for each parcel.
            
            Important notes:
            - ExchangeReturn parcels cannot be deleted
            - If a parcel has a ReturnParcel, it will also be deleted
            - If deleting a ReturnParcel, the OriginalParcel's IsExchanged flag will be reset

            Response Status Codes:
            - 200 OK: All parcels deleted successfully
            - 207 Multi-Status: Partial success (some parcels deleted, some failed)
            - 400 Bad Request: All parcels failed validation or deletion

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `DeleteBulkParcelsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeleteBulkParcelsResponse` |
| 207 | Multi-Status | `DeleteBulkParcelsResponse` |
| 400 | Bad Request | `DeleteBulkParcelsResponse` |


---

### `POST /api/v{version}/parcels/bulk-exchange`

**operationId:** `CreateBulkParcelExchangeEndpoint`

**tags:** `orders`

**summary:** Create multiple exchange parcels in bulk

**description:**
> Creates up to 100 exchange parcels in a single request. 
        Each exchange can optionally create a return parcel for the original item.

        Response Status Codes:
        - 200 OK: All parcels created successfully
        - 207 Multi-Status: Partial success (some parcels created, some failed)
        - 400 Bad Request: All parcels failed validation or creation

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateBulkParcelExchangeRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `CreateBulkParcelExchangeResponse` |
| 207 | Multi-Status | `CreateBulkParcelExchangeResponse` |
| 400 | Bad Request | `CreateBulkParcelExchangeResponse` |


---

### `POST /api/v{version}/parcels/bulk-refund`

**operationId:** `CreateBulkParcelRefundEndpoint`

**tags:** `orders`

**summary:** Create multiple refund parcels in bulk

**description:**
> Creates up to 100 refund parcels in a single request.
        The supplier balance is checked before creation to ensure sufficient funds.

        Response Status Codes:
        - 200 OK: All parcels created successfully
        - 207 Multi-Status: Partial success (some parcels created, some failed)
        - 400 Bad Request: All parcels failed validation or creation

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateBulkParcelRefundRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `CreateBulkParcelRefundResponse` |
| 207 | Multi-Status | `CreateBulkParcelRefundResponse` |
| 400 | Bad Request | `CreateBulkParcelRefundResponse` |


---

### `DELETE /api/v{version}/parcels/bulk/by-tracking-number`

**operationId:** `DeleteBulkParcelsByTrackingNumberEndpoint`

**tags:** `orders`

**summary:** Delete multiple parcels by tracking numbers in bulk

**description:**
> Deletes up to 200 parcels in a single request using tracking numbers. 
            Returns detailed success/failure information for each parcel.
            
            Important notes:
            - ExchangeReturn parcels cannot be deleted
            - If a parcel has a ReturnParcel, it will also be deleted
            - If deleting a ReturnParcel, the OriginalParcel's IsExchanged flag will be reset

            Response Status Codes:
            - 200 OK: All parcels deleted successfully
            - 207 Multi-Status: Partial success (some parcels deleted, some failed)
            - 400 Bad Request: All parcels failed validation or deletion

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `DeleteBulkParcelsByTrackingNumberRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeleteBulkParcelsByTrackingNumberResponse` |
| 207 | Multi-Status | `DeleteBulkParcelsByTrackingNumberResponse` |
| 400 | Bad Request | `DeleteBulkParcelsByTrackingNumberResponse` |


---

### `POST /api/v{version}/parcels/exchange`

**operationId:** `CreateParcelExchangeEndpoint`

**tags:** `orders`

**summary:** Creates an exchange for a parcel

**description:**
> Creates an exchange for a parcel with products. The `StockType` parameter indicates the type of stock and accepts 'local' or 'warehouse'. Defaults to 'local' if not specified. the 'DeliveryType' parameter indicates the type of delivery and accepts 'home' or 'pickup-point'. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateParcelExchangeRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateParcelExchangeResponse` |


---

### `POST /api/v{version}/parcels/export`

**operationId:** `ExportSupplierParcelsEndpoint`

**tags:** `orders`

**summary:** Export supplier parcels to CSV

**description:**
> Exports a list of supplier parcels with filtering support. Returns an export job ID. Permissions required : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `ExportSupplierParcelsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline string (uuid))` |


---

### `POST /api/v{version}/parcels/import-parcels`

**operationId:** `ImportParcelsEndpoint`

**tags:** `orders`

**summary:** Imports parcels from an Excel file

**description:**
> Imports parcels using an Excel file. Supports two formats: 1) multipart/form-data with 'file' field (recommended, more efficient), 2) JSON body with 'excelFileBase64' (legacy). Optionally provide a dictionary of columns and their matching propertyNames.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `multipart/form-data` → schema `ImportParcelsFormData`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ParcelImportResult` |
| 400 | Bad Request | `ProblemDetails` |


---

### `GET /api/v{version}/parcels/import-parcels/template`

**operationId:** `DownloadTemplateBulkParcelsEndpoint`

**tags:** `orders`

**summary:** Download template for importing bulk parcels

**description:**
> Returns an Excel template file for bulk importing parcels.

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

### `POST /api/v{version}/parcels/labels/individual`

**operationId:** `GenerateIndividualLabelsEndpoint`

**tags:** `orders`

**summary:** Generate individual parcel labels

**description:**
> Generates individual HTML files for each parcel label (max 100 parcels). Returns an array of tracking numbers with their file URLs and list of failed tracking numbers. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GenerateIndividualLabelsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GenerateIndividualLabelsResponse` |


---

### `POST /api/v{version}/parcels/labels/individual/pdf`

**operationId:** `GenerateIndividualLabelsPdfEndpoint`

**tags:** `orders`

**summary:** Generate individual parcel labels as PDF

**description:**
> Generates individual PDF files for each parcel label (max 100 parcels). Supports A4 format (4 labels per page) or A6 format (1 label per page). Returns an array of tracking numbers with their PDF file URLs and list of failed tracking numbers. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GenerateIndividualLabelsPdfRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GenerateIndividualLabelsPdfResponse` |


---

### `POST /api/v{version}/parcels/labels/multiple`

**operationId:** `GenerateMultipleLabelsEndpoint`

**tags:** `orders`

**summary:** Generate multiple parcel labels in one HTML file

**description:**
> Generates parcel labels for multiple parcels (max 250) in a single HTML file. Returns the file URL with SAS token and list of failed tracking numbers. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GenerateMultipleLabelsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GenerateMultipleLabelsResponse` |


---

### `POST /api/v{version}/parcels/labels/multiple/pdf`

**operationId:** `GenerateMultipleLabelsPdfEndpoint`

**tags:** `orders`

**summary:** Generate multiple parcel labels as a single PDF

**description:**
> Generates a single PDF file containing multiple parcel labels (max 250 parcels). Supports A4 format (4 labels per page) or A6 format (1 label per page). Returns the PDF file URL and list of failed tracking numbers. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GenerateMultipleLabelsPdfRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GenerateMultipleLabelsPdfResponse` |


---

### `POST /api/v{version}/parcels/refund`

**operationId:** `CreateParcelRefundEndpoint`

**tags:** `orders`

**summary:** Creates a parcel refund

**description:**
> Creates a parcel refund. the 'DeliveryType' parameter indicates the type of delivery and accepts 'home' or 'pickup-point'. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateParcelRefundRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateParcelRefundResponse` |


---

### `POST /api/v{version}/parcels/search`

**operationId:** `SearchSupplierParcelsEndpoint`

**tags:** `orders`

**summary:** Get a list of parcels

**description:**
> Get a list of parcels with pagination and filtering support. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchSupplierParcelsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchSupplierParcelResponse` |


---

### `GET /api/v{version}/parcels/search/global`

**operationId:** `SearchGlobalSupplierParcelsEndpointTop`

**tags:** `orders`

**summary:** Top global search of supplier parcels

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
| 200 | OK | `(inline array of SearchGlobalSupplierParcelResponse)` |


---

### `GET /api/v{version}/parcels/stats/workflow/{workflowId}/state/{stateId}`

**operationId:** `GetSupplierSituationParcelsStatsEndpoint`

**tags:** `orders`

**summary:** Gets parcels stats per situation Id for a workflow for the current supplier

**description:**
> Retrieves the number of parcels per situation  for the workflow identified by its id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `workflowId` | path | yes | `string (uuid)` |
| 3 | `stateId` | path | yes | `string (uuid)` |
| 4 | `parcelTypes` | query | no | `array of string` |
| 5 | `isReturn` | query | no | `boolean` |
| 6 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline array of SupplierSituationParcelsStatsResponseItem)` |


---

### `GET /api/v{version}/parcels/stats/{workflowId}`

**operationId:** `GetSupplierParcelsStatsEndpoint`

**tags:** `orders`

**summary:** Gets parcels stats per state for a workflow for the current tenant

**description:**
> Retrieves the number of parcels per state for the workflow identified by its id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `workflowId` | path | yes | `string (uuid)` |
| 3 | `parcelTypes` | query | no | `array of string` |
| 4 | `isReturn` | query | no | `boolean` |
| 5 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline array of SupplierParcelsStatsResponseItem)` |


---

### `GET /api/v{version}/parcels/{id}`

**operationId:** `GetParcelByIdSupplierEndpoint`

**tags:** `orders`

**summary:** get parcel item by id

**description:**
> gets parcel item by id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetSupplierParcelResponse` |


---

### `DELETE /api/v{version}/parcels/{id}`

**operationId:** `DeleteParcelEndpoint`

**tags:** `orders`

**summary:** Delete a parcel

**description:**
> Delete a parcel by ID. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeleteParcelRespone` |


---

### `PATCH /api/v{version}/parcels/{id}/amount`

**operationId:** `UpdateAmountEndpoint`

**tags:** `orders`

**summary:** Update an order's total amount

**description:**
> Update an order's total amount. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateAmountRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateAmountResponse` |


---

### `PATCH /api/v{version}/parcels/{id}/customer`

**operationId:** `UpdateCustomerEndpoint`

**tags:** `orders`

**summary:** Update an parcel's customer infos

**description:**
> Update an parcel's customer infos. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateCustomerRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateCustomerResponse` |


---

### `PATCH /api/v{version}/parcels/{id}/deliveryAddress`

**operationId:** `UpdateDeliveryAddressEndpoint`

**tags:** `orders`

**summary:** Update an order's delivery address

**description:**
> Update an order's delivery address. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateDeliveryAddressRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateDeliveryAddressResponse` |


---

### `PATCH /api/v{version}/parcels/{parcelId}/products`

**operationId:** `UpdateOrderedProductsEndpoint`

**tags:** `orders`

**summary:** Update products of an parcel

**description:**
> Update products of an parcel. The `StockType` parameter indicates the type of stock and accepts 'local' or 'warehouse'. Defaults to 'local' if not specified. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `parcelId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateOrderedProductsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 202 | Accepted | `UpdateOrderProductsResponse` |


---

### `PATCH /api/v{version}/parcels/{parcelId}/state`

**operationId:** `UpdateParcelStateEndpoint`

**tags:** `orders`

**summary:** Updates parcel state

**description:**
> Updates parcel state. Permissions requises : HubParcelsManagerRole, HubAdminRole, SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `parcelId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateParcelStateRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateParcelStateResponse` |


---

### `GET /api/v{version}/parcels/{parcelId}/state-history`

**operationId:** `GetParcelStateHistorySupplierEndpoint`

**tags:** `orders`

**summary:** gets parcel state history

**description:**
> gets parcel state history. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `parcelId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline array of ParcelStateHistoryDto)` |


---

### `POST /api/v{version}/parcels/{parcelId}/state-history/{parcelStateHistoryId}/workflow/{workflowId}/situation-history`

**operationId:** `CreateParcelStateSituationHistorySupplierEndpoint`

**tags:** `orders`

**summary:** Creates a parcel state situation history

**description:**
> Creates a parcel state situation history. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `parcelId` | path | yes | `string (uuid)` |
| 3 | `parcelStateHistoryId` | path | yes | `string (uuid)` |
| 4 | `workflowId` | path | yes | `string (uuid)` |
| 5 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateParcelStateSituationHistorySupplierRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateParcelStateSituationHistorySupplierResponse` |


---

### `PATCH /api/v{version}/parcels/{parcelId}/state/refund`

**operationId:** `UpdateParcelRefundStateEndpoint`

**tags:** `orders`

**summary:** Updates parcel state for a refund

**description:**
> Updates parcel state for a refund. Permissions requises : HubDeliveryPeopleSettlementMangerRole, HubAdminRole, HubParcelsSettlementMangerRole,SupplierAdminRole,SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `parcelId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateParcelRefundStateRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateParcelRefundStateResponse` |


---

### `GET /api/v{version}/parcels/{trackingNumber}`

**operationId:** `GetParcelByTrackingNumberSupplierEndpoint`

**tags:** `orders`

**summary:** get parcel item by trackingNumber

**description:**
> gets parcel item by id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `trackingNumber` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetSupplierParcelResponse` |


---

### `POST /api/v{version}/pickup-bags`

**operationId:** `CreatePickupBagEndpoint`

**tags:** `orders`

**summary:** Creates a pickup bag.

**description:**
> Creates a pickup bag. Permissions required: SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreatePickupBagRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreatePickupBagResponse` |


---

### `POST /api/v{version}/pickup-bags/labels/pdf`

**operationId:** `GeneratePickupBagLabelPdfEndpoint`

**tags:** `orders`

**summary:** Generate pickup bag label as PDF

**description:**
> Generates a PDF label for a specific pickup bag in A4 format. Returns the tracking number and the PDF file URL.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GeneratePickupBagLabelPdfRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GeneratePickupBagLabelPdfResponse` |


---

### `POST /api/v{version}/pickup-bags/search`

**operationId:** `SearchSupplierPickupBagsEndpoint`

**tags:** `orders`

**summary:** Search all supplier's pickup bags

**description:**
> Search all supplier's pickup bags. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchSupplierPickupBagsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SupplierPickupBagResult` |


---

### `PATCH /api/v{version}/pickup-bags/{bagId}/add-parcel`

**operationId:** `AddParcelsToPickupBagEndpoint`

**tags:** `orders`

**summary:** Add a parcel to a pickup bag

**description:**
> Add a parcel to an existing pickup bag.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `bagId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `AddParcelsToPickupBagRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `AddParcelsToPickupBagResponse` |


---

### `PATCH /api/v{version}/pickup-bags/{bagId}/remove-parcel`

**operationId:** `RemoveParcelFromPickupBagEndpoint`

**tags:** `orders`

**summary:** Remove a parcel from a pickup bag

**description:**
> Remove a parcel from an existing pickup bag.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `bagId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `RemoveParcelFromPickupBagRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `RemoveParcelsFromPickupBagResponse` |


---

### `GET /api/v{version}/pickup-bags/{id}`

**operationId:** `GetSupplierPickupBagByIdEndpoint`

**tags:** `orders`

**summary:** Get pickup bag item by id

**description:**
> Get pickup bag item by id. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `SupplierPickupBagResult` |


---

### `DELETE /api/v{version}/pickup-bags/{id}`

**operationId:** `DeletePickupBagEndpoint`

**tags:** `orders`

**summary:** Deletes an existing pickup bag

**description:**
> Deletes an existing pickup bag. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DeletePickupBagResponse` |


---

### `GET /api/v{version}/pickup-bags/{trackingNumber}`

**operationId:** `GetSupplierPickupBagByTrackingNumberEndpoint`

**tags:** `orders`

**summary:** Get pickup bag item by tracking number

**description:**
> Get pickup bag item by tracking number. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `trackingNumber` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `SupplierPickupBagResult` |


---

### `POST /api/v{version}/pickup-bags/{trackingNumber}/parcels/search`

**operationId:** `SearchSupplierPickupBagByTrackingNumberEndpoint`

**tags:** `orders`

**summary:** Search parcels of the given pickup bag tracking number

**description:**
> Search parcels of the given pickup bag tracking number.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `trackingNumber` | path | yes | `string` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchSupplierPickupBagByTrackingNumberRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_PickupBagParcelResponse` |


---

### `POST /api/v{version}/territories/search`

**operationId:** `SearchTerritoriesEndpoint`

**tags:** `orders`

**summary:** Gets a list of territories

**description:**
> Gets a list of territories with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchTerritoriesRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_TerritoryResponse` |


---

### `POST /api/v{version}/workflows/search`

**operationId:** `SearchWorkflowsEndpoint`

**tags:** `orders`

**summary:** Gets a list of workflows

**description:**
> Gets a list of workflows with pagination and filtering support

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchWorkflowsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_WorkflowResponse` |


---
