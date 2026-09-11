# ZR Express API — `catalog`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/catalog.json`

Endpoints in this domain: **17**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/catalog/reports/search` | Gets a list of product export reports |
| `POST` | `/api/v{version}/catalog/reports/{reportId}/download` | Download a product export report file by ID |
| `POST` | `/api/v{version}/categories/search` | Gets a list of categories |
| `POST` | `/api/v{version}/products` | Creates a product |
| `POST` | `/api/v{version}/products/export` | Export a list of products |
| `POST` | `/api/v{version}/products/import` | Imports products from an Excel file |
| `GET` | `/api/v{version}/products/import/template` | Download template for importing bulk catalog products |
| `PATCH` | `/api/v{version}/products/product/{productId}/local-stock` | Update local Stock |
| `POST` | `/api/v{version}/products/search` | Gets a list of products |
| `POST` | `/api/v{version}/products/{id}` | Get product details |
| `PUT` | `/api/v{version}/products/{id}` | Update a product |
| `DELETE` | `/api/v{version}/products/{id}` | Deletes a product |
| `PATCH` | `/api/v{version}/products/{id}/discount` | Update product's discount  |
| `PATCH` | `/api/v{version}/products/{id}/price` | Update product's price  |
| `POST` | `/api/v{version}/receipts/search` | Gets a list of receipts |
| `GET` | `/api/v{version}/receipts/{id}` | Get Receipt details |
| `POST` | `/api/v{version}/stock-movements/product/warehouse-stock/user` | Creates a Stock movement by user |

---

### `POST /api/v{version}/catalog/reports/search`

**operationId:** `SearchProductsReportsEndpoint`

**tags:** `catalog`

**summary:** Gets a list of product export reports

**description:**
> Gets a list of product export reports with pagination and filtering support. Permissions required: SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchProductsReportsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchProductsReportsResponse` |


---

### `POST /api/v{version}/catalog/reports/{reportId}/download`

**operationId:** `DownloadProductsReportEndpoint`

**tags:** `catalog`

**summary:** Download a product export report file by ID

**description:**
> Returns a SAS URL to download the product export report file by its ID. Permissions required: SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `reportId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `DownloadProductsReportResponse` |


---

### `POST /api/v{version}/categories/search`

**operationId:** `SearchCategoriesEndpoint`

**tags:** `catalog`

**summary:** Gets a list of categories

**description:**
> Gets a list of categories with pagination and filtering support. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchCategoriesRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_CategoryResponse` |


---

### `POST /api/v{version}/products`

**operationId:** `CreateProductEndpoint`

**tags:** `catalog`

**summary:** Creates a product

**description:**
> Creates a product. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateProductRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateProductResponse` |


---

### `POST /api/v{version}/products/export`

**operationId:** `ExportProductsEndpoint`

**tags:** `catalog`

**summary:** Export a list of products

**description:**
> Export a list of products to a CSV file. The export is processed asynchronously and returns a report ID. Permissions required: SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `ExportProductsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `(inline string (uuid))` |


---

### `POST /api/v{version}/products/import`

**operationId:** `ImportProductEndpoint`

**tags:** `catalog`

**summary:** Imports products from an Excel file

**description:**
> Imports products using an Excel file. Supports two formats: 1) multipart/form-data with 'file' field (recommended, more efficient), 2) JSON body with 'excelFileBase64' (legacy). Optionally provide a dictionary of columns and their matching propertyNames.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `multipart/form-data` → schema `ImportProductFormData`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `ProductImportResult` |
| 400 | Bad Request | `ProblemDetails` |


---

### `GET /api/v{version}/products/import/template`

**operationId:** `DownloadTemplateBulkCatalogProductsEndpoint`

**tags:** `catalog`

**summary:** Download template for importing bulk catalog products

**description:**
> Returns an Excel template file for bulk importing catalog products.

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

### `PATCH /api/v{version}/products/product/{productId}/local-stock`

**operationId:** `UpdateProductLocalStockEndpoint`

**tags:** `catalog`

**summary:** Update local Stock

**description:**
> Update local Stock.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `productId` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateProductLocalStockRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `UpdateProductLocalStockResponse` |


---

### `POST /api/v{version}/products/search`

**operationId:** `SearchSupplierProductsEndpoint`

**tags:** `catalog`

**summary:** Gets a list of products

**description:**
> Gets a list of products with pagination and filtering support. Permissions requises : SupplierAdminRole, SupplierParcelsManagerRole.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchProductsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchProductResponse` |


---

### `POST /api/v{version}/products/{id}`

**operationId:** `GetSupplierProductEndpoint`

**tags:** `catalog`

**summary:** Get product details

**description:**
> Get the details of a product by its ID. Permissions requises : tous les SupplierRoles.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `GetProductRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetProductResponse` |


---

### `PUT /api/v{version}/products/{id}`

**operationId:** `UpdateProductEndpoint`

**tags:** `catalog`

**summary:** Update a product

**description:**
> Update a product

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateProductRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateProductResponse` |


---

### `DELETE /api/v{version}/products/{id}`

**operationId:** `DeleteProductEndpoint`

**tags:** `catalog`

**summary:** Deletes a product

**description:**
> Deletes a product by id with its variants

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 204 | No Content | `DeleteProductResponse` |


---

### `PATCH /api/v{version}/products/{id}/discount`

**operationId:** `UpdateDiscountEndpoint`

**tags:** `catalog`

**summary:** Update product's discount 

**description:**
> Update the discount price of a product

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdateDiscountRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdateDiscountResponse` |


---

### `PATCH /api/v{version}/products/{id}/price`

**operationId:** `UpdatePriceEndpoint`

**tags:** `catalog`

**summary:** Update product's price 

**description:**
> Update the price of a product

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `UpdatePriceRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UpdatePriceResponse` |


---

### `POST /api/v{version}/receipts/search`

**operationId:** `SearchReceiptsEndpoint`

**tags:** `catalog`

**summary:** Gets a list of receipts

**description:**
> Gets a list of receipts with pagination and filtering support Required Permissions: GlobalRoles, SubContractorRoles, HubAdmin, HubStockManager, SupplierAdmin, or SupplierParcelsManager.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `SearchReceiptsRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `PagedList_SearchReceiptResponse` |


---

### `GET /api/v{version}/receipts/{id}`

**operationId:** `GetReceiptEndpoint`

**tags:** `catalog`

**summary:** Get Receipt details

**description:**
> Get the details of a Receipt by its ID. Required Permissions: GlobalRoles, SubContractorRoles, HubAdmin, HubStockManager, SupplierAdmin, or SupplierParcelsManager.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |
| 3 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `GetReceiptResponse` |


---

### `POST /api/v{version}/stock-movements/product/warehouse-stock/user`

**operationId:** `CreateProductStockMovementUserEndpoint`

**tags:** `catalog`

**summary:** Creates a Stock movement by user

**description:**
> Creates a stock movement by user with type parameters equal to waiting-reception.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `X-Tenant` | header | yes | Input your tenant Id to access this API — `string` |

**requestBody:**

- `application/json` → schema `CreateProductStockMovementUserRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 201 | Created | `CreateProductStockMovementUserResponse` |


---
