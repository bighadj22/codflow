# API Endpoint Testing Guide

This guide documents the comprehensive testing methodology used for testing API endpoints in the COD e-commerce system.

## Overview

We follow a systematic approach to ensure 100% accuracy between OpenAPI documentation and actual API behavior. This process includes querying the database for real test data, creating comprehensive test scripts, and verifying all response formats.

## Testing Methodology

### Step 1: Query Database for Test Data

Before creating tests, query the local database to get real IDs and data for testing.

**Example queries:**

```sql
-- Get existing customer IDs
SELECT id, name, phone FROM customers LIMIT 5;

-- Get customer group IDs
SELECT id, name FROM customer_groups LIMIT 3;

-- Get customer tag IDs
SELECT id, name FROM customer_tags LIMIT 3;

-- Get orders for a specific customer
SELECT id, tracking_number FROM orders WHERE customer_id = 'cust_001';

-- Get products
SELECT id, name FROM products LIMIT 5;

-- Get delivery companies
SELECT id, name FROM delivery_companies LIMIT 3;
```

**Why this matters:**
- Tests use real data that exists in the database
- Avoids false negatives from non-existent IDs
- Tests relationships between entities (customers with orders, etc.)
- Validates actual business logic and constraints

### Step 2: Identify All Endpoints

Review the routes file to identify ALL endpoints for the resource.

**Example for customers:**
```typescript
// cod-server/src/endpoints/customers/routes.ts
router.get("/", listCustomers);           // GET /api/customers
router.post("/", createCustomer);         // POST /api/customers
router.get("/:id", getCustomer);          // GET /api/customers/:id
router.patch("/:id", updateCustomer);     // PATCH /api/customers/:id
router.delete("/:id", deleteCustomer);    // DELETE /api/customers/:id
router.get("/:id/orders", getCustomerOrders);   // GET /api/customers/:id/orders
router.get("/:id/groups", getCustomerGroups);   // GET /api/customers/:id/groups
router.get("/:id/tags", getCustomerTags);       // GET /api/customers/:id/tags
```

**Total: 8 endpoints to test**

### Step 3: Plan Test Cases

For each endpoint, plan test cases covering:

1. **Success scenarios** (200, 201)
   - Valid requests with all required fields
   - Valid requests with optional fields
   - Edge cases (empty results, pagination, filters)

2. **Validation errors** (400)
   - Missing required fields
   - Invalid field formats
   - Invalid data types

3. **Authentication errors** (401)
   - Missing API key
   - Invalid API key

4. **Authorization errors** (403)
   - Missing required scopes

5. **Business logic errors** (404, 409, 422)
   - Resource not found
   - Duplicate resources (unique constraints)
   - Business rule violations (e.g., can't delete customer with orders)

**Example test plan for customers:**

| Endpoint | Method | Test Cases |
|----------|--------|------------|
| `/api/customers` | GET | List all, search filter, wilayaId filter, pagination, groupId filter, tagId filter, no auth |
| `/api/customers` | POST | Valid, missing name, invalid phone, duplicate phone, all optional fields, invalid auth |
| `/api/customers/:id` | GET | Existing, newly created, invalid UUID, not found |
| `/api/customers/:id` | PATCH | Update name, update address, invalid phone, duplicate phone, not found |
| `/api/customers/:id` | DELETE | Success, not found, has orders (422) |
| `/api/customers/:id/orders` | GET | With orders, empty, not found |
| `/api/customers/:id/groups` | GET | With groups, empty, not found |
| `/api/customers/:id/tags` | GET | With tags, empty, not found |

**Total: 34 test cases**

### Step 4: Create Test Script

Create a bash script that:
- Uses real database IDs from Step 1
- Tests ALL endpoints
- Saves all responses to JSON files
- Uses color-coded output for readability

**Script structure:**

```bash
#!/bin/bash

# Configuration
API_KEY="cod_c4d0f6bd3e7f8039f40288548f072801"
BASE_URL="http://localhost:8787"
OUTPUT_DIR="test-scripts/responses/[resource-name]"

# Real database IDs (from Step 1)
EXISTING_RESOURCE_ID="..."
RELATED_RESOURCE_ID="..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Test each endpoint with all scenarios
# Save responses to numbered files: 01-*, 02-*, etc.
```

**File naming convention:**
- `01-list-[resource].json` - List endpoint
- `02-create-[resource]-valid.json` - Create success
- `02-create-[resource]-missing-field.json` - Create validation error
- `03-get-[resource]-valid.json` - Get success
- `03-get-[resource]-not-found.json` - Get 404 error
- etc.

**Example:** `cod-server/test-scripts/test-customers-complete.sh`

### Step 5: Run Tests and Save Responses

```bash
# Make script executable
chmod +x test-scripts/test-[resource]-complete.sh

# Run the test script
./test-scripts/test-[resource]-complete.sh
```

**Output:**
- All responses saved to `test-scripts/responses/[resource]/*.json`
- Console shows color-coded progress
- Can inspect each response file individually

### Step 6: Verify Response Formats

Review each response file and verify:

1. **Success responses match expected format:**
   ```json
   {
     "success": true,
     "data": { ... },
     "message": "..." // for create/update/delete
   }
   ```

2. **Validation errors (400) use standardized format:**
   ```json
   {
     "error": "Validation failed",
     "code": "VALIDATION_FAILED",
     "category": "VALIDATION",
     "context": {
       "fields": [
         {
           "path": "fieldName",
           "message": "Error message",
           "code": "error_code"
         }
       ]
     }
   }
   ```

3. **Authentication errors (401) use simple format:**
   ```json
   {
     "error": "Missing API key"
   }
   ```
   or
   ```json
   {
     "error": "Invalid API key"
   }
   ```

4. **Business logic errors (404, 409, 422) use standardized format:**
   ```json
   {
     "error": "Descriptive error message",
     "code": "ERROR_CODE",
     "category": "BUSINESS_LOGIC",
     "context": {
       "entity": "ResourceName",
       "id": "...",
       // ... other relevant context
     }
   }
   ```

### Step 7: Update OpenAPI Documentation

Compare actual responses with OpenAPI documentation in:
`cod-server/src/endpoints/[resource]/openapi.ts`

**Update documentation to match reality:**

1. **Success responses** - Verify all properties are documented
2. **Error responses** - Use actual error format, not generic schemas
3. **Status codes** - Ensure all possible status codes are documented
4. **Examples** - Use realistic examples from actual responses

**Key changes for accuracy:**

```typescript
// ❌ BEFORE (generic, inaccurate)
"401": { 
  description: "Unauthorized", 
  content: json(errorSchema) 
}

// ✅ AFTER (specific, accurate)
"401": { 
  description: "Missing or invalid API key", 
  content: json({
    type: "object",
    properties: {
      error: { type: "string", example: "Missing API key" },
    },
  }),
}
```

```typescript
// ❌ BEFORE (generic schema reference)
"400": { 
  description: "Validation error", 
  content: json(validationErrorSchema) 
}

// ✅ AFTER (full standardized format)
"400": { 
  description: "Validation error (invalid phone format, missing required fields)", 
  content: json({
    type: "object",
    properties: {
      error: { type: "string", example: "Validation failed" },
      code: { type: "string", example: "VALIDATION_FAILED" },
      category: { type: "string", example: "VALIDATION" },
      context: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string", example: "phone" },
                message: { type: "string", example: "Invalid Algerian phone number" },
                code: { type: "string", example: "invalid_format" },
              },
            },
          },
        },
      },
    },
    example: {
      error: "Validation failed",
      code: "VALIDATION_FAILED",
      category: "VALIDATION",
      context: {
        fields: [
          {
            path: "phone",
            message: "Invalid Algerian phone number",
            code: "invalid_format",
          },
        ],
      },
    },
  }),
}
```

### Step 8: Create Test Summary Document

Create a comprehensive summary document that shows:
- All endpoints tested
- All test cases and their results
- Response format verification
- OpenAPI documentation accuracy verification

**Example:** `cod-server/test-scripts/CUSTOMERS_TEST_SUMMARY.md`

**Document structure:**

```markdown
# [Resource] Endpoint - Complete Test Summary

## Overview
Brief description of what was tested

## Test Results: ✅ ALL TESTS PASS

### Endpoint Coverage
Table showing all endpoints and test counts

## Detailed Test Results
For each endpoint:
- List all test cases
- Show expected vs actual responses
- Mark OpenAPI match status

## Error Response Format Verification
Show examples of each error type

## OpenAPI Documentation Accuracy
Verify 100% accuracy

## Key Findings
Strengths and notes

## Conclusion
Summary of results
```

## Checklist for Testing New Endpoints

Use this checklist when testing a new endpoint:

- [ ] **Step 1:** Query database for real test data
  - [ ] Get existing resource IDs
  - [ ] Get related resource IDs (for filters, relationships)
  - [ ] Document IDs in test script

- [ ] **Step 2:** Identify all endpoints
  - [ ] Review routes file
  - [ ] List all HTTP methods and paths
  - [ ] Count total endpoints

- [ ] **Step 3:** Plan test cases
  - [ ] Success scenarios (200, 201)
  - [ ] Validation errors (400)
  - [ ] Authentication errors (401)
  - [ ] Authorization errors (403)
  - [ ] Business logic errors (404, 409, 422)
  - [ ] Count total test cases

- [ ] **Step 4:** Create test script
  - [ ] Use real database IDs
  - [ ] Test ALL endpoints
  - [ ] Save responses with clear naming
  - [ ] Add color-coded output

- [ ] **Step 5:** Run tests
  - [ ] Make script executable
  - [ ] Run and verify all tests complete
  - [ ] Check all response files created

- [ ] **Step 6:** Verify response formats
  - [ ] Success responses match format
  - [ ] Validation errors use standardized format
  - [ ] Authentication errors use simple format
  - [ ] Business logic errors use standardized format

- [ ] **Step 7:** Update OpenAPI documentation
  - [ ] Compare responses with docs
  - [ ] Update error response formats
  - [ ] Add missing status codes
  - [ ] Use realistic examples

- [ ] **Step 8:** Create test summary
  - [ ] Document all test results
  - [ ] Verify OpenAPI accuracy
  - [ ] List key findings
  - [ ] Mark completion status

## Example: Customers Endpoint Testing

**Files created:**
- `test-scripts/test-customers-complete.sh` - Test script with 34 tests
- `test-scripts/responses/customers/*.json` - 34 response files
- `test-scripts/CUSTOMERS_TEST_SUMMARY.md` - Complete verification report
- `src/endpoints/customers/openapi.ts` - Updated documentation

**Results:**
- ✅ All 34 tests pass
- ✅ OpenAPI documentation 100% accurate
- ✅ All error formats standardized
- ✅ All 8 endpoints tested comprehensively

## Common Patterns

### Database Query Patterns

```sql
-- Get resource IDs
SELECT id, name FROM [table] LIMIT 5;

-- Get resources with relationships
SELECT c.id, c.name, COUNT(o.id) as order_count 
FROM customers c 
LEFT JOIN orders o ON c.id = o.customer_id 
GROUP BY c.id;

-- Get junction table data
SELECT customer_id, group_id 
FROM customer_group_members 
LIMIT 5;
```

### Test Script Patterns

```bash
# List endpoint with filters
curl -s -X GET "$BASE_URL/api/[resource]?filter=value" \
  -H "X-API-Key: $API_KEY" \
  > "$OUTPUT_DIR/01-list-[resource]-filter.json"

# Create endpoint
curl -s -X POST "$BASE_URL/api/[resource]" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "field": "value" }' \
  > "$OUTPUT_DIR/02-create-[resource]-valid.json"

# Get endpoint
curl -s -X GET "$BASE_URL/api/[resource]/$ID" \
  -H "X-API-Key: $API_KEY" \
  > "$OUTPUT_DIR/03-get-[resource]-valid.json"

# Update endpoint
curl -s -X PATCH "$BASE_URL/api/[resource]/$ID" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "field": "new value" }' \
  > "$OUTPUT_DIR/04-update-[resource]-valid.json"

# Delete endpoint
curl -s -X DELETE "$BASE_URL/api/[resource]/$ID" \
  -H "X-API-Key: $API_KEY" \
  > "$OUTPUT_DIR/05-delete-[resource]-success.json"
```

### Error Testing Patterns

```bash
# Missing required field (400)
curl -s -X POST "$BASE_URL/api/[resource]" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "incomplete": "data" }' \
  > "$OUTPUT_DIR/02-create-[resource]-missing-field.json"

# Invalid format (400)
curl -s -X POST "$BASE_URL/api/[resource]" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "field": "invalid-format" }' \
  > "$OUTPUT_DIR/02-create-[resource]-invalid-format.json"

# Missing auth (401)
curl -s -X GET "$BASE_URL/api/[resource]" \
  > "$OUTPUT_DIR/01-list-[resource]-no-auth.json"

# Invalid auth (401)
curl -s -X GET "$BASE_URL/api/[resource]" \
  -H "X-API-Key: invalid_key" \
  > "$OUTPUT_DIR/01-list-[resource]-invalid-auth.json"

# Not found (404)
curl -s -X GET "$BASE_URL/api/[resource]/00000000-0000-0000-0000-000000000000" \
  -H "X-API-Key: $API_KEY" \
  > "$OUTPUT_DIR/03-get-[resource]-not-found.json"

# Duplicate (409)
curl -s -X POST "$BASE_URL/api/[resource]" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "unique_field": "existing-value" }' \
  > "$OUTPUT_DIR/02-create-[resource]-duplicate.json"

# Business rule violation (422)
curl -s -X DELETE "$BASE_URL/api/[resource]/$ID_WITH_DEPENDENCIES" \
  -H "X-API-Key: $API_KEY" \
  > "$OUTPUT_DIR/05-delete-[resource]-has-dependencies.json"
```

## Tips for Success

1. **Always query the database first** - Real data prevents false test failures
2. **Test ALL endpoints** - Don't skip any routes
3. **Test ALL scenarios** - Success, validation, auth, business logic
4. **Save ALL responses** - You'll need them for verification
5. **Use clear file naming** - Makes it easy to find specific tests
6. **Update docs to match reality** - Don't force reality to match docs
7. **Document everything** - Future you will thank present you
8. **Verify error formats** - Consistency is key for API consumers

## Next Endpoints to Test

Suggested order based on dependencies:

1. ✅ **Customers** - Complete (34 tests, 8 endpoints)
2. **Products** - Core resource
3. **Orders** - Depends on customers and products
4. **Customer Groups** - Depends on customers
5. **Customer Tags** - Depends on customers
6. **Delivery Companies** - Independent resource
7. **Drivers** - Depends on delivery companies
8. **Offers** - Depends on products
9. **Reviews** - Depends on products and customers
10. **Wilayas/Communes** - Reference data

## Resources

- Test scripts: `cod-server/test-scripts/`
- Response files: `cod-server/test-scripts/responses/`
- OpenAPI docs: `cod-server/src/endpoints/[resource]/openapi.ts`
- Route definitions: `cod-server/src/endpoints/[resource]/routes.ts`
- Handlers: `cod-server/src/endpoints/[resource]/handlers.ts`

---

**Last Updated:** April 6, 2026  
**Status:** Customers endpoint complete, ready for next endpoint
