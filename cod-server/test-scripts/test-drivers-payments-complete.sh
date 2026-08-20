#!/bin/bash

# =============================================================================
# COMPREHENSIVE Drivers + Driver-Payments Endpoint Test
# -----------------------------------------------------------------------------
# Exhaustively exercises every endpoint related to the in-house delivery driver
# surface in cod-server: driver CRUD, per-wilaya compensations,
# driver-payments (list / pending / create + settlement), the full happy path
# settlement flow through a real order, AND every error branch the validators
# and handlers produce. Designed to catch silent regressions and validator drift.
#
# DB ASSUMPTION: starts empty-ish (only admin user + 1 store + wilayas/communes).
# This script CREATES everything it needs via the API itself (driver, product,
# customer, order) so it can run on a fresh local DB. Each run uses a uniquely
# generated phone number for the driver so repeated invocations don't collide
# on uniqueness constraints or leave stale pending cash from earlier runs.
#
# Endpoints covered:
#   DRIVERS
#     GET    /api/drivers                              (list + filters)
#     POST   /api/drivers                              (create)
#     GET    /api/drivers/:id                          (detail)
#     PATCH  /api/drivers/:id                          (update)
#     PATCH  /api/drivers/:id/status                   (status toggle)
#     DELETE /api/drivers/:id                          (delete, respects active-order guard)
#   COMPENSATIONS
#     GET    /api/drivers/:id/compensations            (returns all 58 rows, sparse)
#     PUT    /api/drivers/:id/compensations/:wilayaId  (upsert)
#     DELETE /api/drivers/:id/compensations/:wilayaId  (remove)
#   DRIVER-PAYMENTS
#     GET    /api/driver-payments/:driverId            (history)
#     GET    /api/driver-payments/:driverId/pending    (unsettled delivered)
#     POST   /api/driver-payments                      (settle + decrement pendingCash)
#   SUPPORTING FLOW (needed to reach driver-payment happy path)
#     POST   /api/products, POST /api/orders, PATCH status/assign-driver
#
# Auth:
#   Uses the admin user's API key from the local DB
#   (users.api_key = 'cod_c4d0f6bd3e7f8039f40288548f072801').
#
# Output:
#   Every response saved to test-scripts/responses/drivers-payments/.
#   Test summary printed at the end with a list of FAILED tests (= bugs).
# =============================================================================

set -u

API_KEY="cod_c4d0f6bd3e7f8039f40288548f072801"
BAD_KEY="cod_definitely_not_a_real_key_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL="http://localhost:8787"
OUTPUT_DIR="test-scripts/responses/drivers-payments"

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

# Randomize driver phone so repeat runs don't accumulate orphan state on the
# same (unique-ish) identity. Phone format: 0[5-7]XXXXXXXX — Algerian mobile.
RAND=$(printf "%08d" $((RANDOM * 13 % 100000000)))
DRIVER_PHONE="06${RAND:0:8}"
DRIVER_PHONE2="07${RAND:0:8}"
CUSTOMER_PHONE="05${RAND:0:8}"
CUSTOMER_ID="cust-test-$RAND"
TEST_WILAYA=16  # Alger — always exists in seed data
TEST_FEE=500    # DZD per delivery

# ─── jq sanity ────────────────────────────────────────────────────────────────
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required."
  exit 1
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────
# Run a curl + capture body and HTTP code separately, save body to a file,
# compare HTTP code to expectation, and print pass/fail.
#
#   run "label" file.json EXPECTED_CODE METHOD PATH [BODY] [API_KEY_OVERRIDE]
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
    http=$(curl -s -o "$tmp" -w "%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "X-API-Key: $key" \
      -H "Content-Type: application/json" \
      -d "$body")
  elif [ "$key" = "__none__" ]; then
    http=$(curl -s -o "$tmp" -w "%{http_code}" -X "$method" "$BASE_URL$path")
  else
    http=$(curl -s -o "$tmp" -w "%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "X-API-Key: $key")
  fi

  local raw; raw=$(cat "$tmp")
  rm -f "$tmp"
  if echo "$raw" | jq . >/dev/null 2>&1; then
    echo "$raw" | jq . > "$OUTPUT_DIR/$file"
  else
    printf '%s\n' "$raw" > "$OUTPUT_DIR/$file"
  fi

  if [ "$http" = "$expected" ]; then
    PASSED=$((PASSED+1))
    printf "${GREEN}✓${NC} %-50s ${GRAY}[%s]${NC}  %s\n" "$file" "$http" "$label"
  else
    FAILED=$((FAILED+1))
    FAIL_LIST+=("$file  expected=$expected got=$http  $label")
    printf "${RED}✗${NC} %-50s ${RED}[got %s, expected %s]${NC}  %s\n" "$file" "$http" "$expected" "$label"
  fi
}

# Record an assertion pass/fail separately from an HTTP-status run.
assert() {
  local label="$1"
  local ok="$2"  # "true" or "false"
  local detail="${3:-}"
  if [ "$ok" = "true" ]; then
    PASSED=$((PASSED+1))
    echo -e "  ${GREEN}✓${NC} $label"
  else
    FAILED=$((FAILED+1))
    FAIL_LIST+=("ASSERT  $label  $detail")
    echo -e "  ${RED}✗${NC} $label  ${RED}$detail${NC}"
  fi
}

body_of() { cat "$OUTPUT_DIR/$1"; }

header() {
  echo ""
  echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE} $1${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

# =============================================================================
header "Sanity: server reachable + randomized identities"
# =============================================================================
HEALTH=$(curl -s "$BASE_URL/health")
echo "  /health -> $HEALTH"
if [ "$HEALTH" != '{"status":"ok"}' ]; then
  echo -e "${RED}Server not healthy at $BASE_URL — abort.${NC}"
  exit 1
fi
echo -e "${CYAN}  driver phone:    $DRIVER_PHONE${NC}"
echo -e "${CYAN}  customer id:     $CUSTOMER_ID${NC}"
echo -e "${CYAN}  test wilaya id:  $TEST_WILAYA${NC}"

# =============================================================================
header "SECTION A — Authentication on /api/drivers"
# =============================================================================

run "list drivers: no key (401)" \
  a01_list_no_key.json 401 GET /api/drivers "" __none__

run "list drivers: bad key (401)" \
  a02_list_bad_key.json 401 GET /api/drivers "" "$BAD_KEY"

run "list drivers: good key (200)" \
  a03_list_good_key.json 200 GET /api/drivers

# =============================================================================
header "SECTION B — Drivers CRUD (happy + validation errors)"
# =============================================================================

# B01 create happy
CREATE_BODY=$(cat <<EOF
{
  "firstName": "TestFirst",
  "lastName":  "TestLast",
  "phone":     "$DRIVER_PHONE",
  "phone2":    "$DRIVER_PHONE2",
  "vehicleType": "motorcycle",
  "status":    "available",
  "notes":     "Created by test-drivers-payments-complete.sh"
}
EOF
)
run "create driver (201)" \
  b01_create.json 201 POST /api/drivers "$CREATE_BODY"

DRIVER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/b01_create.json")
if [ -z "$DRIVER_ID" ]; then
  echo -e "${RED}Could not capture DRIVER_ID — aborting${NC}"
  cat "$OUTPUT_DIR/b01_create.json"
  exit 1
fi
echo -e "${CYAN}  → DRIVER_ID=$DRIVER_ID${NC}"

# B02 create: bad phone (not Algerian)
run "create driver: bad phone (400)" \
  b02_bad_phone.json 400 POST /api/drivers \
  '{"firstName":"X","lastName":"Y","phone":"123"}'

# B03 create: missing required field
run "create driver: missing firstName (400)" \
  b03_missing_name.json 400 POST /api/drivers \
  "{\"lastName\":\"Y\",\"phone\":\"$DRIVER_PHONE\"}"

# B04 create: bad vehicleType enum
run "create driver: bad vehicleType (400)" \
  b04_bad_vehicle.json 400 POST /api/drivers \
  "{\"firstName\":\"X\",\"lastName\":\"Y\",\"phone\":\"$DRIVER_PHONE\",\"vehicleType\":\"airplane\"}"

# B05 create: bad status enum
run "create driver: bad status (400)" \
  b05_bad_status.json 400 POST /api/drivers \
  "{\"firstName\":\"X\",\"lastName\":\"Y\",\"phone\":\"$DRIVER_PHONE\",\"status\":\"MAYBE\"}"

# B06 create: empty name (.min(1))
run "create driver: empty firstName (400)" \
  b06_empty_name.json 400 POST /api/drivers \
  "{\"firstName\":\"\",\"lastName\":\"Y\",\"phone\":\"$DRIVER_PHONE\"}"

# B07 list happy
run "list drivers (200)" \
  b07_list.json 200 GET /api/drivers

# B08 list: search filter (should include our driver)
run "list drivers: search=TestFirst (200)" \
  b08_list_search.json 200 GET "/api/drivers?search=TestFirst"

SEARCH_HIT=$(jq --arg id "$DRIVER_ID" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/b08_list_search.json")
[ "$SEARCH_HIT" = "1" ] \
  && assert "search filter returns our driver" true \
  || assert "search filter returns our driver" false "expected 1 match, got $SEARCH_HIT"

# B09 list: status=available filter
run "list drivers: status=available (200)" \
  b09_list_status.json 200 GET "/api/drivers?status=available"

# B10 list: vehicleType filter
run "list drivers: vehicleType=motorcycle (200)" \
  b10_list_vehicle.json 200 GET "/api/drivers?vehicleType=motorcycle"

# B11 list: wilayaId filter — we haven't configured any compensation yet, so our
# driver should NOT appear here (it may or may not be empty depending on prior runs).
run "list drivers: wilayaId=$TEST_WILAYA (200)" \
  b11_list_wilaya_empty.json 200 GET "/api/drivers?wilayaId=$TEST_WILAYA"

PRE_COMP_HIT=$(jq --arg id "$DRIVER_ID" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/b11_list_wilaya_empty.json")
[ "$PRE_COMP_HIT" = "0" ] \
  && assert "wilayaId filter excludes uncovered driver" true \
  || assert "wilayaId filter excludes uncovered driver" false "driver appears despite no compensation row (got $PRE_COMP_HIT)"

# B12 list: wilayaId=0 (out of range)
run "list drivers: wilayaId=0 (400)" \
  b12_list_wilaya_bad_low.json 400 GET "/api/drivers?wilayaId=0"

# B13 list: wilayaId=59 (out of range)
run "list drivers: wilayaId=59 (400)" \
  b13_list_wilaya_bad_high.json 400 GET "/api/drivers?wilayaId=59"

# B14 list: limit > 100
run "list drivers: limit=200 (400)" \
  b14_list_bad_limit.json 400 GET "/api/drivers?limit=200"

# B15 list: offset negative
run "list drivers: offset=-1 (400)" \
  b15_list_bad_offset.json 400 GET "/api/drivers?offset=-1"

# B16 get detail happy
run "get driver (200)" \
  b16_get.json 200 GET /api/drivers/$DRIVER_ID

RECENT_CHECK=$(jq '.data.recentOrders // "missing"' "$OUTPUT_DIR/b16_get.json")
[ "$RECENT_CHECK" != "missing" ] \
  && assert "detail includes recentOrders array" true \
  || assert "detail includes recentOrders array" false "recentOrders key absent from detail payload"

# B17 get detail 404
run "get driver: nonexistent (404)" \
  b17_get_404.json 404 GET /api/drivers/does-not-exist-xyz

# B18 patch happy
run "patch driver name (200)" \
  b18_patch.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"firstName":"TestFirstUpdated","notes":"Updated by test"}'

UPDATED_NAME=$(jq -r '.data.firstName // empty' "$OUTPUT_DIR/b18_patch.json")
[ "$UPDATED_NAME" = "TestFirstUpdated" ] \
  && assert "patch returns updated firstName" true \
  || assert "patch returns updated firstName" false "got '$UPDATED_NAME'"

# B19 patch: bad phone
run "patch driver: bad phone (400)" \
  b19_patch_bad_phone.json 400 PATCH /api/drivers/$DRIVER_ID \
  '{"phone":"not-a-phone"}'

# B20 patch: nonexistent
run "patch driver: nonexistent (404)" \
  b20_patch_404.json 404 PATCH /api/drivers/does-not-exist \
  '{"firstName":"X"}'

# B21 status: busy
run "patch status busy (200)" \
  b21_status_busy.json 200 PATCH /api/drivers/$DRIVER_ID/status \
  '{"status":"busy"}'

# B22 status: back to available (needed downstream)
run "patch status available (200)" \
  b22_status_available.json 200 PATCH /api/drivers/$DRIVER_ID/status \
  '{"status":"available"}'

# B23 status: invalid enum
run "patch status: bad enum (400)" \
  b23_status_bad.json 400 PATCH /api/drivers/$DRIVER_ID/status \
  '{"status":"PARTY"}'

# B24 status: missing body key
run "patch status: missing status (400)" \
  b24_status_missing.json 400 PATCH /api/drivers/$DRIVER_ID/status '{}'

# B25 status: nonexistent
run "patch status: nonexistent (404)" \
  b25_status_404.json 404 PATCH /api/drivers/does-not-exist/status \
  '{"status":"available"}'

# =============================================================================
header "SECTION C — Compensations CRUD"
# =============================================================================

# C01 list: all 58 wilayas, all null
run "list compensations: all null (200)" \
  c01_list_empty.json 200 GET /api/drivers/$DRIVER_ID/compensations

TOTAL_WILAYAS=$(jq '.data | length' "$OUTPUT_DIR/c01_list_empty.json")
NULL_FEES=$(jq '[.data[] | select(.feePerDelivery == null)] | length' "$OUTPUT_DIR/c01_list_empty.json")
[ "$TOTAL_WILAYAS" = "58" ] \
  && assert "compensations returns all 58 rows" true \
  || assert "compensations returns all 58 rows" false "got $TOTAL_WILAYAS"
[ "$NULL_FEES" = "58" ] \
  && assert "all 58 fees initially null" true \
  || assert "all 58 fees initially null" false "got $NULL_FEES non-null rows"

# C02 PUT happy
run "upsert compensation W${TEST_WILAYA} fee=$TEST_FEE (200)" \
  c02_put.json 200 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  "{\"feePerDelivery\":$TEST_FEE}"

PUT_FEE=$(jq -r '.data.feePerDelivery // empty' "$OUTPUT_DIR/c02_put.json")
[ "$PUT_FEE" = "$TEST_FEE" ] \
  && assert "PUT returns saved fee" true \
  || assert "PUT returns saved fee" false "got '$PUT_FEE'"

# C03 list again — W16 now populated, others still null
run "list compensations after put (200)" \
  c03_list_after_put.json 200 GET /api/drivers/$DRIVER_ID/compensations

W16_FEE=$(jq --argjson w "$TEST_WILAYA" '.data[] | select(.wilayaId==$w) | .feePerDelivery' "$OUTPUT_DIR/c03_list_after_put.json")
[ "$W16_FEE" = "$TEST_FEE" ] \
  && assert "list overlay reflects W${TEST_WILAYA}=$TEST_FEE" true \
  || assert "list overlay reflects W${TEST_WILAYA}=$TEST_FEE" false "got $W16_FEE"

# C04 driver detail exposes compensationWilayaCount=1
run "driver detail now shows compensationWilayaCount=1" \
  c04_driver_with_comp.json 200 GET /api/drivers/$DRIVER_ID
COMP_COUNT=$(jq -r '.data.compensationWilayaCount // 0' "$OUTPUT_DIR/c04_driver_with_comp.json")
[ "$COMP_COUNT" = "1" ] \
  && assert "driver detail count = 1" true \
  || assert "driver detail count = 1" false "got $COMP_COUNT"

# C05 list drivers with wilayaId filter now includes our driver
run "list drivers: wilayaId=$TEST_WILAYA (200)" \
  c05_list_covers_wilaya.json 200 GET "/api/drivers?wilayaId=$TEST_WILAYA"
WILAYA_HIT=$(jq --arg id "$DRIVER_ID" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/c05_list_covers_wilaya.json")
[ "$WILAYA_HIT" = "1" ] \
  && assert "wilayaId filter now includes our driver" true \
  || assert "wilayaId filter now includes our driver" false "got $WILAYA_HIT"

# C06 PUT upsert idempotent — change the fee
run "upsert compensation W${TEST_WILAYA} fee=750 (update)" \
  c06_put_update.json 200 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  '{"feePerDelivery":750}'

UPSERT_FEE=$(jq -r '.data.feePerDelivery // empty' "$OUTPUT_DIR/c06_put_update.json")
[ "$UPSERT_FEE" = "750" ] \
  && assert "upsert updated existing row to 750" true \
  || assert "upsert updated existing row to 750" false "got $UPSERT_FEE"

# C07 PUT: negative fee
run "upsert: negative fee (400)" \
  c07_put_neg.json 400 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  '{"feePerDelivery":-1}'

# C08 PUT: wilayaId=0 (path param)
run "upsert: wilayaId=0 (400)" \
  c08_put_w0.json 400 PUT /api/drivers/$DRIVER_ID/compensations/0 \
  '{"feePerDelivery":100}'

# C09 PUT: wilayaId=59 (path param)
run "upsert: wilayaId=59 (400)" \
  c09_put_w59.json 400 PUT /api/drivers/$DRIVER_ID/compensations/59 \
  '{"feePerDelivery":100}'

# C10 PUT: wilayaId=abc (NaN)
run "upsert: wilayaId=abc (400)" \
  c10_put_wabc.json 400 PUT /api/drivers/$DRIVER_ID/compensations/abc \
  '{"feePerDelivery":100}'

# C11 PUT: nonexistent driver
run "upsert: nonexistent driver (404)" \
  c11_put_driver_404.json 404 PUT /api/drivers/no-such-driver/compensations/$TEST_WILAYA \
  '{"feePerDelivery":100}'

# C12 PUT: missing feePerDelivery
run "upsert: missing fee (400)" \
  c12_put_missing_fee.json 400 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  '{}'

# C13 Set fee back to TEST_FEE for downstream settlement test
run "upsert: reset W${TEST_WILAYA}=$TEST_FEE (200)" \
  c13_put_reset.json 200 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  "{\"feePerDelivery\":$TEST_FEE}"

# Add a SECOND compensation row so we can test delete + filter independence
# (wilaya 17 = Djelfa — another seeded wilaya)
run "upsert compensation W17 fee=400 (200)" \
  c14_put_second.json 200 PUT /api/drivers/$DRIVER_ID/compensations/17 \
  '{"feePerDelivery":400}'

# C15 DELETE the second row happy
run "delete compensation W17 (200)" \
  c15_delete.json 200 DELETE /api/drivers/$DRIVER_ID/compensations/17

# C16 DELETE same again — should 404 (row already gone)
run "delete compensation W17 again (404)" \
  c16_delete_again.json 404 DELETE /api/drivers/$DRIVER_ID/compensations/17

# C17 DELETE: nonexistent driver
run "delete compensation: nonexistent driver (404)" \
  c17_delete_driver_404.json 404 DELETE /api/drivers/no-such-driver/compensations/$TEST_WILAYA

# C18 DELETE: wilayaId=99
run "delete compensation: wilayaId=99 (400)" \
  c18_delete_w99.json 400 DELETE /api/drivers/$DRIVER_ID/compensations/99

# =============================================================================
header "SECTION D — /remit endpoint removed (regression guard)"
# =============================================================================
# Legacy /drivers/:id/remit was removed in favor of /driver-payments. This
# section asserts the route is gone so a future re-introduction would fail
# this test instead of silently creating a second path for cash flow.

run "remit route removed: returns 404 (not 200)" \
  d01_remit_gone.json 404 POST /api/drivers/$DRIVER_ID/remit \
  '{"amount":100}'

# =============================================================================
header "SECTION E — driver-payments: listing on empty driver"
# =============================================================================

# E01 history: no payments yet
run "list payments: empty (200)" \
  e01_payments_empty.json 200 GET /api/driver-payments/$DRIVER_ID
EMPTY_COUNT=$(jq '.data | length' "$OUTPUT_DIR/e01_payments_empty.json")
[ "$EMPTY_COUNT" = "0" ] \
  && assert "initial payment history is empty" true \
  || assert "initial payment history is empty" false "got $EMPTY_COUNT rows"

# E02 pending: no delivered orders yet
run "list pending orders: empty (200)" \
  e02_pending_empty.json 200 GET /api/driver-payments/$DRIVER_ID/pending
PENDING_EMPTY_COUNT=$(jq '.data | length' "$OUTPUT_DIR/e02_pending_empty.json")
[ "$PENDING_EMPTY_COUNT" = "0" ] \
  && assert "initial pending list is empty" true \
  || assert "initial pending list is empty" false "got $PENDING_EMPTY_COUNT rows"

# E03 payments POST: missing orderIds
run "create payment: missing orderIds (400)" \
  e03_post_missing_orders.json 400 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\"}"

# E04 payments POST: empty orderIds array
run "create payment: empty orderIds (400)" \
  e04_post_empty_orders.json 400 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\",\"orderIds\":[]}"

# E05 payments POST: invalid type
run "create payment: bad type (400)" \
  e05_post_bad_type.json 400 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"MONEY\",\"orderIds\":[\"x\"]}"

# E06 payments POST: missing driverId
run "create payment: missing driverId (400)" \
  e06_post_missing_driver.json 400 POST /api/driver-payments \
  '{"type":"cod_remittance","orderIds":["x"]}'

# E07 payments POST: orderIds don't belong to driver → 422 BusinessLogicError
run "create payment: foreign orderIds (422)" \
  e07_post_foreign_orders.json 422 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\",\"orderIds\":[\"order-does-not-exist\"]}"

# =============================================================================
header "SECTION F — Full settlement flow (create product → order → deliver → settle)"
# =============================================================================

# F01 create a dedicated product for the order
PRODUCT_SKU="DRV-PAY-TEST-$RAND"
PRODUCT_BODY=$(cat <<EOF
{
  "name": "DRIVER PAY TEST Product",
  "price": 2000,
  "type": "PHYSICAL",
  "hasVariants": false,
  "sku": "$PRODUCT_SKU",
  "inventory": 50,
  "lowStockThreshold": 5,
  "trackInventory": true,
  "status": "ACTIVE"
}
EOF
)
run "create test product (201)" \
  f01_product.json 201 POST /api/products "$PRODUCT_BODY"

PRODUCT_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/f01_product.json")
if [ -z "$PRODUCT_ID" ]; then
  echo -e "${RED}Could not capture PRODUCT_ID — aborting${NC}"
  cat "$OUTPUT_DIR/f01_product.json"
  exit 1
fi
echo -e "${CYAN}  → PRODUCT_ID=$PRODUCT_ID${NC}"

# F02 create an OFFLINE order for W16 (offline avoids shipping-profile dependency)
#     price=2000, deliveryFee=0 → codAmount=2000. Customer is auto-created.
ORDER_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 2000,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 2000,
    "lineTotal": 2000
  }]
}
EOF
)
run "create test order (201)" \
  f02_order.json 201 POST /api/orders "$ORDER_BODY"

ORDER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/f02_order.json")
if [ -z "$ORDER_ID" ]; then
  echo -e "${RED}Could not capture ORDER_ID — aborting${NC}"
  cat "$OUTPUT_DIR/f02_order.json"
  exit 1
fi
echo -e "${CYAN}  → ORDER_ID=$ORDER_ID${NC}"

# F03 new → confirmed
run "order status new→confirmed (200)" \
  f03_confirmed.json 200 PATCH /api/orders/$ORDER_ID/status \
  '{"status":"confirmed"}'

# F04 confirmed → preparing
run "order status confirmed→preparing (200)" \
  f04_preparing.json 200 PATCH /api/orders/$ORDER_ID/status \
  '{"status":"preparing"}'

# F05 preparing → ready
run "order status preparing→ready (200)" \
  f05_ready.json 200 PATCH /api/orders/$ORDER_ID/status \
  '{"status":"ready"}'

# F06 assign driver — picks up fee=TEST_FEE from compensation row, sets status=assigned
run "assign driver to order (200)" \
  f06_assign.json 200 PATCH /api/orders/$ORDER_ID/assign-driver \
  "{\"driverId\":\"$DRIVER_ID\"}"

# F07 verify order picked up driverFee + assigned status
run "get order after assign (200)" \
  f07_order_after_assign.json 200 GET /api/orders/$ORDER_ID

POST_ASSIGN_FEE=$(jq -r '.data.driverFee // empty' "$OUTPUT_DIR/f07_order_after_assign.json")
POST_ASSIGN_STATUS=$(jq -r '.data.status // empty' "$OUTPUT_DIR/f07_order_after_assign.json")
POST_ASSIGN_DRIVER=$(jq -r '.data.driverId // empty' "$OUTPUT_DIR/f07_order_after_assign.json")
[ "$POST_ASSIGN_FEE" = "$TEST_FEE" ] \
  && assert "order.driverFee resolved from compensation" true \
  || assert "order.driverFee resolved from compensation" false "expected $TEST_FEE got '$POST_ASSIGN_FEE'"
[ "$POST_ASSIGN_STATUS" = "assigned" ] \
  && assert "order.status == assigned after assign-driver" true \
  || assert "order.status == assigned after assign-driver" false "got '$POST_ASSIGN_STATUS'"
[ "$POST_ASSIGN_DRIVER" = "$DRIVER_ID" ] \
  && assert "order.driverId matches" true \
  || assert "order.driverId matches" false "got '$POST_ASSIGN_DRIVER'"

# F08 assigned → out_for_delivery
run "order status assigned→out_for_delivery (200)" \
  f08_out_for_delivery.json 200 PATCH /api/orders/$ORDER_ID/status \
  '{"status":"out_for_delivery"}'

# F09 out_for_delivery → delivered (triggers driver counters)
run "order status out_for_delivery→delivered (200)" \
  f09_delivered.json 200 PATCH /api/orders/$ORDER_ID/status \
  '{"status":"delivered"}'

# F10 verify driver counters — pendingCash += 2000, totalDelivered += 1, totalEarnings += TEST_FEE
run "driver snapshot after delivery (200)" \
  f10_driver_after_delivery.json 200 GET /api/drivers/$DRIVER_ID

DELIV_PENDING=$(jq -r '.data.pendingCash // 0' "$OUTPUT_DIR/f10_driver_after_delivery.json")
DELIV_TOTAL_DELIV=$(jq -r '.data.totalDelivered // 0' "$OUTPUT_DIR/f10_driver_after_delivery.json")
DELIV_EARN=$(jq -r '.data.totalEarnings // 0' "$OUTPUT_DIR/f10_driver_after_delivery.json")
echo -e "${CYAN}  pendingCash=$DELIV_PENDING (expect 2000)  totalDelivered=$DELIV_TOTAL_DELIV (expect 1)  totalEarnings=$DELIV_EARN (expect $TEST_FEE)${NC}"
[ "$DELIV_PENDING" = "2000" ] \
  && assert "pendingCash == 2000 after delivery" true \
  || assert "pendingCash == 2000 after delivery" false "got $DELIV_PENDING"
[ "$DELIV_TOTAL_DELIV" = "1" ] \
  && assert "totalDelivered == 1 after delivery" true \
  || assert "totalDelivered == 1 after delivery" false "got $DELIV_TOTAL_DELIV"
[ "$DELIV_EARN" = "$TEST_FEE" ] \
  && assert "totalEarnings == $TEST_FEE after delivery" true \
  || assert "totalEarnings == $TEST_FEE after delivery" false "got $DELIV_EARN"

# F11 pending now lists this order
run "pending list after delivery (200)" \
  f11_pending.json 200 GET /api/driver-payments/$DRIVER_ID/pending
PENDING_COUNT=$(jq '.data | length' "$OUTPUT_DIR/f11_pending.json")
PENDING_HAS_ORDER=$(jq --arg id "$ORDER_ID" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/f11_pending.json")
[ "$PENDING_COUNT" -ge 1 ] && [ "$PENDING_HAS_ORDER" = "1" ] \
  && assert "pending list contains our delivered order" true \
  || assert "pending list contains our delivered order" false "count=$PENDING_COUNT hasOrder=$PENDING_HAS_ORDER"

# F12 settle cod_remittance — amount should be 2000
run "create payment cod_remittance (201)" \
  f12_settle.json 201 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\",\"orderIds\":[\"$ORDER_ID\"],\"notes\":\"test settlement\"}"

PAY_AMOUNT=$(jq -r '.data.amount // 0' "$OUTPUT_DIR/f12_settle.json")
PAY_ORDERS=$(jq -r '.data.orderCount // 0' "$OUTPUT_DIR/f12_settle.json")
[ "$PAY_AMOUNT" = "2000" ] \
  && assert "settlement amount == 2000" true \
  || assert "settlement amount == 2000" false "got $PAY_AMOUNT"
[ "$PAY_ORDERS" = "1" ] \
  && assert "settlement orderCount == 1" true \
  || assert "settlement orderCount == 1" false "got $PAY_ORDERS"

# F13 driver counters after settlement: pendingCash=0, totalPaid=2000
run "driver snapshot after settlement (200)" \
  f13_driver_after_settle.json 200 GET /api/drivers/$DRIVER_ID
AFTER_PENDING=$(jq -r '.data.pendingCash // -1' "$OUTPUT_DIR/f13_driver_after_settle.json")
AFTER_PAID=$(jq -r '.data.totalPaid // -1' "$OUTPUT_DIR/f13_driver_after_settle.json")
echo -e "${CYAN}  pendingCash=$AFTER_PENDING (expect 0)  totalPaid=$AFTER_PAID (expect 2000)${NC}"
[ "$AFTER_PENDING" = "0" ] \
  && assert "pendingCash zeroed after settlement" true \
  || assert "pendingCash zeroed after settlement" false "got $AFTER_PENDING"
[ "$AFTER_PAID" = "2000" ] \
  && assert "totalPaid == 2000 after settlement" true \
  || assert "totalPaid == 2000 after settlement" false "got $AFTER_PAID"

# F14 pending list now empty (order settled)
run "pending list after settlement (200)" \
  f14_pending_after_settle.json 200 GET /api/driver-payments/$DRIVER_ID/pending
POST_PENDING_HAS=$(jq --arg id "$ORDER_ID" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/f14_pending_after_settle.json")
[ "$POST_PENDING_HAS" = "0" ] \
  && assert "settled order removed from pending list" true \
  || assert "settled order removed from pending list" false "still present in pending"

# F15 payment history has 1 row now
run "list payments after settle (200)" \
  f15_payments_after_settle.json 200 GET /api/driver-payments/$DRIVER_ID
HIST_COUNT=$(jq '.data | length' "$OUTPUT_DIR/f15_payments_after_settle.json")
[ "$HIST_COUNT" = "1" ] \
  && assert "payment history has 1 row" true \
  || assert "payment history has 1 row" false "got $HIST_COUNT"

# F16 double-settle same order → 422 (already settled for COD)
run "create payment: re-settle same order (422)" \
  f16_double_settle.json 422 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\",\"orderIds\":[\"$ORDER_ID\"]}"

# F17 fee_payment still available (not yet settled for fees)
run "create payment fee_payment (201)" \
  f17_fee_payment.json 201 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"fee_payment\",\"orderIds\":[\"$ORDER_ID\"]}"

FEE_PAY_AMOUNT=$(jq -r '.data.amount // 0' "$OUTPUT_DIR/f17_fee_payment.json")
[ "$FEE_PAY_AMOUNT" = "$TEST_FEE" ] \
  && assert "fee_payment amount == $TEST_FEE" true \
  || assert "fee_payment amount == $TEST_FEE" false "got $FEE_PAY_AMOUNT"

# F18 and now fee_payment is locked too → 422
run "create payment: re-settle fee (422)" \
  f18_double_fee.json 422 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"fee_payment\",\"orderIds\":[\"$ORDER_ID\"]}"

# =============================================================================
header "SECTION G — Delete driver"
# =============================================================================

# Delivered orders do NOT block deletion (only assigned/out_for_delivery block).
# We need a SECOND driver with an active order to verify the 409 path cleanly.

# G01 create a second driver
SECOND_PHONE="05${RAND:0:7}0"
SECOND_BODY=$(cat <<EOF
{
  "firstName": "SecondDriver",
  "lastName":  "ActiveOrderTest",
  "phone":     "$SECOND_PHONE",
  "status":    "available"
}
EOF
)
run "create second driver (201)" \
  g01_second_driver.json 201 POST /api/drivers "$SECOND_BODY"
SECOND_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/g01_second_driver.json")
echo -e "${CYAN}  → SECOND_ID=$SECOND_ID${NC}"

# G02 create a second order and move it up to "ready"
SECOND_ORDER_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 1000,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 1000,
    "lineTotal": 1000
  }]
}
EOF
)
run "create second order (201)" \
  g02_second_order.json 201 POST /api/orders "$SECOND_ORDER_BODY"
SECOND_ORDER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/g02_second_order.json")
echo -e "${CYAN}  → SECOND_ORDER_ID=$SECOND_ORDER_ID${NC}"

run "second: new→confirmed" g03_ord2_confirmed.json 200 PATCH /api/orders/$SECOND_ORDER_ID/status '{"status":"confirmed"}'
run "second: confirmed→preparing" g04_ord2_preparing.json 200 PATCH /api/orders/$SECOND_ORDER_ID/status '{"status":"preparing"}'
run "second: preparing→ready" g05_ord2_ready.json 200 PATCH /api/orders/$SECOND_ORDER_ID/status '{"status":"ready"}'
run "assign second driver to order (200)" g06_ord2_assign.json 200 PATCH /api/orders/$SECOND_ORDER_ID/assign-driver "{\"driverId\":\"$SECOND_ID\"}"

# G07 DELETE second driver while it has an "assigned" order → 409 ConflictError
run "delete second driver with active order (409)" \
  g07_delete_active.json 409 DELETE /api/drivers/$SECOND_ID

# G08 unassign, then delete
run "unassign second order (200)" \
  g08_unassign.json 200 PATCH /api/orders/$SECOND_ORDER_ID/unassign

# G09 delete second driver now succeeds
run "delete second driver now (200)" \
  g09_delete_ok.json 200 DELETE /api/drivers/$SECOND_ID

# G10 re-delete same driver → 404
run "delete second driver again (404)" \
  g10_delete_again.json 404 DELETE /api/drivers/$SECOND_ID

# =============================================================================
header "SECTION H — Final assertions: compensations after heavy activity"
# =============================================================================

# H01 compensation list still correct after order-flow noise
run "final compensations list (200)" \
  h01_final_comps.json 200 GET /api/drivers/$DRIVER_ID/compensations
FINAL_SET=$(jq --argjson w "$TEST_WILAYA" '.data[] | select(.wilayaId==$w) | .feePerDelivery' "$OUTPUT_DIR/h01_final_comps.json")
[ "$FINAL_SET" = "$TEST_FEE" ] \
  && assert "compensation W${TEST_WILAYA} still $TEST_FEE at end" true \
  || assert "compensation W${TEST_WILAYA} still $TEST_FEE at end" false "got $FINAL_SET"

# =============================================================================
header "SECTION I — net_settlement payment type (CRITICAL MISSING TEST)"
# =============================================================================

# I01 create order for net_settlement test
NET_ORDER_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 2000,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 2000,
    "lineTotal": 2000
  }]
}
EOF
)
run "create order for net_settlement (201)" \
  i01_net_order.json 201 POST /api/orders "$NET_ORDER_BODY"
NET_ORDER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/i01_net_order.json")
echo -e "${CYAN}  → NET_ORDER_ID=$NET_ORDER_ID${NC}"

# I02-I06: Move order through statuses
run "net order: new→confirmed" i02_net_confirmed.json 200 PATCH /api/orders/$NET_ORDER_ID/status '{"status":"confirmed"}'
run "net order: confirmed→preparing" i03_net_preparing.json 200 PATCH /api/orders/$NET_ORDER_ID/status '{"status":"preparing"}'
run "net order: preparing→ready" i04_net_ready.json 200 PATCH /api/orders/$NET_ORDER_ID/status '{"status":"ready"}'
run "assign driver to net order (200)" i05_net_assign.json 200 PATCH /api/orders/$NET_ORDER_ID/assign-driver "{\"driverId\":\"$DRIVER_ID\"}"
run "net order: assigned→out_for_delivery" i06_net_out.json 200 PATCH /api/orders/$NET_ORDER_ID/status '{"status":"out_for_delivery"}'
run "net order: out_for_delivery→delivered" i07_net_delivered.json 200 PATCH /api/orders/$NET_ORDER_ID/status '{"status":"delivered"}'

# I08 create net_settlement payment
run "create payment net_settlement (201)" \
  i08_net_settle.json 201 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"net_settlement\",\"orderIds\":[\"$NET_ORDER_ID\"],\"notes\":\"net settlement test\"}"

NET_AMOUNT=$(jq -r '.data.amount // 0' "$OUTPUT_DIR/i08_net_settle.json")
NET_EXPECTED=1500  # 2000 - 500
[ "$NET_AMOUNT" = "$NET_EXPECTED" ] \
  && assert "net_settlement amount = codAmount - driverFee (1500)" true \
  || assert "net_settlement amount = codAmount - driverFee (1500)" false "expected $NET_EXPECTED got $NET_AMOUNT"

# I09 verify order has both payment IDs set
run "get order after net_settlement (200)" \
  i09_net_order_after.json 200 GET /api/orders/$NET_ORDER_ID

COD_PAY_ID=$(jq -r '.data.codPaymentId // "null"' "$OUTPUT_DIR/i09_net_order_after.json")
FEE_PAY_ID=$(jq -r '.data.feePaymentId // "null"' "$OUTPUT_DIR/i09_net_order_after.json")
[ "$COD_PAY_ID" != "null" ] \
  && assert "order.codPaymentId set after net_settlement" true \
  || assert "order.codPaymentId set after net_settlement" false "codPaymentId is null"
[ "$FEE_PAY_ID" != "null" ] \
  && assert "order.feePaymentId set after net_settlement" true \
  || assert "order.feePaymentId set after net_settlement" false "feePaymentId is null"

# I10 try to re-settle with cod_remittance
run "create payment: re-settle net order with cod_remittance (422)" \
  i10_net_double_cod.json 422 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\",\"orderIds\":[\"$NET_ORDER_ID\"]}"

# I11 try to re-settle with fee_payment
run "create payment: re-settle net order with fee_payment (422)" \
  i11_net_double_fee.json 422 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"fee_payment\",\"orderIds\":[\"$NET_ORDER_ID\"]}"

# =============================================================================
header "SECTION J — Multi-order payment settlement (CRITICAL MISSING TEST)"
# =============================================================================

# J01-J03: Create 3 orders with different amounts
ORDER_J1_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 1500,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 1500,
    "lineTotal": 1500
  }]
}
EOF
)
run "create order J1 (201)" j01_order1.json 201 POST /api/orders "$ORDER_J1_BODY"
ORDER_J1=$(jq -r '.data.id // empty' "$OUTPUT_DIR/j01_order1.json")

ORDER_J2_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 2500,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 2500,
    "lineTotal": 2500
  }]
}
EOF
)
run "create order J2 (201)" j02_order2.json 201 POST /api/orders "$ORDER_J2_BODY"
ORDER_J2=$(jq -r '.data.id // empty' "$OUTPUT_DIR/j02_order2.json")

ORDER_J3_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 3000,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 3000,
    "lineTotal": 3000
  }]
}
EOF
)
run "create order J3 (201)" j03_order3.json 201 POST /api/orders "$ORDER_J3_BODY"
ORDER_J3=$(jq -r '.data.id // empty' "$OUTPUT_DIR/j03_order3.json")

echo -e "${CYAN}  → ORDER_J1=$ORDER_J1${NC}"
echo -e "${CYAN}  → ORDER_J2=$ORDER_J2${NC}"
echo -e "${CYAN}  → ORDER_J3=$ORDER_J3${NC}"

# J04-J18: Move all 3 orders through statuses and deliver
for i in 1 2 3; do
  eval "ORD=\$ORDER_J$i"
  run "order J$i: new→confirmed" j0$((3+i*3-2))_ord${i}_conf.json 200 PATCH /api/orders/$ORD/status '{"status":"confirmed"}'
  run "order J$i: confirmed→preparing" j0$((3+i*3-1))_ord${i}_prep.json 200 PATCH /api/orders/$ORD/status '{"status":"preparing"}'
  run "order J$i: preparing→ready" j0$((3+i*3))_ord${i}_ready.json 200 PATCH /api/orders/$ORD/status '{"status":"ready"}'
  run "assign driver to order J$i" j$((12+i))_ord${i}_assign.json 200 PATCH /api/orders/$ORD/assign-driver "{\"driverId\":\"$DRIVER_ID\"}"
  run "order J$i: assigned→out_for_delivery" j$((15+i))_ord${i}_out.json 200 PATCH /api/orders/$ORD/status '{"status":"out_for_delivery"}'
  run "order J$i: out_for_delivery→delivered" j$((18+i))_ord${i}_deliv.json 200 PATCH /api/orders/$ORD/status '{"status":"delivered"}'
done

# J22: Settle all 3 orders in one payment
run "create payment: settle 3 orders at once (201)" \
  j22_multi_settle.json 201 POST /api/driver-payments \
  "{\"driverId\":\"$DRIVER_ID\",\"type\":\"cod_remittance\",\"orderIds\":[\"$ORDER_J1\",\"$ORDER_J2\",\"$ORDER_J3\"]}"

MULTI_AMOUNT=$(jq -r '.data.amount // 0' "$OUTPUT_DIR/j22_multi_settle.json")
MULTI_COUNT=$(jq -r '.data.orderCount // 0' "$OUTPUT_DIR/j22_multi_settle.json")
MULTI_EXPECTED=7000  # 1500 + 2500 + 3000
[ "$MULTI_AMOUNT" = "$MULTI_EXPECTED" ] \
  && assert "multi-order settlement amount = 7000" true \
  || assert "multi-order settlement amount = 7000" false "expected $MULTI_EXPECTED got $MULTI_AMOUNT"
[ "$MULTI_COUNT" = "3" ] \
  && assert "multi-order settlement orderCount = 3" true \
  || assert "multi-order settlement orderCount = 3" false "expected 3 got $MULTI_COUNT"

# J23: Verify all 3 orders removed from pending
run "pending list after multi-settle (200)" \
  j23_pending_after_multi.json 200 GET /api/driver-payments/$DRIVER_ID/pending
J1_IN_PENDING=$(jq --arg id "$ORDER_J1" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/j23_pending_after_multi.json")
J2_IN_PENDING=$(jq --arg id "$ORDER_J2" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/j23_pending_after_multi.json")
J3_IN_PENDING=$(jq --arg id "$ORDER_J3" '[.data[] | select(.id==$id)] | length' "$OUTPUT_DIR/j23_pending_after_multi.json")
[ "$J1_IN_PENDING" = "0" ] && [ "$J2_IN_PENDING" = "0" ] && [ "$J3_IN_PENDING" = "0" ] \
  && assert "all 3 orders removed from pending list" true \
  || assert "all 3 orders removed from pending list" false "J1=$J1_IN_PENDING J2=$J2_IN_PENDING J3=$J3_IN_PENDING"

# =============================================================================
header "SECTION K — Duplicate phone validation (CRITICAL MISSING TEST)"
# =============================================================================

# K01: Try to create driver with existing phone
run "create driver: duplicate phone (409)" \
  k01_dup_phone.json 409 POST /api/drivers \
  "{\"firstName\":\"Duplicate\",\"lastName\":\"Driver\",\"phone\":\"$DRIVER_PHONE\"}"

# =============================================================================
header "SECTION L — Optional field updates (HIGH PRIORITY)"
# =============================================================================

# L01: Update phone2
run "update driver phone2 (200)" \
  l01_update_phone2.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"phone2":"0612345678"}'
UPDATED_PHONE2=$(jq -r '.data.phone2 // "null"' "$OUTPUT_DIR/l01_update_phone2.json")
[ "$UPDATED_PHONE2" = "0612345678" ] \
  && assert "phone2 updated to 0612345678" true \
  || assert "phone2 updated to 0612345678" false "got $UPDATED_PHONE2"

# L02: Clear phone2
run "clear driver phone2 (200)" \
  l02_clear_phone2.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"phone2":null}'
CLEARED_PHONE2=$(jq -r '.data.phone2 // "null"' "$OUTPUT_DIR/l02_clear_phone2.json")
[ "$CLEARED_PHONE2" = "null" ] \
  && assert "phone2 cleared to null" true \
  || assert "phone2 cleared to null" false "got $CLEARED_PHONE2"

# L03: Update phone2 with invalid format
run "update driver: invalid phone2 (400)" \
  l03_bad_phone2.json 400 PATCH /api/drivers/$DRIVER_ID \
  '{"phone2":"123"}'

# L04: Update vehicleType
run "update driver vehicleType (200)" \
  l04_update_vehicle.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"vehicleType":"car"}'
UPDATED_VEHICLE=$(jq -r '.data.vehicleType // "null"' "$OUTPUT_DIR/l04_update_vehicle.json")
[ "$UPDATED_VEHICLE" = "car" ] \
  && assert "vehicleType updated to car" true \
  || assert "vehicleType updated to car" false "got $UPDATED_VEHICLE"

# L05: Clear vehicleType
run "clear driver vehicleType (200)" \
  l05_clear_vehicle.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"vehicleType":null}'
CLEARED_VEHICLE=$(jq -r '.data.vehicleType // "null"' "$OUTPUT_DIR/l05_clear_vehicle.json")
[ "$CLEARED_VEHICLE" = "null" ] \
  && assert "vehicleType cleared to null" true \
  || assert "vehicleType cleared to null" false "got $CLEARED_VEHICLE"

# L06: Update notes
run "update driver notes (200)" \
  l06_update_notes.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"notes":"Updated notes for testing"}'
UPDATED_NOTES=$(jq -r '.data.notes // "null"' "$OUTPUT_DIR/l06_update_notes.json")
[[ "$UPDATED_NOTES" == "Updated notes for testing" ]] \
  && assert "notes updated" true \
  || assert "notes updated" false "got $UPDATED_NOTES"

# L07: Clear notes
run "clear driver notes (200)" \
  l07_clear_notes.json 200 PATCH /api/drivers/$DRIVER_ID \
  '{"notes":null}'
CLEARED_NOTES=$(jq -r '.data.notes // "null"' "$OUTPUT_DIR/l07_clear_notes.json")
[ "$CLEARED_NOTES" = "null" ] \
  && assert "notes cleared to null" true \
  || assert "notes cleared to null" false "got $CLEARED_NOTES"

# =============================================================================
header "SECTION M — Float fee values (HIGH PRIORITY)"
# =============================================================================

# M01: Set compensation with decimal fee
run "upsert compensation: decimal fee 350.50 (200)" \
  m01_decimal_fee.json 200 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  '{"feePerDelivery":350.50}'
DECIMAL_FEE=$(jq -r '.data.feePerDelivery // 0' "$OUTPUT_DIR/m01_decimal_fee.json")
[ "$DECIMAL_FEE" = "350.5" ] || [ "$DECIMAL_FEE" = "350.50" ] \
  && assert "decimal fee 350.50 saved" true \
  || assert "decimal fee 350.50 saved" false "got $DECIMAL_FEE"

# M02: Create and assign order to verify decimal fee
DECIMAL_ORDER_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerName": "Test Customer",
  "phone": "$CUSTOMER_PHONE",
  "wilayaId": $TEST_WILAYA,
  "address": "Rue de Test",
  "price": 1000,
  "orderType": "offline",
  "deliveryType": "home",
  "deliveryFee": 0,
  "products": [{
    "productId": "$PRODUCT_ID",
    "productName": "DRIVER PAY TEST Product",
    "quantity": 1,
    "pricePerUnit": 1000,
    "lineTotal": 1000
  }]
}
EOF
)
run "create order for decimal fee test (201)" \
  m02_decimal_order.json 201 POST /api/orders "$DECIMAL_ORDER_BODY"
DECIMAL_ORDER_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/m02_decimal_order.json")

run "decimal order: new→confirmed" m03_dec_conf.json 200 PATCH /api/orders/$DECIMAL_ORDER_ID/status '{"status":"confirmed"}'
run "decimal order: confirmed→preparing" m04_dec_prep.json 200 PATCH /api/orders/$DECIMAL_ORDER_ID/status '{"status":"preparing"}'
run "decimal order: preparing→ready" m05_dec_ready.json 200 PATCH /api/orders/$DECIMAL_ORDER_ID/status '{"status":"ready"}'
run "assign driver to decimal order (200)" m06_dec_assign.json 200 PATCH /api/orders/$DECIMAL_ORDER_ID/assign-driver "{\"driverId\":\"$DRIVER_ID\"}"

# M07: Verify order has decimal driverFee
run "get order with decimal fee (200)" \
  m07_dec_order_get.json 200 GET /api/orders/$DECIMAL_ORDER_ID
ORDER_DECIMAL_FEE=$(jq -r '.data.driverFee // 0' "$OUTPUT_DIR/m07_dec_order_get.json")
[ "$ORDER_DECIMAL_FEE" = "350.5" ] || [ "$ORDER_DECIMAL_FEE" = "350.50" ] \
  && assert "order.driverFee = 350.50 (decimal preserved)" true \
  || assert "order.driverFee = 350.50 (decimal preserved)" false "got $ORDER_DECIMAL_FEE"

# Reset fee back to TEST_FEE for other tests
run "reset compensation to $TEST_FEE (200)" \
  m08_reset_fee.json 200 PUT /api/drivers/$DRIVER_ID/compensations/$TEST_WILAYA \
  "{\"feePerDelivery\":$TEST_FEE}"

# =============================================================================
header "SUMMARY"
# =============================================================================
TOTAL=$((PASSED + FAILED))
echo ""
printf "  Total:  %d\n" "$TOTAL"
printf "  ${GREEN}Passed: %d${NC}\n" "$PASSED"
printf "  ${RED}Failed: %d${NC}\n" "$FAILED"
echo ""
if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}FAILURES (potential bugs to investigate):${NC}"
  for f in "${FAIL_LIST[@]}"; do
    echo -e "  ${RED}•${NC} $f"
  done
  echo ""
  echo -e "Full responses in: ${YELLOW}$OUTPUT_DIR/${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed.${NC}"
  echo -e "Responses in: ${YELLOW}$OUTPUT_DIR/${NC}"
  exit 0
fi
