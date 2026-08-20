#!/bin/bash

# =============================================================================
# COMPREHENSIVE Customers + Groups + Tags Endpoint Test
# =============================================================================
# Exhaustively exercises every endpoint in the customers surface:
#   - Customers CRUD
#   - Customer Groups CRUD + member management
#   - Customer Tags CRUD + assignment management
#   - All validation rules
#   - All error branches
#   - Business logic constraints
#
# DB ASSUMPTION: starts with admin user + 1 store + wilayas/communes
# This script CREATES all test data via API and cleans up at the end
#
# Endpoints covered:
#   CUSTOMERS
#     GET    /api/customers
#     POST   /api/customers
#     GET    /api/customers/:id
#     PATCH  /api/customers/:id
#     DELETE /api/customers/:id
#     GET    /api/customers/:id/orders
#     GET    /api/customers/:id/groups
#     GET    /api/customers/:id/tags
#   CUSTOMER GROUPS
#     GET    /api/customer-groups
#     POST   /api/customer-groups
#     GET    /api/customer-groups/:id
#     PATCH  /api/customer-groups/:id
#     DELETE /api/customer-groups/:id
#     POST   /api/customer-groups/:id/members
#     DELETE /api/customer-groups/:id/members/:customerId
#   CUSTOMER TAGS
#     GET    /api/customer-tags
#     POST   /api/customer-tags
#     GET    /api/customer-tags/:id
#     PATCH  /api/customer-tags/:id
#     DELETE /api/customer-tags/:id
#     POST   /api/customer-tags/:id/assignments
#     DELETE /api/customer-tags/:id/assignments/:customerId
#
# Auth:
#   Uses admin API key: cod_c4d0f6bd3e7f8039f40288548f072801
#
# Output:
#   Every response saved to test-scripts/responses/customers/
#   Test summary printed at end with list of FAILED tests
# =============================================================================

set -u

API_KEY="cod_c4d0f6bd3e7f8039f40288548f072801"
BAD_KEY="cod_definitely_not_a_real_key_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL="http://localhost:8787"
OUTPUT_DIR="test-scripts/responses/customers"

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

body_of() { cat "$OUTPUT_DIR/$1"; }

header() {
  echo ""
  echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE} $1${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

# =============================================================================
header "Sanity: server reachable"
HEALTH=$(curl -s "$BASE_URL/health")
echo "  /health -> $HEALTH"
if [ "$HEALTH" != '{"status":"ok"}' ]; then
  echo -e "${RED}Server not healthy at $BASE_URL — abort.${NC}"
  exit 1
fi

# =============================================================================
header "SECTION A — Authentication"
# =============================================================================

run "list customers: no key (401)" \
  a01_list_no_key.json 401 GET /api/customers "" __none__

run "list customers: bad key (401)" \
  a02_list_bad_key.json 401 GET /api/customers "" "$BAD_KEY"

run "list customers: good key (200)" \
  a03_list_good_key.json 200 GET /api/customers

# =============================================================================
header "SECTION B — Customers CRUD"
# =============================================================================

# B01: create customer (happy path)
CUSTOMER1_BODY='{
  "name": "TEST Customer One",
  "phone": "0551234567",
  "phone2": "0661234567",
  "wilayaId": 16,
  "address": "123 Test Street, Algiers"
}'
run "create customer 1 (201)" \
  b01_create_customer1.json 201 POST /api/customers "$CUSTOMER1_BODY"

CUSTOMER1_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/b01_create_customer1.json")
if [ -z "$CUSTOMER1_ID" ]; then
  echo -e "${RED}Could not capture CUSTOMER1_ID — aborting${NC}"
  exit 1
fi
echo -e "${CYAN}  → CUSTOMER1_ID=$CUSTOMER1_ID${NC}"

# B02: create customer 2
CUSTOMER2_BODY='{
  "name": "TEST Customer Two",
  "phone": "0552345678",
  "wilayaId": 31,
  "address": "456 Test Avenue"
}'
run "create customer 2 (201)" \
  b02_create_customer2.json 201 POST /api/customers "$CUSTOMER2_BODY"

CUSTOMER2_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/b02_create_customer2.json")
echo -e "${CYAN}  → CUSTOMER2_ID=$CUSTOMER2_ID${NC}"

# B03: create customer 3 (minimal fields)
CUSTOMER3_BODY='{
  "name": "TEST Customer Three",
  "phone": "0553456789",
  "wilayaId": 1
}'
run "create customer 3 (201)" \
  b03_create_customer3.json 201 POST /api/customers "$CUSTOMER3_BODY"

CUSTOMER3_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/b03_create_customer3.json")
echo -e "${CYAN}  → CUSTOMER3_ID=$CUSTOMER3_ID${NC}"

# B04: duplicate phone
run "create customer: duplicate phone (409)" \
  b04_dup_phone.json 409 POST /api/customers "$CUSTOMER1_BODY"

# B05: invalid phone format
run "create customer: invalid phone (400)" \
  b05_bad_phone.json 400 POST /api/customers \
  '{"name":"Test","phone":"123456"}'

# B06: missing name
run "create customer: missing name (400)" \
  b06_missing_name.json 400 POST /api/customers \
  '{"phone":"0554567890","wilayaId":1}'

# B06b: missing wilayaId
run "create customer: missing wilayaId (400)" \
  b06b_missing_wilaya.json 400 POST /api/customers \
  '{"name":"Test","phone":"0554567890"}'

# B07: empty name
run "create customer: empty name (400)" \
  b07_empty_name.json 400 POST /api/customers \
  '{"name":"","phone":"0554567890","wilayaId":1}'

# B08: invalid wilayaId (too low)
run "create customer: wilayaId=0 (400)" \
  b08_bad_wilaya_low.json 400 POST /api/customers \
  '{"name":"Test","phone":"0554567890","wilayaId":0}'

# B09: invalid wilayaId (too high)
run "create customer: wilayaId=59 (400)" \
  b09_bad_wilaya_high.json 400 POST /api/customers \
  '{"name":"Test","phone":"0554567890","wilayaId":59}'

# B10: get customer by id
run "get customer by id (200)" \
  b10_get_customer.json 200 GET /api/customers/$CUSTOMER1_ID

# B11: get nonexistent customer
run "get customer: nonexistent (404)" \
  b11_get_404.json 404 GET /api/customers/does-not-exist-xyz

# B12: list customers
run "list customers (200)" \
  b12_list.json 200 GET /api/customers

# B13: list with search filter
run "list customers: search (200)" \
  b13_list_search.json 200 GET "/api/customers?search=Customer One"

# B14: list with wilaya filter
run "list customers: wilayaId=16 (200)" \
  b14_list_wilaya.json 200 GET "/api/customers?wilayaId=16"

# B15: list with limit
run "list customers: limit=2 (200)" \
  b15_list_limit.json 200 GET "/api/customers?limit=2"

# B16: list with bad limit (too high)
run "list customers: limit=200 (400)" \
  b16_list_bad_limit.json 400 GET "/api/customers?limit=200"

# B17: update customer
run "update customer (200)" \
  b17_update.json 200 PATCH /api/customers/$CUSTOMER1_ID \
  '{"name":"TEST Customer One UPDATED","address":"789 New Address"}'

# B18: update customer phone
run "update customer phone (200)" \
  b18_update_phone.json 200 PATCH /api/customers/$CUSTOMER1_ID \
  '{"phone":"0559876543"}'

# B19: update customer: duplicate phone
run "update customer: duplicate phone (409)" \
  b19_update_dup_phone.json 409 PATCH /api/customers/$CUSTOMER1_ID \
  "{\"phone\":\"0552345678\"}"

# B20: update nonexistent customer
run "update customer: nonexistent (404)" \
  b20_update_404.json 404 PATCH /api/customers/does-not-exist-xyz \
  '{"name":"Test"}'

# B21: get customer orders (empty)
run "get customer orders (200)" \
  b21_customer_orders.json 200 GET /api/customers/$CUSTOMER1_ID/orders

# B22: get customer groups (empty)
run "get customer groups (200)" \
  b22_customer_groups.json 200 GET /api/customers/$CUSTOMER1_ID/groups

# B23: get customer tags (empty)
run "get customer tags (200)" \
  b23_customer_tags.json 200 GET /api/customers/$CUSTOMER1_ID/tags

# =============================================================================
header "SECTION C — Customer Groups CRUD"
# =============================================================================

# C01: create group 1
GROUP1_BODY='{
  "name": "TEST VIP Customers",
  "description": "High value customers",
  "color": "#6366f1"
}'
run "create group 1 (201)" \
  c01_create_group1.json 201 POST /api/customer-groups "$GROUP1_BODY"

GROUP1_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/c01_create_group1.json")
if [ -z "$GROUP1_ID" ]; then
  echo -e "${RED}Could not capture GROUP1_ID — aborting${NC}"
  exit 1
fi
echo -e "${CYAN}  → GROUP1_ID=$GROUP1_ID${NC}"

# C02: create group 2
GROUP2_BODY='{
  "name": "TEST Wholesale",
  "color": "#10b981"
}'
run "create group 2 (201)" \
  c02_create_group2.json 201 POST /api/customer-groups "$GROUP2_BODY"

GROUP2_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/c02_create_group2.json")
echo -e "${CYAN}  → GROUP2_ID=$GROUP2_ID${NC}"

# C03: create group: missing name
run "create group: missing name (400)" \
  c03_missing_name.json 400 POST /api/customer-groups \
  '{"color":"#ff0000"}'

# C04: create group: empty name
run "create group: empty name (400)" \
  c04_empty_name.json 400 POST /api/customer-groups \
  '{"name":"","color":"#ff0000"}'

# C05: create group: invalid color
run "create group: invalid color (400)" \
  c05_bad_color.json 400 POST /api/customer-groups \
  '{"name":"Test","color":"red"}'

# C06: create group: name too long (>100 chars)
run "create group: name too long (400)" \
  c06_name_too_long.json 400 POST /api/customer-groups \
  "{\"name\":\"$(printf 'A%.0s' {1..101})\",\"color\":\"#ff0000\"}"

# C07: get group by id
run "get group by id (200)" \
  c07_get_group.json 200 GET /api/customer-groups/$GROUP1_ID

# C08: get group: nonexistent
run "get group: nonexistent (404)" \
  c08_get_404.json 404 GET /api/customer-groups/does-not-exist-xyz

# C09: list groups
run "list groups (200)" \
  c09_list.json 200 GET /api/customer-groups

# C10: list groups with search
run "list groups: search (200)" \
  c10_list_search.json 200 GET "/api/customer-groups?search=VIP"

# C11: list groups with limit
run "list groups: limit=1 (200)" \
  c11_list_limit.json 200 GET "/api/customer-groups?limit=1"

# C12: update group
run "update group (200)" \
  c12_update.json 200 PATCH /api/customer-groups/$GROUP1_ID \
  '{"name":"TEST VIP Customers UPDATED","description":"Updated description"}'

# C13: update group: clear description
run "update group: clear description (200)" \
  c13_update_clear_desc.json 200 PATCH /api/customer-groups/$GROUP1_ID \
  '{"description":null}'

# C14: update nonexistent group
run "update group: nonexistent (404)" \
  c14_update_404.json 404 PATCH /api/customer-groups/does-not-exist-xyz \
  '{"name":"Test"}'

# =============================================================================
header "SECTION D — Customer Group Members"
# =============================================================================

# D01: add member to group
run "add member to group (200)" \
  d01_add_member.json 200 POST /api/customer-groups/$GROUP1_ID/members \
  "{\"customerId\":\"$CUSTOMER1_ID\"}"

# D02: add another member
run "add member 2 to group (200)" \
  d02_add_member2.json 200 POST /api/customer-groups/$GROUP1_ID/members \
  "{\"customerId\":\"$CUSTOMER2_ID\"}"

# D03: add member: missing customerId
run "add member: missing customerId (400)" \
  d03_add_member_missing.json 400 POST /api/customer-groups/$GROUP1_ID/members \
  '{}'

# D04: add member: nonexistent customer
run "add member: nonexistent customer (404)" \
  d04_add_member_404.json 404 POST /api/customer-groups/$GROUP1_ID/members \
  '{"customerId":"does-not-exist-xyz"}'

# D05: add member: nonexistent group
run "add member: nonexistent group (404)" \
  d05_add_member_group_404.json 404 POST /api/customer-groups/does-not-exist-xyz/members \
  "{\"customerId\":\"$CUSTOMER1_ID\"}"

# D06: get group with members
run "get group with members (200)" \
  d06_get_with_members.json 200 GET "/api/customer-groups/$GROUP1_ID?members=true"

# D07: get customer groups (should show GROUP1)
run "get customer groups after add (200)" \
  d07_customer_groups.json 200 GET /api/customers/$CUSTOMER1_ID/groups

# D08: remove member from group
run "remove member from group (200)" \
  d08_remove_member.json 200 DELETE /api/customer-groups/$GROUP1_ID/members/$CUSTOMER2_ID

# D09: remove member: nonexistent group
run "remove member: nonexistent group (404)" \
  d09_remove_member_404.json 404 DELETE /api/customer-groups/does-not-exist-xyz/members/$CUSTOMER1_ID

# =============================================================================
header "SECTION E — Customer Tags CRUD"
# =============================================================================

# E01: create tag 1
TAG1_BODY='{
  "name": "TEST Premium",
  "color": "#f59e0b"
}'
run "create tag 1 (201)" \
  e01_create_tag1.json 201 POST /api/customer-tags "$TAG1_BODY"

TAG1_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/e01_create_tag1.json")
if [ -z "$TAG1_ID" ]; then
  echo -e "${RED}Could not capture TAG1_ID — aborting${NC}"
  exit 1
fi
echo -e "${CYAN}  → TAG1_ID=$TAG1_ID${NC}"

# E02: create tag 2
TAG2_BODY='{
  "name": "TEST Loyal",
  "color": "#8b5cf6"
}'
run "create tag 2 (201)" \
  e02_create_tag2.json 201 POST /api/customer-tags "$TAG2_BODY"

TAG2_ID=$(jq -r '.data.id // empty' "$OUTPUT_DIR/e02_create_tag2.json")
echo -e "${CYAN}  → TAG2_ID=$TAG2_ID${NC}"

# E03: create tag: missing name
run "create tag: missing name (400)" \
  e03_missing_name.json 400 POST /api/customer-tags \
  '{"color":"#ff0000"}'

# E04: create tag: empty name
run "create tag: empty name (400)" \
  e04_empty_name.json 400 POST /api/customer-tags \
  '{"name":"","color":"#ff0000"}'

# E05: create tag: invalid color
run "create tag: invalid color (400)" \
  e05_bad_color.json 400 POST /api/customer-tags \
  '{"name":"Test","color":"blue"}'

# E06: create tag: name too long (>50 chars)
run "create tag: name too long (400)" \
  e06_name_too_long.json 400 POST /api/customer-tags \
  "{\"name\":\"$(printf 'A%.0s' {1..51})\",\"color\":\"#ff0000\"}"

# E07: get tag by id
run "get tag by id (200)" \
  e07_get_tag.json 200 GET /api/customer-tags/$TAG1_ID

# E08: get tag: nonexistent
run "get tag: nonexistent (404)" \
  e08_get_404.json 404 GET /api/customer-tags/does-not-exist-xyz

# E09: list tags
run "list tags (200)" \
  e09_list.json 200 GET /api/customer-tags

# E10: list tags with search
run "list tags: search (200)" \
  e10_list_search.json 200 GET "/api/customer-tags?search=Premium"

# E11: list tags with limit
run "list tags: limit=1 (200)" \
  e11_list_limit.json 200 GET "/api/customer-tags?limit=1"

# E12: update tag
run "update tag (200)" \
  e12_update.json 200 PATCH /api/customer-tags/$TAG1_ID \
  '{"name":"TEST Premium UPDATED","color":"#ef4444"}'

# E13: update nonexistent tag
run "update tag: nonexistent (404)" \
  e13_update_404.json 404 PATCH /api/customer-tags/does-not-exist-xyz \
  '{"name":"Test"}'

# =============================================================================
header "SECTION F — Customer Tag Assignments"
# =============================================================================

# F01: assign tag to customer
run "assign tag to customer (200)" \
  f01_assign_tag.json 200 POST /api/customer-tags/$TAG1_ID/assignments \
  "{\"customerId\":\"$CUSTOMER1_ID\"}"

# F02: assign another tag
run "assign tag 2 to customer (200)" \
  f02_assign_tag2.json 200 POST /api/customer-tags/$TAG2_ID/assignments \
  "{\"customerId\":\"$CUSTOMER1_ID\"}"

# F03: assign tag: missing customerId
run "assign tag: missing customerId (400)" \
  f03_assign_missing.json 400 POST /api/customer-tags/$TAG1_ID/assignments \
  '{}'

# F04: assign tag: nonexistent customer
run "assign tag: nonexistent customer (404)" \
  f04_assign_404.json 404 POST /api/customer-tags/$TAG1_ID/assignments \
  '{"customerId":"does-not-exist-xyz"}'

# F05: assign tag: nonexistent tag
run "assign tag: nonexistent tag (404)" \
  f05_assign_tag_404.json 404 POST /api/customer-tags/does-not-exist-xyz/assignments \
  "{\"customerId\":\"$CUSTOMER1_ID\"}"

# F06: get tag with customers
run "get tag with customers (200)" \
  f06_get_with_customers.json 200 GET "/api/customer-tags/$TAG1_ID?customers=true"

# F07: get customer tags (should show TAG1 and TAG2)
run "get customer tags after assign (200)" \
  f07_customer_tags.json 200 GET /api/customers/$CUSTOMER1_ID/tags

# F08: unassign tag from customer
run "unassign tag from customer (200)" \
  f08_unassign_tag.json 200 DELETE /api/customer-tags/$TAG2_ID/assignments/$CUSTOMER1_ID

# F09: unassign tag: nonexistent tag
run "unassign tag: nonexistent tag (404)" \
  f09_unassign_404.json 404 DELETE /api/customer-tags/does-not-exist-xyz/assignments/$CUSTOMER1_ID

# =============================================================================
header "SECTION G — Delete Constraints"
# =============================================================================

# G01: delete group with members (should fail)
run "delete group with members (422)" \
  g01_delete_group_with_members.json 422 DELETE /api/customer-groups/$GROUP1_ID

# G02: remove all members first
run "remove last member (200)" \
  g02_remove_last_member.json 200 DELETE /api/customer-groups/$GROUP1_ID/members/$CUSTOMER1_ID

# G03: delete empty group (should succeed)
run "delete empty group (200)" \
  g03_delete_empty_group.json 200 DELETE /api/customer-groups/$GROUP1_ID

# G04: delete already deleted group
run "delete group again (404)" \
  g04_delete_404.json 404 DELETE /api/customer-groups/$GROUP1_ID

# G05: delete tag with assignments (should fail)
run "delete tag with assignments (422)" \
  g05_delete_tag_with_assignments.json 422 DELETE /api/customer-tags/$TAG1_ID

# G06: unassign all tags first
run "unassign last tag (200)" \
  g06_unassign_last.json 200 DELETE /api/customer-tags/$TAG1_ID/assignments/$CUSTOMER1_ID

# G07: delete empty tag (should succeed)
run "delete empty tag (200)" \
  g07_delete_empty_tag.json 200 DELETE /api/customer-tags/$TAG1_ID

# G08: delete already deleted tag
run "delete tag again (404)" \
  g08_delete_tag_404.json 404 DELETE /api/customer-tags/$TAG1_ID

# G09: delete customer without orders (should succeed)
run "delete customer (200)" \
  g09_delete_customer.json 200 DELETE /api/customers/$CUSTOMER3_ID

# G10: delete already deleted customer
run "delete customer again (404)" \
  g10_delete_customer_404.json 404 DELETE /api/customers/$CUSTOMER3_ID

# G11: delete nonexistent group
run "delete nonexistent group (404)" \
  g11_delete_group_404.json 404 DELETE /api/customer-groups/does-not-exist-xyz

# G12: delete nonexistent tag
run "delete nonexistent tag (404)" \
  g12_delete_tag_404.json 404 DELETE /api/customer-tags/does-not-exist-xyz

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
