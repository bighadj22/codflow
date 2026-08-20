#!/bin/bash

# =============================================================================
# COMPREHENSIVE Products + Variants + Stock-Management Endpoint Test
# -----------------------------------------------------------------------------
# Exhaustively exercises every endpoint touched by the products / variants /
# stock surface in cod-server, including all happy paths AND every error
# branch the validators / handlers can produce. Designed to catch silent
# regressions and validation drift.
#
# DB ASSUMPTION: starts empty (only admin user + 1 store + wilayas/communes).
# This script CREATES all the test data it needs via the API itself, so it can
# run on a fresh local DB. It also soft-deletes everything it created at the
# end so re-runs work, but if a run aborts mid-way you may need to re-clean.
#
# Endpoints covered:
#   PRODUCTS
#     GET    /api/products
#     POST   /api/products
#     GET    /api/products/:id
#     PATCH  /api/products/:id
#     PATCH  /api/products/:id/status
#     DELETE /api/products/:id
#   VARIANTS
#     GET    /api/products/:productId/variants
#     POST   /api/products/:productId/variants
#     GET    /api/products/:productId/variants/:variantId
#     PATCH  /api/products/:productId/variants/:variantId
#     DELETE /api/products/:productId/variants/:variantId
#   STOCK
#     GET    /api/stock/overview
#     GET    /api/stock/alerts
#     POST   /api/products/:id/stock/adjust
#     GET    /api/products/:id/stock/history
#     PATCH  /api/products/:id/stock/threshold
#     POST   /api/products/:productId/variants/:variantId/stock/adjust
#     PATCH  /api/products/:productId/variants/:variantId/stock/threshold
#
# Auth:
#   Uses the admin user's API key from the local DB
#   (users.api_key = 'cod_c4d0f6bd3e7f8039f40288548f072801').
#
# Output:
#   Every response saved to test-scripts/responses/products-variants-stock/.
#   Test summary printed at the end with a list of FAILED tests (= bugs).
# =============================================================================

set -u

API_KEY="cod_c4d0f6bd3e7f8039f40288548f072801"
BAD_KEY="cod_definitely_not_a_real_key_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL="http://localhost:8787"
OUTPUT_DIR="test-scripts/responses/products-variants-stock"

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
  # Pretty if json, else dump as-is
  if echo "$raw" | jq . >/dev/null 2>&1; then
    echo "$raw" | jq . > "$OUTPUT_DIR/$file"
  else
    printf '%s\n' "$raw" > "$OUTPUT_DIR/$file"
  fi

  if [ "$http" = "$expected" ]; then
    PASSED=$((PASSED+1))
    printf "${GREEN}✓${NC} %-44s ${GRAY}[%s]${NC}  %s\n" "$file" "$http" "$label"
  else
    FAILED=$((FAILED+1))
    FAIL_LIST+=("$file  expected=$expected got=$http  $label")
    printf "${RED}✗${NC} %-44s ${RED}[got %s, expected %s]${NC}  %s\n" "$file" "$http" "$expected" "$label"
  fi
}

# Read body of a saved response
body_of() { cat "$OUTPUT_DIR/$1"; }

# =============================================================================
header() {
  echo ""
  echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE} $1${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

header "Sanity: server reachable + DB pre-state"
HEALTH=$(curl -s "$BASE_URL/health")
echo "  /health -> $HEALTH"
if [ "$HEALTH" != '{"status":"ok"}' ]; then
  echo -e "${RED}Server not healthy at $BASE_URL — abort.${NC}"
  exit 1
fi

# =============================================================================
header "SECTION A — Authentication"
# =============================================================================

run "list products: no key (401)" \
  test_a01_list_no_key.json 401 GET /api/products "" __none__

run "list products: bad key (401)" \
  test_a02_list_bad_key.json 401 GET /api/products "" "$BAD_KEY"

run "list products: good key (200)" \
  test_a03_list_good_key.json 200 GET /api/products

# =============================================================================
header "SECTION B — Products CRUD (simple, hasVariants=false)"
# =============================================================================

# B01: create simple product (happy)
SIMPLE_BODY='{
  "name": "TEST Simple Widget",
  "description": "Plain physical product for stock tests",
  "price": 1500,
  "compareAtPrice": 2000,
  "costPrice": 800,
  "type": "PHYSICAL",
  "hasVariants": false,
  "sku": "TEST-SIMPLE-001",
  "inventory": 20,
  "lowStockThreshold": 5,
  "trackInventory": true,
  "tags": ["test","simple"],
  "visibility": true,
  "status": "ACTIVE",
  "showInStore": true,
  "storeFeatured": false
}'
run "create simple product (201)" \
  test_b01_create_simple.json 201 POST /api/products "$SIMPLE_BODY"

SIMPLE_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_b01_create_simple.json")
if [ -z "$SIMPLE_ID" ]; then
  echo -e "${RED}Could not capture SIMPLE_ID — aborting${NC}"
  cat "$OUTPUT_DIR/test_b01_create_simple.json"
  exit 1
fi
echo -e "${CYAN}  → SIMPLE_ID=$SIMPLE_ID${NC}"

# B02: duplicate SKU
run "create simple: duplicate SKU (409)" \
  test_b02_dup_sku.json 409 POST /api/products "$SIMPLE_BODY"

# B03: simple product missing sku → 422 (custom superRefine)
run "create simple: missing sku (400)" \
  test_b03_missing_sku.json 400 POST /api/products \
  '{"name":"X","price":100,"hasVariants":false,"inventory":1}'

# B04: negative price
run "create simple: negative price (400)" \
  test_b04_neg_price.json 400 POST /api/products \
  '{"name":"X","price":-1,"hasVariants":false,"sku":"X-NEG","inventory":1}'

# B05: non-integer price
run "create simple: float price (400)" \
  test_b05_float_price.json 400 POST /api/products \
  '{"name":"X","price":1.5,"hasVariants":false,"sku":"X-FLT","inventory":1}'

# B06: empty name
run "create simple: empty name (400)" \
  test_b06_empty_name.json 400 POST /api/products \
  '{"name":"","price":100,"hasVariants":false,"sku":"X-EMP","inventory":1}'

# B07: invalid status enum
run "create simple: bad status (400)" \
  test_b07_bad_status.json 400 POST /api/products \
  '{"name":"X","price":100,"hasVariants":false,"sku":"X-BST","inventory":1,"status":"WHATEVER"}'

# B08: get by id (200)
run "get product by id (200)" \
  test_b08_get_simple.json 200 GET /api/products/$SIMPLE_ID

# B09: list — happy
run "list products (200)" \
  test_b09_list.json 200 GET /api/products

# B10: list with search filter
run "list products: search filter (200)" \
  test_b10_list_search.json 200 GET "/api/products?search=Widget"

# B11: list with status filter
run "list products: status=ACTIVE (200)" \
  test_b11_list_status.json 200 GET "/api/products?status=ACTIVE"

# B12: list with limit > 100 → 422
run "list products: limit=200 (400)" \
  test_b12_list_limit_too_high.json 400 GET "/api/products?limit=200"

# B13: PATCH update name + price
run "update product (200)" \
  test_b13_update.json 200 PATCH /api/products/$SIMPLE_ID \
  '{"name":"TEST Simple Widget UPDATED","price":1750,"description":"changed"}'

# B14: PATCH status DRAFT
run "update product status DRAFT (200)" \
  test_b14_status_draft.json 200 PATCH /api/products/$SIMPLE_ID/status \
  '{"status":"DRAFT"}'

# B15: PATCH status ARCHIVED
run "update product status ARCHIVED (200)" \
  test_b15_status_archived.json 200 PATCH /api/products/$SIMPLE_ID/status \
  '{"status":"ARCHIVED"}'

# B16: PATCH status invalid
run "update product status: invalid (400)" \
  test_b16_status_invalid.json 400 PATCH /api/products/$SIMPLE_ID/status \
  '{"status":"PUBLISHED"}'

# B17: restore to ACTIVE for downstream tests
run "update product status ACTIVE (200)" \
  test_b17_status_active.json 200 PATCH /api/products/$SIMPLE_ID/status \
  '{"status":"ACTIVE"}'

# B18: GET nonexistent
run "get product: nonexistent (404)" \
  test_b18_get_404.json 404 GET /api/products/does-not-exist-xyz

# B19: PATCH nonexistent
run "patch product: nonexistent (404)" \
  test_b19_patch_404.json 404 PATCH /api/products/does-not-exist-xyz \
  '{"name":"X"}'

# B20: PATCH status nonexistent
run "patch status: nonexistent (404)" \
  test_b20_status_404.json 404 PATCH /api/products/does-not-exist-xyz/status \
  '{"status":"ACTIVE"}'

# =============================================================================
header "SECTION C — Variant Product + Variants CRUD"
# =============================================================================

# C01: create variant product (parent). trackInventory=true is the master toggle —
# it gates orders/storefront deduction AND stock-overview visibility for ALL of
# this product's variants. Set false only when none of the variants should be tracked.
VARIANT_PRODUCT_BODY='{
  "name": "TEST Variant T-Shirt",
  "description": "Product with variants",
  "price": 2500,
  "type": "PHYSICAL",
  "hasVariants": true,
  "variantOptions": [
    {"name":"Color","values":[{"value":"Red","hexColor":"#ff0000"},{"value":"Blue","hexColor":"#0000ff"}]},
    {"name":"Size","values":[{"value":"M"},{"value":"L"}]}
  ],
  "inventory": 0,
  "trackInventory": true,
  "status": "ACTIVE"
}'
run "create variant product (201)" \
  test_c01_create_variant_product.json 201 POST /api/products "$VARIANT_PRODUCT_BODY"

VP_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_c01_create_variant_product.json")
if [ -z "$VP_ID" ]; then
  echo -e "${RED}Could not capture VP_ID — aborting${NC}"
  exit 1
fi
echo -e "${CYAN}  → VP_ID=$VP_ID${NC}"

# C02: create variant 1 — Red/M
run "create variant Red/M (201)" \
  test_c02_create_v1.json 201 POST /api/products/$VP_ID/variants \
  '{"variations":{"Color":"Red","Size":"M"},"price":2500,"sku":"TS-RED-M","inventory":15,"lowStockThreshold":3,"isDefault":true,"position":1}'

V1_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_c02_create_v1.json")
echo -e "${CYAN}  → V1_ID=$V1_ID${NC}"

# C03: create variant 2 — Blue/L
run "create variant Blue/L (201)" \
  test_c03_create_v2.json 201 POST /api/products/$VP_ID/variants \
  '{"variations":{"Color":"Blue","Size":"L"},"price":2700,"sku":"TS-BLUE-L","inventory":8,"lowStockThreshold":3,"position":2}'

V2_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_c03_create_v2.json")
echo -e "${CYAN}  → V2_ID=$V2_ID${NC}"

# C04: create variant 3 — Red/L
run "create variant Red/L (201)" \
  test_c04_create_v3.json 201 POST /api/products/$VP_ID/variants \
  '{"variations":{"Color":"Red","Size":"L"},"price":2600,"sku":"TS-RED-L","inventory":4,"lowStockThreshold":5,"position":3}'

V3_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_c04_create_v3.json")
echo -e "${CYAN}  → V3_ID=$V3_ID${NC}"

# C05: variant missing sku
run "create variant: missing sku (400)" \
  test_c05_v_missing_sku.json 400 POST /api/products/$VP_ID/variants \
  '{"variations":{"Color":"X"},"price":100,"inventory":1}'

# C06: variant negative price
run "create variant: neg price (400)" \
  test_c06_v_neg_price.json 400 POST /api/products/$VP_ID/variants \
  '{"variations":{"Color":"X"},"price":-1,"sku":"NEG","inventory":1}'

# C07: variant non-integer inventory
run "create variant: float inventory (400)" \
  test_c07_v_float_inv.json 400 POST /api/products/$VP_ID/variants \
  '{"variations":{"Color":"X"},"price":100,"sku":"FLT","inventory":1.5}'

# C08: list variants
run "list variants (200)" \
  test_c08_list_variants.json 200 GET /api/products/$VP_ID/variants

# C09: get variant by id
run "get variant by id (200)" \
  test_c09_get_variant.json 200 GET /api/products/$VP_ID/variants/$V1_ID

# C10: get nonexistent variant
run "get variant: nonexistent (404)" \
  test_c10_get_v_404.json 404 GET /api/products/$VP_ID/variants/v-does-not-exist

# C11: update variant
run "update variant (200)" \
  test_c11_update_v.json 200 PATCH /api/products/$VP_ID/variants/$V1_ID \
  '{"price":2550,"barcode":"BC-123"}'

# C12: update nonexistent variant
run "update variant: nonexistent (404)" \
  test_c12_update_v_404.json 404 PATCH /api/products/$VP_ID/variants/v-does-not-exist \
  '{"price":1}'

# C13: GET parent product — verify variants attached + totalInventory
run "get parent: variants + totalInventory (200)" \
  test_c13_parent_with_variants.json 200 GET /api/products/$VP_ID

# Quick sanity check on totalInventory (should be 15+8+4 = 27)
TOTAL_INV=$(jq -r '.data.totalInventory // 0' "$OUTPUT_DIR/test_c13_parent_with_variants.json")
VAR_COUNT=$(jq -r '.data.variantsCount // 0' "$OUTPUT_DIR/test_c13_parent_with_variants.json")
echo -e "${CYAN}  → totalInventory=$TOTAL_INV (expected 27), variantsCount=$VAR_COUNT (expected 3)${NC}"
if [ "$TOTAL_INV" != "27" ] || [ "$VAR_COUNT" != "3" ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_c13_parent_with_variants.json  totalInventory/variantsCount mismatch (got $TOTAL_INV/$VAR_COUNT, expected 27/3)")
  echo -e "${RED}  ✗ aggregate mismatch${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ aggregate ok${NC}"
fi

# =============================================================================
header "SECTION D — Stock: Simple Product"
# =============================================================================

# D01: stock overview (after creating 4 SKUs: 1 simple + 3 variants)
run "stock overview (200)" \
  test_d01_overview.json 200 GET /api/stock/overview

# D02: stock alerts default
run "stock alerts (200)" \
  test_d02_alerts.json 200 GET /api/stock/alerts

# D03: alerts with bad limit
run "stock alerts: limit=200 (400)" \
  test_d03_alerts_bad_limit.json 400 GET "/api/stock/alerts?limit=200"

# D04: PURCHASE +50 on simple
run "adjust simple: PURCHASE +50 (200)" \
  test_d04_simple_purchase.json 200 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"PURCHASE","delta":50}'

# D05: ADJUSTMENT_ADD without reason → 422
run "adjust simple: ADJUSTMENT_ADD no reason (400)" \
  test_d05_simple_adj_no_reason.json 400 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"ADJUSTMENT_ADD","delta":5}'

# D06: ADJUSTMENT_ADD with reason
run "adjust simple: ADJUSTMENT_ADD +5 (200)" \
  test_d06_simple_adj_add.json 200 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"ADJUSTMENT_ADD","delta":5,"reason":"manual recount"}'

# D07: ADJUSTMENT_REMOVE with reason
run "adjust simple: ADJUSTMENT_REMOVE -3 (200)" \
  test_d07_simple_adj_remove.json 200 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"ADJUSTMENT_REMOVE","delta":-3,"reason":"damaged"}'

# D08: ORDER_DEDUCTED without reason — allowed
run "adjust simple: ORDER_DEDUCTED -2 (200)" \
  test_d08_simple_order_deducted.json 200 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"ORDER_DEDUCTED","delta":-2}'

# D09: ORDER_RETURNED  — allowed
run "adjust simple: ORDER_RETURNED +1 (200)" \
  test_d09_simple_order_returned.json 200 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"ORDER_RETURNED","delta":1}'

# D10: OFFLINE_SALE without reason → 422
run "adjust simple: OFFLINE_SALE no reason (400)" \
  test_d10_simple_offline_no_reason.json 400 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"OFFLINE_SALE","delta":-1}'

# D11: OFFLINE_SALE with reason — 200
run "adjust simple: OFFLINE_SALE -1 (200)" \
  test_d11_simple_offline.json 200 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"OFFLINE_SALE","delta":-1,"reason":"in-shop"}'

# D12: zero delta refused → 422
run "adjust simple: delta=0 (400)" \
  test_d12_simple_zero.json 400 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"PURCHASE","delta":0}'

# D13: insufficient stock → 422 BusinessLogicError (HTTP 422 in cod-server error map)
run "adjust simple: insufficient stock (422)" \
  test_d13_simple_insufficient.json 422 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"ADJUSTMENT_REMOVE","delta":-99999,"reason":"x"}'

# D14: invalid type
run "adjust simple: invalid type (400)" \
  test_d14_simple_bad_type.json 400 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"NOT_A_TYPE","delta":1}'

# D15: float delta
run "adjust simple: float delta (400)" \
  test_d15_simple_float_delta.json 400 POST /api/products/$SIMPLE_ID/stock/adjust \
  '{"type":"PURCHASE","delta":1.5}'

# D16: nonexistent product
run "adjust on nonexistent product (404)" \
  test_d16_adjust_404.json 404 POST /api/products/no-such-prod/stock/adjust \
  '{"type":"PURCHASE","delta":1}'

# D17: history happy
run "history simple (200)" \
  test_d17_history_simple.json 200 GET "/api/products/$SIMPLE_ID/stock/history?limit=50"

HIST_TOTAL=$(jq -r '.data.total // 0' "$OUTPUT_DIR/test_d17_history_simple.json")
echo -e "${CYAN}  → history movements total=$HIST_TOTAL (expected >= 6 from D04..D11 successful adjusts)${NC}"
if [ "$HIST_TOTAL" -lt 6 ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_d17_history_simple.json  expected >=6 movements, got $HIST_TOTAL")
  echo -e "${RED}  ✗ history count too low${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ history count ok${NC}"
fi

# D18: history with bad limit
run "history simple: limit=200 (400)" \
  test_d18_history_bad_limit.json 400 GET "/api/products/$SIMPLE_ID/stock/history?limit=200"

# D19: PATCH threshold happy
run "threshold simple: set 10 (200)" \
  test_d19_threshold_set.json 200 PATCH /api/products/$SIMPLE_ID/stock/threshold \
  '{"lowStockThreshold":10}'

# D20: PATCH threshold negative
run "threshold simple: -1 (400)" \
  test_d20_threshold_neg.json 400 PATCH /api/products/$SIMPLE_ID/stock/threshold \
  '{"lowStockThreshold":-1}'

# D21: PATCH threshold > max (9999)
run "threshold simple: 99999 (400)" \
  test_d21_threshold_max.json 400 PATCH /api/products/$SIMPLE_ID/stock/threshold \
  '{"lowStockThreshold":99999}'

# D22: PATCH threshold nonexistent
run "threshold: nonexistent (404)" \
  test_d22_threshold_404.json 404 PATCH /api/products/no-such-prod/stock/threshold \
  '{"lowStockThreshold":5}'

# =============================================================================
header "SECTION E — Stock: Variants"
# =============================================================================

# E01: PURCHASE +30 on V1
run "adjust variant V1: PURCHASE +30 (200)" \
  test_e01_v1_purchase.json 200 POST /api/products/$VP_ID/variants/$V1_ID/stock/adjust \
  '{"type":"PURCHASE","delta":30}'

# E02: ADJUSTMENT_REMOVE -5 with reason
run "adjust variant V1: ADJUSTMENT_REMOVE -5 (200)" \
  test_e02_v1_adj_remove.json 200 POST /api/products/$VP_ID/variants/$V1_ID/stock/adjust \
  '{"type":"ADJUSTMENT_REMOVE","delta":-5,"reason":"loss"}'

# E03: nonexistent variant
run "adjust variant: nonexistent (404)" \
  test_e03_v_404.json 404 POST /api/products/$VP_ID/variants/no-such-v/stock/adjust \
  '{"type":"PURCHASE","delta":1}'

# E04: PATCH variant threshold
run "threshold variant V1 (200)" \
  test_e04_v_threshold.json 200 PATCH /api/products/$VP_ID/variants/$V1_ID/stock/threshold \
  '{"lowStockThreshold":8}'

# E05: PATCH variant threshold nonexistent variant
run "threshold variant: nonexistent (404)" \
  test_e05_v_threshold_404.json 404 PATCH /api/products/$VP_ID/variants/no-such-v/stock/threshold \
  '{"lowStockThreshold":1}'

# E06: history filter by variantId
run "history filter by variantId V1 (200)" \
  test_e06_history_variant_filter.json 200 GET "/api/products/$VP_ID/stock/history?variantId=$V1_ID&limit=50"

V1_HIST=$(jq -r '.data.total // 0' "$OUTPUT_DIR/test_e06_history_variant_filter.json")
echo -e "${CYAN}  → V1 history total=$V1_HIST (expected 2 from E01,E02)${NC}"
if [ "$V1_HIST" != "2" ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_e06_history_variant_filter.json  expected 2 movements, got $V1_HIST")
  echo -e "${RED}  ✗ filter mismatch${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ variant filter ok${NC}"
fi

# =============================================================================
header "SECTION F — Alerts trigger (drain a variant to 0)"
# =============================================================================

# Look up V3 current inventory (was 4, should still be 4 — never adjusted)
V3_INV=$(jq -r '.data.inventory // 0' "$OUTPUT_DIR/test_c04_create_v3.json")
echo -e "${CYAN}  → V3 starting inventory=$V3_INV${NC}"
DRAIN=$((0 - V3_INV))

# F01: drain V3 to 0
run "drain V3 to 0 (200)" \
  test_f01_drain_v3.json 200 POST /api/products/$VP_ID/variants/$V3_ID/stock/adjust \
  "{\"type\":\"ADJUSTMENT_REMOVE\",\"delta\":$DRAIN,\"reason\":\"drain for test\"}"

# F02: confirm in alerts
run "alerts after drain (200)" \
  test_f02_alerts_after.json 200 GET "/api/stock/alerts?limit=100"

V3_IN_ALERTS=$(jq -r --arg v "$V3_ID" '.data.items[] | select(.variantId==$v) | .variantId' "$OUTPUT_DIR/test_f02_alerts_after.json")
if [ "$V3_IN_ALERTS" = "$V3_ID" ]; then
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ V3 in alerts${NC}"
else
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_f02_alerts_after.json  V3 not present in alerts after drain")
  echo -e "${RED}  ✗ V3 NOT in alerts${NC}"
fi

# F03: confirm overview totals
run "overview after drain (200)" \
  test_f03_overview_after.json 200 GET /api/stock/overview

OOS=$(jq -r '.data.outOfStockCount // 0' "$OUTPUT_DIR/test_f03_overview_after.json")
LOW=$(jq -r '.data.lowStockCount // 0' "$OUTPUT_DIR/test_f03_overview_after.json")
echo -e "${CYAN}  → outOfStockCount=$OOS, lowStockCount=$LOW${NC}"
if [ "$OOS" -lt 1 ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_f03_overview_after.json  expected outOfStockCount >= 1, got $OOS")
  echo -e "${RED}  ✗ overview not reflecting OOS${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ overview shows OOS${NC}"
fi

# =============================================================================
header "SECTION G — Variant delete (no orders) + product delete"
# =============================================================================

# G01: delete variant V2 (no orders) → 200
run "delete variant V2 (200)" \
  test_g01_delete_v2.json 200 DELETE /api/products/$VP_ID/variants/$V2_ID

# G02: delete already-deleted variant → 404
run "delete variant V2 again (404)" \
  test_g02_delete_v2_again.json 404 DELETE /api/products/$VP_ID/variants/$V2_ID

# G03: list variants — V2 gone
run "list variants after V2 delete (200)" \
  test_g03_list_after_v_del.json 200 GET /api/products/$VP_ID/variants

LIST_COUNT=$(jq -r '.count // 0' "$OUTPUT_DIR/test_g03_list_after_v_del.json")
if [ "$LIST_COUNT" = "2" ]; then
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ variants count = 2 after delete${NC}"
else
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_g03_list_after_v_del.json  expected count=2, got $LIST_COUNT")
  echo -e "${RED}  ✗ variant count wrong${NC}"
fi

# G04: soft-delete variant product
run "delete variant product (200)" \
  test_g04_delete_vp.json 200 DELETE /api/products/$VP_ID

# G05: GET soft-deleted product → 404
run "get deleted product (404)" \
  test_g05_get_deleted_vp.json 404 GET /api/products/$VP_ID

# G06: delete nonexistent product → 404
run "delete nonexistent product (404)" \
  test_g06_delete_404.json 404 DELETE /api/products/no-such-prod

# G07: delete simple product
run "delete simple product (200)" \
  test_g07_delete_simple.json 200 DELETE /api/products/$SIMPLE_ID

# G08: GET deleted simple → 404
run "get deleted simple (404)" \
  test_g08_get_deleted_simple.json 404 GET /api/products/$SIMPLE_ID

# G09: overview after deletes — soft-deleted parent + simple should be excluded
run "overview after deletes (200)" \
  test_g09_overview_final.json 200 GET /api/stock/overview

# Aggregate sanity
FINAL_SKUS=$(jq -r '.data.totalSkus // 0' "$OUTPUT_DIR/test_g09_overview_final.json")
echo -e "${CYAN}  → final totalSkus=$FINAL_SKUS (expected 0 — both products soft-deleted)${NC}"
if [ "$FINAL_SKUS" != "0" ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_g09_overview_final.json  expected totalSkus=0 after delete, got $FINAL_SKUS  (POSSIBLE BUG: variants of soft-deleted parents leaking into stock overview)")
  echo -e "${RED}  ✗ POSSIBLE BUG: SKUs of deleted products still counted${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ overview correctly excludes deleted products${NC}"
fi

# =============================================================================
header "SECTION H — trackInventory=false exclusion (master-toggle contract)"
# =============================================================================
# Contract under test: products.trackInventory is the master toggle. When false,
# the product is COMPLETELY excluded from stock overview/alerts — for BOTH
# simple AND variant products (i.e. ALL of a variant parent's variants must be
# hidden when the parent is OFF). Flipping the flag back to true must make the
# product/variants reappear. This guards against:
#   - alert noise on intentionally untracked items (digital goods, made-to-order)
#   - inconsistent gating between orders/storefront/stock-overview

# H01: create OFF simple — high threshold, low inventory: WOULD be lowStock if counted
OFF_SIMPLE_BODY='{
  "name": "TEST OFF Simple",
  "price": 1000,
  "hasVariants": false,
  "sku": "TEST-OFF-SIMPLE-001",
  "inventory": 1,
  "lowStockThreshold": 10,
  "trackInventory": false,
  "status": "ACTIVE"
}'
run "create OFF simple product (201)" \
  test_h01_create_off_simple.json 201 POST /api/products "$OFF_SIMPLE_BODY"

OFF_SIMPLE_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_h01_create_off_simple.json")
if [ -z "$OFF_SIMPLE_ID" ]; then
  echo -e "${RED}Could not capture OFF_SIMPLE_ID — aborting${NC}"
  exit 1
fi
echo -e "${CYAN}  → OFF_SIMPLE_ID=$OFF_SIMPLE_ID${NC}"

# H02: create OFF variant product — variants will be inventory=0 (WOULD be OOS if counted)
OFF_VP_BODY='{
  "name": "TEST OFF Variant",
  "price": 2000,
  "type": "PHYSICAL",
  "hasVariants": true,
  "variantOptions": [
    {"name":"Size","values":[{"value":"S"},{"value":"M"}]}
  ],
  "inventory": 0,
  "trackInventory": false,
  "status": "ACTIVE"
}'
run "create OFF variant product (201)" \
  test_h02_create_off_vp.json 201 POST /api/products "$OFF_VP_BODY"

OFF_VP_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/test_h02_create_off_vp.json")
if [ -z "$OFF_VP_ID" ]; then
  echo -e "${RED}Could not capture OFF_VP_ID — aborting${NC}"
  exit 1
fi
echo -e "${CYAN}  → OFF_VP_ID=$OFF_VP_ID${NC}"

# H03/H04: variants with 0 inventory under the OFF parent
run "create OFF variant Size=S (201)" \
  test_h03_create_off_v1.json 201 POST /api/products/$OFF_VP_ID/variants \
  '{"variations":{"Size":"S"},"sku":"OFF-S-001","price":2000,"inventory":0,"lowStockThreshold":5,"active":true}'

run "create OFF variant Size=M (201)" \
  test_h04_create_off_v2.json 201 POST /api/products/$OFF_VP_ID/variants \
  '{"variations":{"Size":"M"},"sku":"OFF-M-001","price":2000,"inventory":0,"lowStockThreshold":5,"active":true}'

# H05: stock overview must EXCLUDE both OFF products entirely (and OFF variants)
run "overview hides OFF products (200)" \
  test_h05_overview_off.json 200 GET /api/stock/overview

LEAK_ALL_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.allItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h05_overview_off.json")
LEAK_ALL_V=$(jq -r --arg id "$OFF_VP_ID"     '[.data.allItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h05_overview_off.json")
LEAK_OOS_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.outOfStockItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h05_overview_off.json")
LEAK_OOS_V=$(jq -r --arg id "$OFF_VP_ID"     '[.data.outOfStockItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h05_overview_off.json")
LEAK_LOW_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.lowStockItems[]    | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h05_overview_off.json")
LEAK_LOW_V=$(jq -r --arg id "$OFF_VP_ID"     '[.data.lowStockItems[]    | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h05_overview_off.json")
TOTAL_LEAK=$((LEAK_ALL_S + LEAK_ALL_V + LEAK_OOS_S + LEAK_OOS_V + LEAK_LOW_S + LEAK_LOW_V))
echo -e "${CYAN}  → leaks (expect 0): all_simple=$LEAK_ALL_S all_vp=$LEAK_ALL_V oos_simple=$LEAK_OOS_S oos_vp=$LEAK_OOS_V low_simple=$LEAK_LOW_S low_vp=$LEAK_LOW_V${NC}"
if [ "$TOTAL_LEAK" != "0" ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_h05_overview_off.json  CONTRACT BUG: trackInventory=false product/variant leaked into stock overview")
  echo -e "${RED}  ✗ OFF product/variant leaked into overview${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ overview correctly hides OFF products and their variants${NC}"
fi

# H06: alerts must EXCLUDE both OFF products entirely
run "alerts hides OFF products (200)" \
  test_h06_alerts_off.json 200 GET "/api/stock/alerts?limit=100"

LEAK_A_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.items[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h06_alerts_off.json")
LEAK_A_V=$(jq -r --arg id "$OFF_VP_ID"     '[.data.items[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h06_alerts_off.json")
echo -e "${CYAN}  → alerts leak (expect 0): simple=$LEAK_A_S vp=$LEAK_A_V${NC}"
if [ "$LEAK_A_S" != "0" ] || [ "$LEAK_A_V" != "0" ]; then
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_h06_alerts_off.json  CONTRACT BUG: trackInventory=false product/variant leaked into alerts")
  echo -e "${RED}  ✗ OFF product/variant leaked into alerts${NC}"
else
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ alerts correctly hides OFF products and their variants${NC}"
fi

# H07: flip OFF simple → ON via PATCH (master toggle should restore visibility)
run "flip OFF simple → ON (200)" \
  test_h07_flip_simple_on.json 200 PATCH /api/products/$OFF_SIMPLE_ID \
  '{"trackInventory":true}'

run "overview after simple flip (200)" \
  test_h08_overview_after_flip.json 200 GET /api/stock/overview

APPEARED_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.allItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h08_overview_after_flip.json")
LOW_HIT_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.lowStockItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h08_overview_after_flip.json")
echo -e "${CYAN}  → simple after flip (expect appeared=1, lowStock=1 since inv=1 ≤ threshold=10): appeared=$APPEARED_S low=$LOW_HIT_S${NC}"
if [ "$APPEARED_S" = "1" ] && [ "$LOW_HIT_S" = "1" ]; then
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ simple flip ON: now visible AND classified as lowStock${NC}"
else
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_h08_overview_after_flip.json  CONTRACT BUG: simple did not reappear correctly after flip ON (appeared=$APPEARED_S low=$LOW_HIT_S)")
  echo -e "${RED}  ✗ simple flip ON broken${NC}"
fi

# H09: flip OFF variant parent → ON (must restore ALL variants)
run "flip OFF variant parent → ON (200)" \
  test_h09_flip_vp_on.json 200 PATCH /api/products/$OFF_VP_ID \
  '{"trackInventory":true}'

run "overview after VP flip (200)" \
  test_h10_overview_after_vp_flip.json 200 GET /api/stock/overview

VP_VARIANTS_NOW=$(jq -r --arg id "$OFF_VP_ID" '[.data.allItems[] | select(.productId==$id and .variantId!=null)] | length' "$OUTPUT_DIR/test_h10_overview_after_vp_flip.json")
VP_OOS=$(jq -r --arg id "$OFF_VP_ID" '[.data.outOfStockItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h10_overview_after_vp_flip.json")
echo -e "${CYAN}  → VP variants after flip (expect visible=2, OOS=2 since both inv=0): visible=$VP_VARIANTS_NOW oos=$VP_OOS${NC}"
if [ "$VP_VARIANTS_NOW" = "2" ] && [ "$VP_OOS" = "2" ]; then
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ variant flip ON: all variants now visible AND classified OOS${NC}"
else
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_h10_overview_after_vp_flip.json  CONTRACT BUG: variants did not reappear correctly after parent flip ON (visible=$VP_VARIANTS_NOW oos=$VP_OOS)")
  echo -e "${RED}  ✗ variant flip ON broken${NC}"
fi

# H11: flip simple back to OFF → must vanish again (round-trip safety)
run "flip simple → OFF again (200)" \
  test_h11_flip_simple_off.json 200 PATCH /api/products/$OFF_SIMPLE_ID \
  '{"trackInventory":false}'

run "overview after simple flip OFF (200)" \
  test_h12_overview_after_flip_off.json 200 GET /api/stock/overview

GONE_S=$(jq -r --arg id "$OFF_SIMPLE_ID" '[.data.allItems[] | select(.productId==$id)] | length' "$OUTPUT_DIR/test_h12_overview_after_flip_off.json")
echo -e "${CYAN}  → simple after flip OFF (expect 0): $GONE_S${NC}"
if [ "$GONE_S" = "0" ]; then
  PASSED=$((PASSED+1))
  echo -e "${GREEN}  ✓ round-trip OFF→ON→OFF works for simple${NC}"
else
  FAILED=$((FAILED+1))
  FAIL_LIST+=("test_h12_overview_after_flip_off.json  CONTRACT BUG: simple still visible after flipping back OFF (count=$GONE_S)")
  echo -e "${RED}  ✗ round-trip OFF broken${NC}"
fi

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
