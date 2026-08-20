# ErrorModal Integration Test Plan

## Overview
This document outlines the manual testing plan for ErrorModal integration in UI components.

## Components Updated

### 1. CustomersView (`cod-client/components/customers/customers-view.tsx`)
- **Integration**: ErrorModal for delete operations
- **Error Scenarios**:
  - Business logic error: Customer has existing orders (CUSTOMER_HAS_ORDERS)
  - Unexpected errors during delete operation

### 2. DriversView (`cod-client/components/delivery/drivers-view.tsx`)
- **Integration**: ErrorModal for delete operations
- **Error Scenarios**:
  - Business logic error: Driver has active orders (DRIVER_HAS_ACTIVE_ORDERS)
  - Unexpected errors during delete operation

### 3. ProductsView (`cod-client/components/products/products-view.tsx`)
- **Integration**: ErrorModal for delete operations
- **Error Scenarios**:
  - Unexpected errors during delete operation

### 4. OrderDetailView (`cod-client/components/orders/order-detail-view.tsx`)
- **Integration**: ErrorModal for critical order operations
- **Error Scenarios**:
  - Status update failures
  - Order deletion failures

### 5. AssignOrdersDialog (`cod-client/components/delivery/assign-orders-dialog.tsx`)
- **Integration**: ErrorModal for driver assignment failures
- **Error Scenarios**:
  - Assignment failures (e.g., ORDER_ALREADY_DISPATCHED, DRIVER_ALREADY_ASSIGNED)

### 6. AssignDriverDialog (`cod-client/components/orders/orders-table.tsx`)
- **Integration**: ErrorModal for driver assignment in orders table
- **Error Scenarios**:
  - Assignment failures

### 7. DispatchCompanyDialog (`cod-client/components/orders/orders-table.tsx`)
- **Integration**: ErrorModal for dispatch operations
- **Error Scenarios**:
  - Dispatch failures (e.g., MISSING_WILAYA_COMMUNE, MISSING_STATION_CODE)

## Test Scenarios

### Test 1: Customer Delete with Orders (English)
**Steps**:
1. Navigate to Customers page
2. Try to delete a customer with existing orders
3. Verify ErrorModal displays with:
   - English error message
   - Error code: CUSTOMER_HAS_ORDERS
   - Close button visible (non-critical error)
   - LTR text direction

**Expected Result**: Modal shows "Cannot delete customer with existing orders" message

### Test 2: Customer Delete with Orders (Arabic)
**Steps**:
1. Switch language to Arabic
2. Navigate to Customers page
3. Try to delete a customer with existing orders
4. Verify ErrorModal displays with:
   - Arabic error message
   - RTL text direction
   - Arabic button labels (إغلاق)

**Expected Result**: Modal shows Arabic error message with proper RTL layout

### Test 3: Driver Delete with Active Orders (English)
**Steps**:
1. Navigate to Delivery > Drivers
2. Try to delete a driver with active orders
3. Verify ErrorModal displays with:
   - English error message
   - Error code: DRIVER_HAS_ACTIVE_ORDERS
   - Close button visible

**Expected Result**: Modal shows error preventing driver deletion

### Test 4: Order Status Update Failure
**Steps**:
1. Navigate to an order detail page
2. Try to advance order status (simulate failure)
3. Verify ErrorModal displays with error message

**Expected Result**: Modal shows status update error

### Test 5: Driver Assignment Failure
**Steps**:
1. Navigate to Orders page
2. Try to assign a driver to an already dispatched order
3. Verify ErrorModal displays with:
   - Error message explaining the conflict
   - Error code (if available)

**Expected Result**: Modal shows assignment conflict error

### Test 6: Dispatch Failure - Missing Station Code
**Steps**:
1. Navigate to Orders page
2. Try to dispatch a stop-desk order without station code
3. Verify ErrorModal displays with:
   - Error message about missing station code
   - Error code: MISSING_STATION_CODE

**Expected Result**: Modal shows validation error for missing station code

### Test 7: Modal Action Buttons (English)
**Steps**:
1. Trigger an error with retry capability
2. Verify button order (LTR):
   - Contact Support (left)
   - Cancel (middle)
   - Retry (right)
3. Click Retry button
4. Verify retry action is triggered

**Expected Result**: Buttons display in correct LTR order and function properly

### Test 8: Modal Action Buttons (Arabic)
**Steps**:
1. Switch to Arabic
2. Trigger an error with retry capability
3. Verify button order (RTL):
   - Retry (left in RTL = right visually)
   - Cancel (middle)
   - Contact Support (right in RTL = left visually)
4. Verify Arabic button labels

**Expected Result**: Buttons display in correct RTL order with Arabic labels

### Test 9: Critical Error (No Dismissal)
**Steps**:
1. Trigger a critical error (e.g., PERMISSION_DENIED)
2. Verify:
   - Close button is NOT visible
   - Modal cannot be dismissed by clicking outside
   - Only action buttons are available

**Expected Result**: Modal cannot be dismissed for critical errors

### Test 10: Non-Critical Error (Dismissal Allowed)
**Steps**:
1. Trigger a non-critical error (e.g., CUSTOMER_HAS_ORDERS)
2. Verify:
   - Close button IS visible
   - Modal can be dismissed by clicking Close
   - Modal can be dismissed by clicking outside (if configured)

**Expected Result**: Modal can be dismissed for non-critical errors

## Locale Testing

### English Locale
- Error messages display in English
- LTR text direction
- English button labels: "Retry", "Cancel", "Close", "Contact Support"

### Arabic Locale
- Error messages display in Arabic
- RTL text direction
- Arabic button labels: "إعادة المحاولة", "إلغاء", "إغلاق", "اتصل بالدعم"
- Proper Arabic font rendering

## Error Code Coverage

The following error codes should be tested with ErrorModal:
- `CUSTOMER_HAS_ORDERS` - Business logic error
- `DRIVER_HAS_ACTIVE_ORDERS` - Business logic error
- `ORDER_ALREADY_DISPATCHED` - Business logic error
- `DRIVER_ALREADY_ASSIGNED` - Business logic error
- `MISSING_WILAYA_COMMUNE` - Validation error
- `MISSING_STATION_CODE` - Validation error
- `PERMISSION_DENIED` - Critical authentication error
- Generic errors without specific codes

## Accessibility Testing

1. **Keyboard Navigation**:
   - Tab through modal buttons
   - Press Enter to activate buttons
   - Press Escape to close (non-critical errors only)

2. **Screen Reader**:
   - Error message is announced
   - Button labels are clear
   - Modal role is properly set

3. **Visual**:
   - Error icon is visible
   - Text is readable with sufficient contrast
   - Modal is centered and properly sized

## Browser Testing

Test in the following browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Mobile Testing

Test on mobile devices:
- iOS Safari
- Android Chrome
- Verify touch interactions work properly
- Verify modal is responsive and readable

## Success Criteria

✅ All error scenarios display ErrorModal correctly
✅ English and Arabic locales work properly
✅ RTL layout is correct for Arabic
✅ Action buttons function as expected
✅ Critical errors prevent dismissal
✅ Non-critical errors allow dismissal
✅ Error codes are displayed when available
✅ Accessibility requirements are met
✅ Mobile experience is smooth

## Notes

- ErrorModal replaces toast notifications for blocking/critical errors
- Toast notifications are still used for success messages and non-blocking errors
- The modal uses the existing Dialog component from shadcn/ui
- Locale detection uses the `useErrorLocale()` hook
