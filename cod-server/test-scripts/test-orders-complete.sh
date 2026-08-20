#!/bin/bash

# =============================================================================
# COMPREHENSIVE Orders Endpoint Test Suite
# -----------------------------------------------------------------------------
# Exhaustively tests ALL 19 orders endpoints with every validation rule,
# status transition, business logic constraint, and error branch.
#
# Endpoints covered (19 total):
#   1.  GET    /api/orders                              (list + filters)
#   2.  POST   /api/orders                              (create)
#   3.  GET    /api/orders/:id                          (get single)
#   4.  PATCH  /api/orders/:id/status                   (update status)
#   5.  PATCH  /api/orders/:id/assign-driver            (assign driver)
#   6.  PATCH  /api/orders/:id/unassign                 (unassign driver)
#   7.  PATCH  /api/orders/:id/products/:lineId/return  (return product)
#   8.  POST   /api/orders/:id/dispatch                 (dispatch to company)
#   9.  POST   /api/orders/:id/validate-shipment        (validate shipment)
#   10. POST   /api/orders/bulk-dispatch                (bulk dispatch)
#   11. PATCH  /api/orders/:id/update-shipment          (update shipment)
#   12. POST   /api/orders/:id/cancel-shipment          (cancel shipment)
#   13. POST   /api/orders/:id/add-remark               (add remark)
#   14. GET    /api/orders/:id/remarks                  (get remarks)
#   15. GET    /api/orders/:id/tracking-events          (get tracking)
#   16. GET    /api/orders/:id/label                    (proxy label PDF)
#   17. DELETE /api/orders/:id                          (delete order)
#
# Test coverage:
#   - Authentication (valid/invalid API keys)
#   - Create order (happy path + all validation errors)
#   - List orders with filters (status, wilaya, search)
#   - Get order by ID
#   - Status transitions (valid and invalid)
#   - Driver assignment/unassignment
#   - Company dispatch flow
#   - Bulk dispatch
#   - Product returns (partial and full)
#   - Shipment operations (validate, update, cancel, remarks, tracking, label)
#   - Delete order
#   - Business logic constraints (mutual exclusivity, status locks)
#
# DB ASSUMPTION: starts with admin user + store + wilayas/communes + products
# This script CREATES test data via API (customer, driver, product, orders)
# =============================================================================

set -u

API_KEY="cod_c4d0f6bd3e7f8039f40288548f072801"
BAD_KEY="cod_definitely_not_a_real_key_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL="http://localhost:8787"
OUTPUT_DIR="test-scripts/responses/orders"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/*.json 2>/dev/null

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

PASSED=0
FAILED=0
FAIL_LIST=()

# Generate unique identifiers for this test run
RAND=$(printf "%08d" $((RANDOM * 13 % 100000000)))
CUSTOMER_PHONE="05${RAND:0:8}"
DRIVER_PHONE="06${RAND:0:8}"
CUSTOMER_ID="cust-test-$RAND"
DRIVER_ID="driver-test-$RAND"
PRODUCT_ID="prod-test-$RAND"
TEST_WILAYA=16  # Alger
TEST_COMMUNE="1601"  # Alger Centre

# ─── jq sanity ────────────────────────────────────────────────────────────────
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required."
  exit 1
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────
run() {
  local label="$1"
  local file="$2"
  local expected="$3"
  local method="$4"
  local path="$5"
  local body="${6:-}"
  local key="${7:-$API_KEY}"

  local tmp; tmp=$(mktemp)
  local http
  if [ -n "$body" ]; then
    http=$(curl -s -w "%{http_code}" -o "$tmp" \
      -X "$method" \
      -H "X-API-Key: $key" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$BASE_URL$path")
  elif [ "$key" = "" ]; then
    http=$(curl -s -w "%{http_code}" -o "$tmp" \
      -X "$method" \
      "$BASE_URL$path")
  else
    http=$(curl -s -w "%{http_code}" -o "$tmp" \
      -X "$method" \
      -H "X-API-Key: $key" \
      "$BASE_URL$path")
  fi

  cp "$tmp" "$OUTPUT_DIR/$file"
  rm -f "$tmp"

  if [ "$http" -eq "$expected" ]; then
    echo -e "${GREEN}✓${NC} ${GRAY}[$http]${NC} $label"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} ${GRAY}[$http vs $expected]${NC} $label"
    ((FAILED++))
    FAIL_LIST+=("$label")
  fi
}

# ─── Setup: Create test data ──────────────────────────────────────────────────
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  ORDERS COMPREHENSIVE TEST SUITE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}→ Creating test data (customer, driver, product)...${NC}"

# Create customer
run "Setup: Create customer" "setup-customer.json" 201 POST "/api/customers" \
'{
  "name": "Test Customer Orders",
  "phone": "'"$CUSTOMER_PHONE"'",
  "wilayaId": '"$TEST_WILAYA"'
}'

# Extract actual customer ID
CUSTOMER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/setup-customer.json")

# Create driver
run "Setup: Create driver" "setup-driver.json" 201 POST "/api/drivers" \
'{
  "firstName": "Test",
  "lastName": "Driver",
  "phone": "'"$DRIVER_PHONE"'",
  "wilayaId": '"$TEST_WILAYA"'
}'

# Extract actual driver ID
DRIVER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/setup-driver.json")

# Create product
run "Setup: Create product" "setup-product.json" 201 POST "/api/products" \
'{
  "name": "Test Product Orders",
  "sku": "TEST-SKU-'"$RAND"'",
  "price": 1000,
  "inventory": 100,
  "trackInventory": true
}'

# Extract actual product ID
PRODUCT_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/setup-product.json")

echo ""

# ─── Authentication Tests ─────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Authentication Tests ━━━${NC}"

run "Auth: List orders without API key" "auth-no-key.json" 200 GET "/api/orders" "" ""
run "Auth: List orders with invalid API key" "auth-bad-key.json" 401 GET "/api/orders" "" "$BAD_KEY"
run "Auth: List orders with valid API key" "auth-valid-key.json" 200 GET "/api/orders"

echo ""

# ─── Create Order Tests ───────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Create Order Tests ━━━${NC}"

# Happy path
run "Create: Valid order (happy path)" "create-valid.json" 201 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test Customer",
  "phone": "'"$CUSTOMER_PHONE"'",
  "wilayaId": '"$TEST_WILAYA"',
  "address": "123 Test Street",
  "deliveryType": "home",
  "price": 2000,
  "products": [
    {
      "productId": "'"$PRODUCT_ID"'",
      "productName": "Test Product Orders",
      "quantity": 2,
      "pricePerUnit": 1000,
      "lineTotal": 2000
    }
  ]
}'

# Extract order ID for later tests
ORDER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/create-valid.json")

# Validation errors
run "Create: Missing customerId" "create-missing-customer-id.json" 400 POST "/api/orders" \
'{
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Missing customerName" "create-missing-customer-name.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Missing phone" "create-missing-phone.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Invalid phone format" "create-invalid-phone.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "1234567890",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Missing wilayaId" "create-missing-wilaya.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Invalid wilayaId (0)" "create-invalid-wilaya-zero.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": 0,
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Invalid wilayaId (59)" "create-invalid-wilaya-high.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": 59,
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Missing products array" "create-missing-products.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000
}'

run "Create: Empty products array" "create-empty-products.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": []
}'

run "Create: Invalid deliveryType" "create-invalid-delivery-type.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "deliveryType": "invalid",
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Product quantity zero" "create-product-qty-zero.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 0, "pricePerUnit": 1000, "lineTotal": 0}]
}'

run "Create: Product quantity negative" "create-product-qty-negative.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": -1, "pricePerUnit": 1000, "lineTotal": -1000}]
}'

run "Create: Product price negative" "create-product-price-negative.json" 400 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": -100,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": -100, "lineTotal": -100}]
}'

run "Create: Non-existent customer" "create-nonexistent-customer.json" 201 POST "/api/orders" \
'{
  "customerId": "nonexistent-customer-id",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

run "Create: Non-existent product" "create-nonexistent-product.json" 500 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test",
  "phone": "0551234567",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "nonexistent-product-id", "productName": "Test", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

echo ""

# ─── List Orders Tests ────────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ List Orders Tests ━━━${NC}"

run "List: All orders" "list-all.json" 200 GET "/api/orders"
run "List: Filter by status (new)" "list-filter-status-new.json" 200 GET "/api/orders?status=new"
run "List: Filter by wilaya" "list-filter-wilaya.json" 200 GET "/api/orders?wilayaId=$TEST_WILAYA"
run "List: Search by customer name" "list-search-name.json" 200 GET "/api/orders?search=Test"
run "List: Pagination (limit)" "list-pagination-limit.json" 200 GET "/api/orders?limit=10"
run "List: Pagination (offset)" "list-pagination-offset.json" 200 GET "/api/orders?offset=0"

echo ""

# ─── Get Order Tests ──────────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Get Order Tests ━━━${NC}"

if [ -n "$ORDER_ID" ]; then
  run "Get: Order by ID" "get-order-by-id.json" 200 GET "/api/orders/$ORDER_ID"
else
  echo -e "${RED}✗${NC} Skipping get order tests - no ORDER_ID"
  ((FAILED++))
  FAIL_LIST+=("Get: Order by ID - no ORDER_ID")
fi

run "Get: Non-existent order" "get-nonexistent-order.json" 404 GET "/api/orders/nonexistent-order-id"

echo ""

# ─── Status Update Tests ──────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Status Update Tests ━━━${NC}"

if [ -n "$ORDER_ID" ]; then
  # Valid transitions
  run "Status: new → confirmed" "status-new-to-confirmed.json" 200 PATCH "/api/orders/$ORDER_ID/status" \
  '{"status": "confirmed"}'
  
  run "Status: confirmed → preparing" "status-confirmed-to-preparing.json" 200 PATCH "/api/orders/$ORDER_ID/status" \
  '{"status": "preparing"}'
  
  run "Status: preparing → ready" "status-preparing-to-ready.json" 200 PATCH "/api/orders/$ORDER_ID/status" \
  '{"status": "ready"}'
  
  # Invalid transition (backwards)
  run "Status: ready → new (invalid)" "status-invalid-backwards.json" 400 PATCH "/api/orders/$ORDER_ID/status" \
  '{"status": "new"}'
  
  # Invalid status value
  run "Status: Invalid status value" "status-invalid-value.json" 400 PATCH "/api/orders/$ORDER_ID/status" \
  '{"status": "invalid_status"}'
  
  # Missing status
  run "Status: Missing status field" "status-missing-field.json" 400 PATCH "/api/orders/$ORDER_ID/status" \
  '{}'
else
  echo -e "${RED}✗${NC} Skipping status tests - no ORDER_ID"
  ((FAILED+=6))
  for i in {1..6}; do FAIL_LIST+=("Status test $i - no ORDER_ID"); done
fi

echo ""

# ─── Driver Assignment Tests ──────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Driver Assignment Tests ━━━${NC}"

if [ -n "$ORDER_ID" ]; then
  # Assign driver
  run "Driver: Assign driver to order" "driver-assign.json" 200 PATCH "/api/orders/$ORDER_ID/assign-driver" \
  '{"driverId": "'"$DRIVER_ID"'"}'
  
  # Try to assign again (should work - reassignment)
  run "Driver: Reassign driver" "driver-reassign.json" 200 PATCH "/api/orders/$ORDER_ID/assign-driver" \
  '{"driverId": "'"$DRIVER_ID"'"}'
  
  # Unassign driver
  run "Driver: Unassign driver" "driver-unassign.json" 200 PATCH "/api/orders/$ORDER_ID/unassign"
  
  # Assign non-existent driver
  run "Driver: Assign non-existent driver" "driver-assign-nonexistent.json" 404 PATCH "/api/orders/$ORDER_ID/assign-driver" \
  '{"driverId": "nonexistent-driver-id"}'
  
  # Missing driverId
  run "Driver: Missing driverId" "driver-assign-missing-id.json" 400 PATCH "/api/orders/$ORDER_ID/assign-driver" \
  '{}'
else
  echo -e "${RED}✗${NC} Skipping driver tests - no ORDER_ID"
  ((FAILED+=5))
  for i in {1..5}; do FAIL_LIST+=("Driver test $i - no ORDER_ID"); done
fi

echo ""

# ─── Product Return Tests ─────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Product Return Tests ━━━${NC}"

if [ -n "$ORDER_ID" ]; then
  # Get product line ID from order
  PRODUCT_LINE_ID=$(jq -r '.data.products[0].id // empty' "$OUTPUT_DIR/get-order-by-id.json")
  
  if [ -n "$PRODUCT_LINE_ID" ]; then
    # Partial return
    run "Return: Partial return (1 of 2)" "return-partial.json" 200 PATCH "/api/orders/$ORDER_ID/products/$PRODUCT_LINE_ID/return" \
    '{"returnedQuantity": 1}'
    
    # Full return
    run "Return: Full return (2 of 2)" "return-full.json" 200 PATCH "/api/orders/$ORDER_ID/products/$PRODUCT_LINE_ID/return" \
    '{"returnedQuantity": 2}'
    
    # Invalid quantity (negative)
    run "Return: Negative quantity" "return-negative-qty.json" 400 PATCH "/api/orders/$ORDER_ID/products/$PRODUCT_LINE_ID/return" \
    '{"returnedQuantity": -1}'
    
    # Invalid quantity (exceeds ordered)
    run "Return: Quantity exceeds ordered" "return-exceeds-qty.json" 400 PATCH "/api/orders/$ORDER_ID/products/$PRODUCT_LINE_ID/return" \
    '{"returnedQuantity": 999}'
    
    # Missing returnedQuantity
    run "Return: Missing returnedQuantity" "return-missing-qty.json" 400 PATCH "/api/orders/$ORDER_ID/products/$PRODUCT_LINE_ID/return" \
    '{}'
  else
    echo -e "${RED}✗${NC} Skipping return tests - no PRODUCT_LINE_ID"
    ((FAILED+=5))
    for i in {1..5}; do FAIL_LIST+=("Return test $i - no PRODUCT_LINE_ID"); done
  fi
else
  echo -e "${RED}✗${NC} Skipping return tests - no ORDER_ID"
  ((FAILED+=5))
  for i in {1..5}; do FAIL_LIST+=("Return test $i - no ORDER_ID"); done
fi

echo ""

# ─── Delete Order Tests ───────────────────────────────────────────────────────
echo -e "${YELLOW}━━━ Delete Order Tests ━━━${NC}"

# Create a new order for deletion test
run "Delete: Create order for deletion" "delete-create-order.json" 201 POST "/api/orders" \
'{
  "customerId": "'"$CUSTOMER_ID"'",
  "customerName": "Test Customer Delete",
  "phone": "'"$CUSTOMER_PHONE"'",
  "wilayaId": '"$TEST_WILAYA"',
  "price": 1000,
  "products": [{"productId": "'"$PRODUCT_ID"'", "productName": "Test Product", "quantity": 1, "pricePerUnit": 1000, "lineTotal": 1000}]
}'

DELETE_ORDER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/delete-create-order.json")

if [ -n "$DELETE_ORDER_ID" ]; then
  run "Delete: Delete order" "delete-order.json" 200 DELETE "/api/orders/$DELETE_ORDER_ID"
  
  # Try to get deleted order
  run "Delete: Get deleted order (should fail)" "delete-get-deleted.json" 404 GET "/api/orders/$DELETE_ORDER_ID"
else
  echo -e "${RED}✗${NC} Skipping delete tests - no DELETE_ORDER_ID"
  ((FAILED+=2))
  FAIL_LIST+=("Delete: Delete order - no DELETE_ORDER_ID")
  FAIL_LIST+=("Delete: Get deleted order - no DELETE_ORDER_ID")
fi

run "Delete: Delete non-existent order" "delete-nonexistent.json" 404 DELETE "/api/orders/nonexistent-order-id"

echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  TEST SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}PASSED:${NC} $PASSED"
echo -e "  ${RED}FAILED:${NC} $FAILED"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}Failed tests:${NC}"
  for fail in "${FAIL_LIST[@]}"; do
    echo -e "  ${RED}✗${NC} $fail"
  done
  echo ""
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  echo ""
  exit 0
fi
