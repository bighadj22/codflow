# ZR Express API — `users`

> Do not alter. Machine-generated verbatim from `swagger.json`. Re-run the generator to refresh.

Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`
Full request/response shapes: `../schemas/users.json`

Endpoints in this domain: **4**

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/v{version}/users/keys` | Generate API Key |
| `POST` | `/api/v{version}/users/keys/search` | Search user tokens with advanced filtering |
| `DELETE` | `/api/v{version}/users/keys/{id}` | Delete API Key |
| `GET` | `/api/v{version}/users/profile` | Get current user information based on token |

---

### `POST /api/v{version}/users/keys`

**operationId:** `GenerateUserKeyEndpoint`

**tags:** `users`

**summary:** Generate API Key

**description:**
> Generates a secure API key for user authentication.\n
                        Supported expiration values : 7, 30, 90, 180, 365 days.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |

**requestBody:**

- `application/json` → schema `CreateUserKeyRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | - |


---

### `POST /api/v{version}/users/keys/search`

**operationId:** `SearchUserKeysEndpoint`

**tags:** `users`

**summary:** Search user tokens with advanced filtering

**description:**
> Search user tokens with pagination support.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |

**requestBody:**

- `application/json` → schema `SearchUserKeysRequest`
- **required**

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | - |


---

### `DELETE /api/v{version}/users/keys/{id}`

**operationId:** `DeleteUserKeyEndpoint`

**tags:** `users`

**summary:** Delete API Key

**description:**
> Delete an API key for the users.

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |
| 2 | `id` | path | yes | `string (uuid)` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | - |


---

### `GET /api/v{version}/users/profile`

**operationId:** `GetMeEndpoint`

**tags:** `users`

**summary:** Get current user information based on token

**description:**
> Get current user information based on token

**parameters:**

| # | name | in | required | description / schema |
|---|------|----|----------|----------------------|
| 1 | `version` | path | yes | The requested API version — `string` — default=`1` |

**responses:**

| status | description | schema |
|--------|-------------|--------|
| 200 | OK | `UserDetail` |


---
