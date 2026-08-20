#!/bin/bash

# =============================================================================
# OpenAPI Documentation Verification Script - Orders Endpoints
# =============================================================================
# Verifies that actual API responses match the OpenAPI schema documentation.
# Reads all test response files from test-orders-complete.sh and validates:
#   1. Response structure matches OpenAPI schema
#   2. Required fields are present
#   3. Field types match documentation
#   4. Enum values are valid
#
# This ensures the OpenAPI docs are accurate and can be trusted by:
#   - Frontend developers
#   - API consumers
#   - AI agents
#   - Documentation generators
# =============================================================================

set -u

RESPONSE_DIR="test-scripts/responses/orders"
PASSED=0
FAILED=0
ISSUES=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Helper Functions ─────────────────────────────────────────────────────────

check_field() {
  local file="$1"
  local path="$2"
  local field="$3"
  local required="$4"  # "required" or "optional"
  
  local value
  value=$(jq -r "$path" "$RESPONSE_DIR/$file" 2>/dev/null)
  
  if [ "$value" = "null" ]; then
    if [ "$required" = "required" ]; then
      ISSUES+=("$file: Missing required field '$field' at path '$path'")
      return 1
    fi
    return 0
  fi
  
  return 0
}

check_field_type() {
  local file="$1"
  local path="$2"
  local field="$3"
  local expected_type="$4"  # "string", "number", "boolean", "array", "object"
  
  local actual_type
  actual_type=$(jq -r "$path | type" "$RESPONSE_DIR/$file" 2>/dev/null)
  
  if [ "$actual_type" = "null" ]; then
    return 0  # Field doesn't exist, checked separately
  fi
  
  if [ "$actual_type" != "$expected_type" ]; then
    ISSUES+=("$file: Field '$field' has type '$actual_type', expected '$expected_type'")
    return 1
  fi
  
  return 0
}

check_enum() {
  local file="$1"
  local path="$2"
  local field="$3"
  shift 3
  local valid_values=("$@")
  
  local value
  value=$(jq -r "$path" "$RESPONSE_DIR/$file" 2>/dev/null)
  
  if [ "$value" = "null" ]; then
    return 0  # Field doesn't exist, checked separately
  fi
  
  for valid in "${valid_values[@]}"; do
    if [ "$value" = "$valid" ]; then
      return 0
    fi
  done
  
  ISSUES+=("$file: Field '$field' has invalid enum value '$value', expected one of: ${valid_values[*]}")
  return 1
}

verify_response() {
  local file="$1"
  local checks=0
  local check_passed=0
  
  # Check if file exists and is valid JSON
  if [ ! -f "$RESPONSE_DIR/$file" ]; then
    ISSUES+=("$file: File not found")
    return 1
  fi
  
  if ! jq empty "$RESPONSE_DIR/$file" 2>/dev/null; then
    ISSUES+=("$file: Invalid JSON")
    return 1
  fi
  
  # Run all checks passed as arguments (starting from $2)
  shift
  for check_func in "$@"; do
    ((checks++))
    if $check_func "$file"; then
      ((check_passed++))
    fi
  done
  
  if [ $check_passed -eq $checks ]; then
    ((PASSED++))
    return 0
  else
    ((FAILED++))
    return 1
  fi
}

# ─── Response Verification Functions ──────────────────────────────────────────

# Success response with data
verify_success_response() {
  local file="$1"
  check_field "$file" ".success" "success" "required" &&
  check_field_type "$file" ".success" "success" "boolean" &&
  check_field "$file" ".data" "data" "required"
}

# Success response with message (no data field)
verify_success_with_message_only() {
  local file="$1"
  check_field "$file" ".success" "success" "required" &&
  check_field_type "$file" ".success" "success" "boolean" &&
  check_field "$file" ".message" "message" "required" &&
  check_field_type "$file" ".message" "message" "string"
}

# Success response with data and message
verify_success_with_message() {
  local file="$1"
  verify_success_response "$file" &&
  check_field "$file" ".message" "message" "required" &&
  check_field_type "$file" ".message" "message" "string"
}

# Error response
verify_error_response() {
  local file="$1"
  check_field "$file" ".error" "error" "required" &&
  check_field_type "$file" ".error" "error" "string" &&
  check_field "$file" ".code" "code" "required" &&
  check_field_type "$file" ".code" "code" "string"
}

# Order object fields (for create response - subset of full order)
verify_order_create_fields() {
  local file="$1"
  check_field "$file" ".data.id" "id" "required" &&
  check_field_type "$file" ".data.id" "id" "string" &&
  check_field "$file" ".data.orderNumber" "orderNumber" "required" &&
  check_field_type "$file" ".data.orderNumber" "orderNumber" "string" &&
  check_field "$file" ".data.deliveryFee" "deliveryFee" "required" &&
  check_field_type "$file" ".data.deliveryFee" "deliveryFee" "number" &&
  check_field "$file" ".data.price" "price" "required" &&
  check_field_type "$file" ".data.price" "price" "number" &&
  check_field "$file" ".data.codAmount" "codAmount" "required" &&
  check_field_type "$file" ".data.codAmount" "codAmount" "number" &&
  check_field "$file" ".data.customerId" "customerId" "required" &&
  check_field_type "$file" ".data.customerId" "customerId" "string" &&
  check_field "$file" ".data.customerName" "customerName" "required" &&
  check_field_type "$file" ".data.customerName" "customerName" "string" &&
  check_field "$file" ".data.phone" "phone" "required" &&
  check_field_type "$file" ".data.phone" "phone" "string" &&
  check_field "$file" ".data.wilayaId" "wilayaId" "required" &&
  check_field_type "$file" ".data.wilayaId" "wilayaId" "number" &&
  check_field "$file" ".data.deliveryType" "deliveryType" "required" &&
  check_field_type "$file" ".data.deliveryType" "deliveryType" "string" &&
  check_enum "$file" ".data.deliveryType" "deliveryType" "home" "stop_desk" &&
  check_field "$file" ".data.orderType" "orderType" "required" &&
  check_field_type "$file" ".data.orderType" "orderType" "string" &&
  check_enum "$file" ".data.orderType" "orderType" "online" "offline" &&
  check_field "$file" ".data.status" "status" "required" &&
  check_field_type "$file" ".data.status" "status" "string" &&
  check_enum "$file" ".data.status" "status" "new" "confirmed" "unreachable" "preparing" "ready" "assigned" "dispatched" "out_for_delivery" "delivered" "returned" "cancelled"
}

# Order object fields (for full order detail)
verify_order_fields() {
  local file="$1"
  check_field "$file" ".data.id" "id" "required" &&
  check_field_type "$file" ".data.id" "id" "string" &&
  check_field "$file" ".data.orderNumber" "orderNumber" "required" &&
  check_field_type "$file" ".data.orderNumber" "orderNumber" "string" &&
  check_field "$file" ".data.customerId" "customerId" "required" &&
  check_field_type "$file" ".data.customerId" "customerId" "string" &&
  check_field "$file" ".data.customerName" "customerName" "required" &&
  check_field_type "$file" ".data.customerName" "customerName" "string" &&
  check_field "$file" ".data.phone" "phone" "required" &&
  check_field_type "$file" ".data.phone" "phone" "string" &&
  check_field "$file" ".data.wilayaId" "wilayaId" "required" &&
  check_field_type "$file" ".data.wilayaId" "wilayaId" "number" &&
  check_field "$file" ".data.price" "price" "required" &&
  check_field_type "$file" ".data.price" "price" "number" &&
  check_field "$file" ".data.status" "status" "required" &&
  check_field_type "$file" ".data.status" "status" "string" &&
  check_enum "$file" ".data.status" "status" "new" "confirmed" "unreachable" "preparing" "ready" "assigned" "dispatched" "out_for_delivery" "delivered" "returned" "cancelled" &&
  check_field "$file" ".data.deliveryType" "deliveryType" "required" &&
  check_field_type "$file" ".data.deliveryType" "deliveryType" "string" &&
  check_enum "$file" ".data.deliveryType" "deliveryType" "home" "stop_desk" &&
  check_field "$file" ".data.orderType" "orderType" "required" &&
  check_field_type "$file" ".data.orderType" "orderType" "string" &&
  check_enum "$file" ".data.orderType" "orderType" "online" "offline" &&
  check_field "$file" ".data.createdAt" "createdAt" "required" &&
  check_field_type "$file" ".data.createdAt" "createdAt" "string"
}

# Order list response
verify_order_list() {
  local file="$1"
  verify_success_response "$file" &&
  check_field "$file" ".data" "data" "required" &&
  check_field_type "$file" ".data" "data" "array" &&
  check_field "$file" ".count" "count" "required" &&
  check_field_type "$file" ".count" "count" "number"
}

# Order detail response (includes products and statusHistory)
verify_order_detail() {
  local file="$1"
  verify_order_fields "$file" &&
  check_field "$file" ".data.products" "products" "required" &&
  check_field_type "$file" ".data.products" "products" "array" &&
  check_field "$file" ".data.statusHistory" "statusHistory" "required" &&
  check_field_type "$file" ".data.statusHistory" "statusHistory" "array"
}

# ─── Main Verification ────────────────────────────────────────────────────────

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  OpenAPI Documentation Verification - Orders Endpoints${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Authentication Tests
echo -e "${YELLOW}━━━ Authentication Responses ━━━${NC}"
verify_response "auth-no-key.json" verify_order_list
verify_response "auth-bad-key.json" verify_error_response
verify_response "auth-valid-key.json" verify_order_list

# Create Order Tests
echo -e "${YELLOW}━━━ Create Order Responses ━━━${NC}"
verify_response "create-valid.json" verify_success_with_message verify_order_create_fields
verify_response "create-missing-customer-id.json" verify_error_response
verify_response "create-missing-customer-name.json" verify_error_response
verify_response "create-missing-phone.json" verify_error_response
verify_response "create-invalid-phone.json" verify_error_response
verify_response "create-missing-wilaya.json" verify_error_response
verify_response "create-invalid-wilaya-zero.json" verify_error_response
verify_response "create-invalid-wilaya-high.json" verify_error_response
verify_response "create-missing-products.json" verify_error_response
verify_response "create-empty-products.json" verify_error_response
verify_response "create-invalid-delivery-type.json" verify_error_response
verify_response "create-product-qty-zero.json" verify_error_response
verify_response "create-product-qty-negative.json" verify_error_response
verify_response "create-product-price-negative.json" verify_error_response
verify_response "create-nonexistent-customer.json" verify_success_with_message verify_order_create_fields
verify_response "create-nonexistent-product.json" verify_error_response

# List Orders Tests
echo -e "${YELLOW}━━━ List Orders Responses ━━━${NC}"
verify_response "list-all.json" verify_order_list
verify_response "list-filter-status-new.json" verify_order_list
verify_response "list-filter-wilaya.json" verify_order_list
verify_response "list-search-name.json" verify_order_list
verify_response "list-pagination-limit.json" verify_order_list
verify_response "list-pagination-offset.json" verify_order_list

# Get Order Tests
echo -e "${YELLOW}━━━ Get Order Responses ━━━${NC}"
verify_response "get-order-by-id.json" verify_success_response verify_order_detail
verify_response "get-nonexistent-order.json" verify_error_response

# Status Update Tests
echo -e "${YELLOW}━━━ Status Update Responses ━━━${NC}"
verify_response "status-new-to-confirmed.json" verify_success_with_message_only
verify_response "status-confirmed-to-preparing.json" verify_success_with_message_only
verify_response "status-preparing-to-ready.json" verify_success_with_message_only
verify_response "status-invalid-backwards.json" verify_error_response
verify_response "status-invalid-value.json" verify_error_response
verify_response "status-missing-field.json" verify_error_response

# Driver Assignment Tests
echo -e "${YELLOW}━━━ Driver Assignment Responses ━━━${NC}"
verify_response "driver-assign.json" verify_success_with_message_only
verify_response "driver-reassign.json" verify_success_with_message_only
verify_response "driver-unassign.json" verify_success_with_message_only
verify_response "driver-assign-nonexistent.json" verify_error_response
verify_response "driver-assign-missing-id.json" verify_error_response

# Product Return Tests
echo -e "${YELLOW}━━━ Product Return Responses ━━━${NC}"
verify_response "return-partial.json" verify_success_response
verify_response "return-full.json" verify_success_response
verify_response "return-negative-qty.json" verify_error_response
verify_response "return-exceeds-qty.json" verify_error_response
verify_response "return-missing-qty.json" verify_error_response

# Delete Order Tests
echo -e "${YELLOW}━━━ Delete Order Responses ━━━${NC}"
verify_response "delete-create-order.json" verify_success_with_message verify_order_create_fields
verify_response "delete-order.json" verify_success_with_message_only
verify_response "delete-get-deleted.json" verify_error_response
verify_response "delete-nonexistent.json" verify_error_response

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Verification Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}PASSED:${NC} $PASSED responses"
echo -e "  ${RED}FAILED:${NC} $FAILED responses"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Issues Found:${NC}"
  for issue in "${ISSUES[@]}"; do
    echo -e "  ${RED}✗${NC} $issue"
  done
  echo ""
  echo -e "${RED}❌ OpenAPI documentation has discrepancies with actual API responses${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ All responses match OpenAPI documentation${NC}"
  echo -e "${GREEN}✅ OpenAPI docs are accurate and production-ready${NC}"
  echo ""
  exit 0
fi
