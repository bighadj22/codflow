#!/bin/bash

# =============================================================================
# COMPREHENSIVE Shipping Profiles Endpoint Test
# -----------------------------------------------------------------------------
# Exhaustively exercises every endpoint on the shipping-profiles surface in
# cod-server: profile CRUD, bulk wilaya rule replacement, per-commune overrides
# (inherit-on-null semantics), default-profile auto-rules lookup, and full
# integration with the orders/fee-resolution + product-level override pathways.
#
# DB ASSUMPTION: starts empty-ish (admin user + 1 store + wilayas/communes). The
# script CREATES every supporting entity it needs through the API (profile,
# product, customer, order). Each run randomizes identifiers so it can run
# repeatedly on the same local DB without running into uniqueness errors.
#
# Endpoints covered:
#   PROFILES
#     GET    /api/shipping-profiles                                  (list)
#     POST   /api/shipping-profiles                                  (create)
#     GET    /api/shipping-profiles/default/rules                    (auto-fill)
#     GET    /api/shipping-profiles/:id                              (detail)
#     PATCH  /api/shipping-profiles/:id                              (update)
#     DELETE /api/shipping-profiles/:id                              (delete)
#   RULES
#     PUT    /api/shipping-profiles/:id/rules                        (bulk replace)
#   COMMUNE OVERRIDES
#     GET    /api/shipping-profiles/:id/rules/:wilayaId/communes
#     PUT    /api/shipping-profiles/:id/rules/:wilayaId/communes/:communeId
#     DELETE /api/shipping-profiles/:id/rules/:wilayaId/communes/:communeId
#   INTEGRATION (orders/fee resolution)
#     POST   /api/products (with shippingProfileId override)
#     POST   /api/orders   (online  → server resolves fee from profile)
#     POST   /api/orders   (offline → admin override respected)
#
# Auth:
#   Uses the admin user's API key (users.api_key =
#   'cod_c4d0f6bd3e7f8039f40288548f072801').
#
# Output:
#   Every response saved to test-scripts/responses/shipping-profiles/.
#   Summary printed at end with FAILED tests (= bugs).
# =============================================================================

set -u

API_KEY="cod_c4d0f6bd3e7f8039f40288548f072801"
BAD_KEY="cod_definitely_not_a_real_key_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL="http://localhost:8787"
OUTPUT_DIR="test-scripts/responses/shipping-profiles"

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

RAND=$(printf "%08d" $((RANDOM * 13 % 100000000)))
CUSTOMER_PHONE="05${RAND:0:8}"
CUSTOMER_ID="cust-ship-$RAND"
TEST_WILAYA=16        # Alger — always exists in seed
OTHER_WILAYA=31       # Oran
UNCOVERED_WILAYA=58   # (rule intentionally not created in profile under test)

# ─── jq sanity ────────────────────────────────────────────────────────────────
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required."
  exit 1
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────
# run "label" file.json EXPECTED_CODE METHOD PATH [BODY] [API_KEY_OVERRIDE]
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
    printf "${GREEN}✓${NC} %-55s ${GRAY}[%s]${NC}  %s\n" "$file" "$http" "$label"
  else
    FAILED=$((FAILED+1))
    FAIL_LIST+=("$file  expected=$expected got=$http  $label")
    printf "${RED}✗${NC} %-55s ${RED}[got %s, expected %s]${NC}  %s\n" "$file" "$http" "$expected" "$label"
  fi
}

assert() {
  local label="$1"
  local ok="$2"
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
echo -e "${CYAN}  customer id:    $CUSTOMER_ID${NC}"
echo -e "${CYAN}  test wilaya:    $TEST_WILAYA${NC}"

# Fetch a real commune id for the test wilaya
run "fetch communes for wilaya $TEST_WILAYA" \
  setup_communes.json 200 GET "/api/wilayas/$TEST_WILAYA/communes"

TEST_COMMUNE_ID=$(jq -r '.data[0].id // empty' "$OUTPUT_DIR/setup_communes.json")
TEST_COMMUNE_ID_2=$(jq -r '.data[1].id // empty' "$OUTPUT_DIR/setup_communes.json")
if [ -z "$TEST_COMMUNE_ID" ] || [ -z "$TEST_COMMUNE_ID_2" ]; then
  echo -e "${RED}Could not fetch commune ids — abort.${NC}"
  exit 1
fi
echo -e "${CYAN}  commune id #1:  $TEST_COMMUNE_ID${NC}"
echo -e "${CYAN}  commune id #2:  $TEST_COMMUNE_ID_2${NC}"

# =============================================================================
header "SECTION A — Authentication on /api/shipping-profiles"
# =============================================================================

run "list profiles: no key (401)" \
  a01_list_no_key.json 401 GET /api/shipping-profiles "" __none__

run "list profiles: bad key (401)" \
  a02_list_bad_key.json 401 GET /api/shipping-profiles "" "$BAD_KEY"

run "list profiles: good key (200)" \
  a03_list_good_key.json 200 GET /api/shipping-profiles

# =============================================================================
header "SECTION B — Profile CRUD + validation"
# =============================================================================

# B01 create happy (non-default first, so we don't clobber existing defaults yet)
run "create profile (201)" \
  b01_create.json 201 POST /api/shipping-profiles \
  "{\"name\":\"Test Profile $RAND\",\"notes\":\"Created by shipping-profiles test\"}"

PROFILE_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/b01_create.json")
if [ -z "$PROFILE_ID" ]; then
  echo -e "${RED}Could not capture PROFILE_ID — abort${NC}"
  cat "$OUTPUT_DIR/b01_create.json"
  exit 1
fi
echo -e "${CYAN}  → PROFILE_ID=$PROFILE_ID${NC}"

# B02 create: missing name
run "create profile: missing name (400)" \
  b02_no_name.json 400 POST /api/shipping-profiles '{"notes":"x"}'

# B03 create: empty name
run "create profile: empty name (400)" \
  b03_empty_name.json 400 POST /api/shipping-profiles '{"name":""}'

# B04 create default candidate (will flip prior default)
run "create profile as default (201)" \
  b04_create_default.json 201 POST /api/shipping-profiles \
  "{\"name\":\"Default Profile $RAND\",\"isDefault\":true}"

DEFAULT_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/b04_create_default.json")
echo -e "${CYAN}  → DEFAULT_ID=$DEFAULT_ID${NC}"

# B05 list: verify exactly one isDefault after B04 (the one we just created)
run "list profiles after default create (200)" \
  b05_list_after_default.json 200 GET /api/shipping-profiles

DEFAULT_COUNT=$(jq '[.data[] | select(.isDefault == true)] | length' "$OUTPUT_DIR/b05_list_after_default.json")
[ "$DEFAULT_COUNT" = "1" ] \
  && assert "exactly one profile is isDefault" true \
  || assert "exactly one profile is isDefault" false "found $DEFAULT_COUNT defaults"

THIS_IS_DEFAULT=$(jq --arg id "$DEFAULT_ID" '.data[] | select(.id==$id) | .isDefault' "$OUTPUT_DIR/b05_list_after_default.json")
[ "$THIS_IS_DEFAULT" = "true" ] \
  && assert "our B04 profile is now default" true \
  || assert "our B04 profile is now default" false "got $THIS_IS_DEFAULT"

# B06 get detail happy
run "get profile (200)" \
  b06_get.json 200 GET /api/shipping-profiles/$PROFILE_ID

HAS_RULES=$(jq '.data.rules // "missing"' "$OUTPUT_DIR/b06_get.json")
[ "$HAS_RULES" != "missing" ] \
  && assert "detail includes rules[]" true \
  || assert "detail includes rules[]" false "rules key absent"

# B07 get 404
run "get profile: nonexistent (404)" \
  b07_get_404.json 404 GET /api/shipping-profiles/does-not-exist

# B08 patch name
run "patch profile name (200)" \
  b08_patch_name.json 200 PATCH /api/shipping-profiles/$PROFILE_ID \
  "{\"name\":\"Test Profile $RAND (renamed)\"}"

UPDATED_NAME=$(jq -r '.data.name // empty' "$OUTPUT_DIR/b08_patch_name.json")
[[ "$UPDATED_NAME" == *"(renamed)" ]] \
  && assert "patch returns new name" true \
  || assert "patch returns new name" false "got '$UPDATED_NAME'"

# B09 patch: nonexistent
run "patch profile: nonexistent (404)" \
  b09_patch_404.json 404 PATCH /api/shipping-profiles/does-not-exist \
  '{"name":"X"}'

# B10 patch: empty name
run "patch profile: empty name (400)" \
  b10_patch_bad.json 400 PATCH /api/shipping-profiles/$PROFILE_ID \
  '{"name":""}'

# B11 attempt to unset default on the sole default profile — MUST be rejected
run "patch: unset isDefault on the sole default (422)" \
  b11_unset_default.json 422 PATCH /api/shipping-profiles/$DEFAULT_ID \
  '{"isDefault":false}'

# Verify default still exists after the rejection
run "list profiles post-unset-attempt (200)" \
  b11b_list.json 200 GET /api/shipping-profiles

DEFAULT_COUNT2=$(jq '[.data[] | select(.isDefault == true)] | length' "$OUTPUT_DIR/b11b_list.json")
[ "$DEFAULT_COUNT2" = "1" ] \
  && assert "system still has a default after reject" true \
  || assert "system still has a default after reject" false "defaults=$DEFAULT_COUNT2"

# =============================================================================
header "SECTION C — Bulk wilaya rules (PUT /:id/rules)"
# =============================================================================

# C01 set rules happy
RULES_BODY=$(cat <<EOF
{
  "rules": [
    { "wilayaId": $TEST_WILAYA,  "homePrice": 600, "stopDeskPrice": 400, "homeEnabled": true,  "stopDeskEnabled": true },
    { "wilayaId": $OTHER_WILAYA, "homePrice": 800, "stopDeskPrice": 500, "homeEnabled": true,  "stopDeskEnabled": true }
  ]
}
EOF
)
run "set rules (200)" \
  c01_set_rules.json 200 PUT /api/shipping-profiles/$PROFILE_ID/rules "$RULES_BODY"

RULE_COUNT=$(jq '.data.rules | length' "$OUTPUT_DIR/c01_set_rules.json")
[ "$RULE_COUNT" = "2" ] \
  && assert "profile now has 2 rules" true \
  || assert "profile now has 2 rules" false "count=$RULE_COUNT"

HOME_PRICE_16=$(jq --argjson w $TEST_WILAYA '.data.rules[] | select(.wilayaId==$w) | .homePrice' "$OUTPUT_DIR/c01_set_rules.json")
[ "$HOME_PRICE_16" = "600" ] \
  && assert "wilaya $TEST_WILAYA home=600" true \
  || assert "wilaya $TEST_WILAYA home=600" false "got $HOME_PRICE_16"

# C02 set rules: wilayaId=0
run "set rules: wilayaId=0 (400)" \
  c02_bad_wilaya_low.json 400 PUT /api/shipping-profiles/$PROFILE_ID/rules \
  '{"rules":[{"wilayaId":0,"homePrice":100,"stopDeskPrice":100}]}'

# C03 set rules: wilayaId=59
run "set rules: wilayaId=59 (400)" \
  c03_bad_wilaya_high.json 400 PUT /api/shipping-profiles/$PROFILE_ID/rules \
  '{"rules":[{"wilayaId":59,"homePrice":100,"stopDeskPrice":100}]}'

# C04 set rules: negative price
run "set rules: negative price (400)" \
  c04_negative_price.json 400 PUT /api/shipping-profiles/$PROFILE_ID/rules \
  "{\"rules\":[{\"wilayaId\":$TEST_WILAYA,\"homePrice\":-10,\"stopDeskPrice\":100}]}"

# C05 set rules on nonexistent profile (404)
run "set rules: nonexistent profile (404)" \
  c05_set_404.json 404 PUT /api/shipping-profiles/does-not-exist/rules \
  '{"rules":[]}'

# C06 set rules: empty array clears all rules
run "set rules: empty array clears (200)" \
  c06_clear_rules.json 200 PUT /api/shipping-profiles/$PROFILE_ID/rules '{"rules":[]}'

CLEARED_COUNT=$(jq '.data.rules | length' "$OUTPUT_DIR/c06_clear_rules.json")
[ "$CLEARED_COUNT" = "0" ] \
  && assert "empty body clears all rules" true \
  || assert "empty body clears all rules" false "count=$CLEARED_COUNT"

# C07 re-set rules for subsequent sections
run "re-set rules for downstream tests (200)" \
  c07_reset_rules.json 200 PUT /api/shipping-profiles/$PROFILE_ID/rules "$RULES_BODY"

# C08 duplicate wilayaIds — should be rejected (server should dedupe/400)
run "set rules: duplicate wilayaId — reject or dedupe (400 or 200)" \
  c08_dup_wilaya.json 400 PUT /api/shipping-profiles/$PROFILE_ID/rules \
  "{\"rules\":[{\"wilayaId\":$TEST_WILAYA,\"homePrice\":100,\"stopDeskPrice\":100},{\"wilayaId\":$TEST_WILAYA,\"homePrice\":200,\"stopDeskPrice\":100}]}"

# =============================================================================
header "SECTION D — GET /default/rules"
# =============================================================================

# D01 default profile (DEFAULT_ID) has no rules yet — attach a known rule first
DEFAULT_RULES_BODY=$(cat <<EOF
{
  "rules": [
    { "wilayaId": $TEST_WILAYA, "homePrice": 400, "stopDeskPrice": 300, "homeEnabled": true, "stopDeskEnabled": true }
  ]
}
EOF
)
run "seed default profile rules (200)" \
  d01_seed_default.json 200 PUT /api/shipping-profiles/$DEFAULT_ID/rules "$DEFAULT_RULES_BODY"

# D02 GET /default/rules returns them
run "get default profile rules (200)" \
  d02_default_rules.json 200 GET /api/shipping-profiles/default/rules

DEFAULT_RULES_CNT=$(jq '.data | length' "$OUTPUT_DIR/d02_default_rules.json")
[ "$DEFAULT_RULES_CNT" -ge "1" ] \
  && assert "/default/rules returns >=1 rule" true \
  || assert "/default/rules returns >=1 rule" false "count=$DEFAULT_RULES_CNT"

# =============================================================================
header "SECTION E — Commune overrides"
# =============================================================================

# E01 list communes with overrides (none yet — all inherited)
run "list commune overrides: none yet (200)" \
  e01_list_communes.json 200 GET \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes

OVERRIDE_COUNT=$(jq '[.data[] | select(.hasOverride == true)] | length' "$OUTPUT_DIR/e01_list_communes.json")
[ "$OVERRIDE_COUNT" = "0" ] \
  && assert "no commune overrides yet" true \
  || assert "no commune overrides yet" false "overrides=$OVERRIDE_COUNT"

# E02 set commune override with custom home price
run "set commune override: homePrice=999 (200)" \
  e02_set_override.json 200 PUT \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID \
  '{"homePrice":999}'

# E03 verify override reflected
run "list commune overrides: verify (200)" \
  e03_verify_override.json 200 GET \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes

OVER_PRICE=$(jq --arg c "$TEST_COMMUNE_ID" '.data[] | select(.communeId==$c) | .effectiveHomePrice' "$OUTPUT_DIR/e03_verify_override.json")
[ "$OVER_PRICE" = "999" ] \
  && assert "commune effectiveHomePrice=999" true \
  || assert "commune effectiveHomePrice=999" false "got $OVER_PRICE"

# E04 disable home delivery for a different commune
run "set commune override: disable home (200)" \
  e04_disable_home.json 200 PUT \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID_2 \
  '{"homeEnabled":false}'

# E05 reset to inherit via PUT with all nulls → override row should be deleted
run "set commune override: all nulls deletes row (200)" \
  e05_reset_nulls.json 200 PUT \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID \
  '{"homePrice":null,"stopDeskPrice":null,"homeEnabled":null,"stopDeskEnabled":null}'

run "list commune overrides after null reset (200)" \
  e05b_list_after_reset.json 200 GET \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes

STILL_OVERRIDE=$(jq --arg c "$TEST_COMMUNE_ID" '.data[] | select(.communeId==$c) | .hasOverride' "$OUTPUT_DIR/e05b_list_after_reset.json")
[ "$STILL_OVERRIDE" = "false" ] \
  && assert "all-null PUT clears override row" true \
  || assert "all-null PUT clears override row" false "got $STILL_OVERRIDE"

# E06 DELETE the remaining override (for commune #2)
run "delete commune override (200)" \
  e06_delete_override.json 200 DELETE \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID_2

# E07 DELETE again → 404
run "delete commune override: twice (404)" \
  e07_delete_404.json 404 DELETE \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID_2

# E08 PUT override on a wilaya that has NO rule in this profile → 404
run "set override: no wilaya rule (404)" \
  e08_no_wilaya_rule.json 404 PUT \
  /api/shipping-profiles/$PROFILE_ID/rules/$UNCOVERED_WILAYA/communes/$TEST_COMMUNE_ID \
  '{"homePrice":100}'

# E09 GET communes for an uncovered wilaya → 404
run "list overrides: no wilaya rule (404)" \
  e09_list_no_rule.json 404 GET \
  /api/shipping-profiles/$PROFILE_ID/rules/$UNCOVERED_WILAYA/communes

# E10 PUT override with negative price → 400
run "set override: negative price (400)" \
  e10_neg_price.json 400 PUT \
  /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID \
  '{"homePrice":-1}'

# =============================================================================
header "SECTION F — Integration: orders + fee resolution"
# =============================================================================

# F01 create product that references PROFILE_ID (product-level override)
PROD_BODY=$(cat <<EOF
{
  "name": "Test Product $RAND",
  "price": 2500,
  "sku": "TP-$RAND",
  "status": "ACTIVE",
  "stock": 100,
  "shippingProfileId": "$PROFILE_ID"
}
EOF
)
run "create product with profile override (201)" \
  f01_create_product.json 201 POST /api/products "$PROD_BODY"

PRODUCT_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/f01_create_product.json")
if [ -z "$PRODUCT_ID" ]; then
  echo -e "${RED}Could not capture PRODUCT_ID — skipping integration tests${NC}"
else
  echo -e "${CYAN}  → PRODUCT_ID=$PRODUCT_ID${NC}"

  # F02 create customer
  CUST_BODY=$(cat <<EOF
{ "phone":"$CUSTOMER_PHONE", "name":"Test Customer$RAND", "wilayaId":$TEST_WILAYA }
EOF
)
  run "create customer (201)" \
    f02_create_customer.json 201 POST /api/customers "$CUST_BODY"
  CUST_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/f02_create_customer.json")

  # F03 online order → server IGNORES any deliveryFee hint and resolves from profile
  ORDER_BODY=$(cat <<EOF
{
  "customerId":"$CUST_ID",
  "customerName":"Test Customer$RAND",
  "phone":"$CUSTOMER_PHONE",
  "wilayaId":$TEST_WILAYA,
  "communeId":null,
  "price":2500,
  "orderType":"online",
  "deliveryType":"home",
  "deliveryFee":1,
  "products":[
    {"productId":"$PRODUCT_ID","productName":"Test Product $RAND","quantity":1,"pricePerUnit":2500,"lineTotal":2500}
  ]
}
EOF
)
  run "online order uses profile-resolved fee (201)" \
    f03_online_order.json 201 POST /api/orders "$ORDER_BODY"

  ONLINE_FEE=$(jq -r '.data.deliveryFee // empty' "$OUTPUT_DIR/f03_online_order.json")
  [ "$ONLINE_FEE" = "600" ] \
    && assert "online order deliveryFee = 600 (from profile)" true \
    || assert "online order deliveryFee = 600 (from profile)" false "got $ONLINE_FEE (expected 600, not user-supplied 1)"

  # F04 offline order w/ admin fee override — should respect the override
  OFFLINE_BODY=$(cat <<EOF
{
  "customerId":"$CUST_ID",
  "customerName":"Test Customer$RAND",
  "phone":"$CUSTOMER_PHONE",
  "wilayaId":$TEST_WILAYA,
  "communeId":null,
  "price":2500,
  "orderType":"offline",
  "deliveryType":"home",
  "deliveryFee":123,
  "products":[
    {"productId":"$PRODUCT_ID","productName":"Test Product $RAND","quantity":1,"pricePerUnit":2500,"lineTotal":2500}
  ]
}
EOF
)
  run "offline order respects admin fee override (201)" \
    f04_offline_order.json 201 POST /api/orders "$OFFLINE_BODY"

  OFFLINE_FEE=$(jq -r '.data.deliveryFee // empty' "$OUTPUT_DIR/f04_offline_order.json")
  [ "$OFFLINE_FEE" = "123" ] \
    && assert "offline order deliveryFee = 123 (admin override)" true \
    || assert "offline order deliveryFee = 123 (admin override)" false "got $OFFLINE_FEE"

  # F05 online order with wilaya that has NO rule → DELIVERY_NOT_AVAILABLE (422)
  BADWILAYA_BODY=$(cat <<EOF
{
  "customerId":"$CUST_ID",
  "customerName":"Test Customer$RAND",
  "phone":"$CUSTOMER_PHONE",
  "wilayaId":$UNCOVERED_WILAYA,
  "communeId":null,
  "price":2500,
  "orderType":"online",
  "deliveryType":"home",
  "products":[
    {"productId":"$PRODUCT_ID","productName":"Test Product $RAND","quantity":1,"pricePerUnit":2500,"lineTotal":2500}
  ]
}
EOF
)
  run "online order w/ uncovered wilaya (422)" \
    f05_uncovered_wilaya.json 422 POST /api/orders "$BADWILAYA_BODY"

  NOT_AVAILABLE_CODE=$(jq -r '.code // empty' "$OUTPUT_DIR/f05_uncovered_wilaya.json")
  [ "$NOT_AVAILABLE_CODE" = "DELIVERY_NOT_AVAILABLE" ] \
    && assert "code is DELIVERY_NOT_AVAILABLE" true \
    || assert "code is DELIVERY_NOT_AVAILABLE" false "code=$NOT_AVAILABLE_CODE"

  # F06 set commune override that disables home delivery, then order to that commune → 422
  run "disable home for commune #2 (200)" \
    f06a_disable.json 200 PUT \
    /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID_2 \
    '{"homeEnabled":false}'

  DISABLED_ORDER_BODY=$(cat <<EOF
{
  "customerId":"$CUST_ID",
  "customerName":"Test Customer$RAND",
  "phone":"$CUSTOMER_PHONE",
  "wilayaId":$TEST_WILAYA,
  "communeId":"$TEST_COMMUNE_ID_2",
  "price":2500,
  "orderType":"online",
  "deliveryType":"home",
  "products":[
    {"productId":"$PRODUCT_ID","productName":"Test Product $RAND","quantity":1,"pricePerUnit":2500,"lineTotal":2500}
  ]
}
EOF
)
  run "online home order to disabled commune (422)" \
    f06_home_disabled_commune.json 422 POST /api/orders "$DISABLED_ORDER_BODY"

  # reset override
  run "restore override (200)" \
    f06c_restore.json 200 DELETE \
    /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID_2

  # F07 override a commune with a custom home price; create order → fee should be the override
  run "set commune override: homePrice=1500 (200)" \
    f07a_price_override.json 200 PUT \
    /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID \
    '{"homePrice":1500,"homeEnabled":true,"stopDeskEnabled":true,"stopDeskPrice":800}'

  COMMUNE_ORDER_BODY=$(cat <<EOF
{
  "customerId":"$CUST_ID",
  "customerName":"Test Customer$RAND",
  "phone":"$CUSTOMER_PHONE",
  "wilayaId":$TEST_WILAYA,
  "communeId":"$TEST_COMMUNE_ID",
  "price":2500,
  "orderType":"online",
  "deliveryType":"home",
  "products":[
    {"productId":"$PRODUCT_ID","productName":"Test Product $RAND","quantity":1,"pricePerUnit":2500,"lineTotal":2500}
  ]
}
EOF
)
  run "order uses commune override fee (201)" \
    f07_commune_price.json 201 POST /api/orders "$COMMUNE_ORDER_BODY"

  COMMUNE_FEE=$(jq -r '.data.deliveryFee // empty' "$OUTPUT_DIR/f07_commune_price.json")
  [ "$COMMUNE_FEE" = "1500" ] \
    && assert "commune override fee applied (1500)" true \
    || assert "commune override fee applied (1500)" false "got $COMMUNE_FEE"

  # cleanup override
  run "cleanup commune override (200)" \
    f07c_cleanup.json 200 DELETE \
    /api/shipping-profiles/$PROFILE_ID/rules/$TEST_WILAYA/communes/$TEST_COMMUNE_ID
fi

# =============================================================================
header "SECTION G — Profile deletion guards"
# =============================================================================

# G01 cannot delete the default profile
run "delete default profile (422)" \
  g01_delete_default.json 422 DELETE /api/shipping-profiles/$DEFAULT_ID

DEFAULT_BLOCK_CODE=$(jq -r '.code // empty' "$OUTPUT_DIR/g01_delete_default.json")
[ "$DEFAULT_BLOCK_CODE" = "DEFAULT_PROFILE_REQUIRED" ] \
  && assert "default-delete code is DEFAULT_PROFILE_REQUIRED" true \
  || assert "default-delete code is DEFAULT_PROFILE_REQUIRED" false "got $DEFAULT_BLOCK_CODE"

# G02 cannot delete a profile in use by a product (PROFILE_ID is referenced by PRODUCT_ID)
if [ -n "${PRODUCT_ID:-}" ]; then
  run "delete profile in use by product (422)" \
    g02_delete_in_use.json 422 DELETE /api/shipping-profiles/$PROFILE_ID

  IN_USE_CODE=$(jq -r '.code // empty' "$OUTPUT_DIR/g02_delete_in_use.json")
  [ "$IN_USE_CODE" = "PROFILE_IN_USE" ] \
    && assert "in-use delete code is PROFILE_IN_USE" true \
    || assert "in-use delete code is PROFILE_IN_USE" false "got $IN_USE_CODE"

  # G03 attempt to delete product with orders — should fail (422)
  run "delete product with orders (422)" \
    g03_delete_product.json 422 DELETE /api/products/$PRODUCT_ID

  PRODUCT_BLOCK_CODE=$(jq -r '.code // empty' "$OUTPUT_DIR/g03_delete_product.json")
  [ "$PRODUCT_BLOCK_CODE" = "PRODUCT_HAS_ORDERS" ] \
    && assert "product-delete code is PRODUCT_HAS_ORDERS" true \
    || assert "product-delete code is PRODUCT_HAS_ORDERS" false "got $PRODUCT_BLOCK_CODE"

  # G04 profile still cannot be deleted (product still exists)
  run "delete profile: still in use (422)" \
    g04_delete_profile.json 422 DELETE /api/shipping-profiles/$PROFILE_ID

  STILL_IN_USE=$(jq -r '.code // empty' "$OUTPUT_DIR/g04_delete_profile.json")
  [ "$STILL_IN_USE" = "PROFILE_IN_USE" ] \
    && assert "profile still in use after product delete attempt" true \
    || assert "profile still in use after product delete attempt" false "got $STILL_IN_USE"
fi

# =============================================================================
header "SUMMARY"
# =============================================================================
echo ""
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo -e "${RED}Failing tests:${NC}"
  for f in "${FAIL_LIST[@]}"; do
    echo "  • $f"
  done
  exit 1
fi
echo -e "${GREEN}All shipping-profile tests passed.${NC}"
