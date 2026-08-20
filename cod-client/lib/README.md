# Library Utilities

This directory contains utility functions, configurations, and helpers used across the application.

## 📁 Files Overview

```
lib/
├── auth.ts             # Authentication + RBAC helpers (getUser, requirePermission, getUserApiKey)
├── auth-client.ts      # Better Auth client instance
├── api-client.ts       # Typed REST client for the cod-server API
├── api-config.ts       # API endpoint config (NEXT_PUBLIC_WORKER_URL)
├── avatar.ts           # Avatar generation utilities
├── brand.ts            # Branding helpers
├── cf-env.ts           # Cloudflare environment access
├── config.ts           # Application configuration
├── constants.ts        # Centralized constants
├── format.ts           # Formatting utilities
├── translations.ts     # i18n translation hooks
├── i18n-context.tsx    # Language context provider
├── locale.ts           # Locale detection/helpers
├── utils.ts            # General utilities (cn)
├── validation.ts       # Form validation helpers
├── email.ts / email-templates.ts  # Transactional email sending + templates
├── rate-limit.ts       # Rate limiting helpers
├── errors/             # Error registry, mapper, toast utilities (see errors/README.md)
├── rbac/               # Client-side permission utilities (see rbac/README.md)
└── delivery/           # Delivery-carrier helpers
```

---

## 🔐 auth.ts
Authentication helpers for **Better Auth** (email + password, magic links, OAuth).
Also exposes RBAC helpers: `getUserScopes()`, `hasPermission()`, `requirePermission()`,
`requireAdmin()`, and `getUserApiKey()`.

### Functions

#### `getUser()`
Gets the current authenticated user or null.

```typescript
import { getUser } from "@/lib/auth";

const user = await getUser();
if (user) {
  console.log(user.name, user.email);
}
```

#### `requireUser()`
Requires authentication, redirects to login if not authenticated.

```typescript
import { requireUser } from "@/lib/auth";

// In Server Components
export default async function ProtectedPage() {
  const user = await requireUser(); // Redirects if not logged in
  return <div>Welcome {user.name}</div>;
}
```

**Use Cases:**
- Protected pages and layouts
- Getting user information
- Server-side authentication checks

---

## 🎨 avatar.ts
Avatar generation utilities for consistent user avatars.

### Functions

#### `getAvatarColor(id: string): string`
Returns a consistent color based on user ID.

```typescript
import { getAvatarColor } from "@/lib/avatar";

const color = getAvatarColor("user-123"); // "#FF6B6B"
// Same ID always returns same color
```

#### `generateAvatar(name: string, id: string)`
Generates avatar data with initials and color.

```typescript
import { generateAvatar } from "@/lib/avatar";

const avatar = generateAvatar("محمد أحمد", "user-123");
// { initials: "مأ", color: "#FF6B6B" }

// Use in component
<div style={{ backgroundColor: avatar.color }}>
  {avatar.initials}
</div>
```

**Use Cases:**
- Customer avatars
- Driver avatars
- User profile pictures
- Consistent color coding

---

## ☁️ cf-env.ts
Cloudflare environment access for edge runtime.

### Functions

#### `getCFEnv(): CloudflareEnv | null`
Gets Cloudflare environment variables (D1, KV, etc.).

```typescript
import { getCFEnv } from "@/lib/cf-env";
import { getDb } from "@/db";

const env = getCFEnv();
if (env) {
  const db = getDb(env.DB);
  // Use database
}
```

**Use Cases:**
- Accessing D1 database
- Accessing KV storage
- Edge runtime operations
- Server-side only

**Note:** Returns `null` in development or non-Cloudflare environments.

---

## ⚙️ config.ts
Application configuration settings.

### Configuration Object

```typescript
import { APP_CONFIG } from "@/lib/config";

export const APP_CONFIG = {
  // Application Info
  name: "CodFlow",
  locale: "ar",
  currency: "دج",
  dateFormat: "ar-DZ",
  direction: "rtl",

  // Pagination
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },

  // Validation
  validation: {
    phoneRegex: /^(0)(5|6|7)[0-9]{8}$/,
    minPasswordLength: 8,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  },

  // UI Constants
  ui: {
    inputHeight: "h-11",
    buttonHeight: "h-11",
    selectItemPadding: "py-3",
    cardRadius: "rounded-xl",
  },

  // Debounce Delays
  debounce: {
    search: 300,
    input: 500,
  },

  // Toast Duration
  toast: {
    duration: 3000,
    position: "top-center",
  },
};
```

### Usage Examples

```typescript
// Validation
const isValidPhone = APP_CONFIG.validation.phoneRegex.test(phone);

// UI
<Input className={APP_CONFIG.ui.inputHeight} />

// Debounce
const debouncedValue = useDebounce(value, APP_CONFIG.debounce.search);
```

**Use Cases:**
- Consistent validation rules
- UI component sizing
- Debounce delays
- File upload limits

---

## 📊 constants.ts
Centralized constants for the entire application.

### Available Constants

```typescript
import {
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
  VEHICLE_TYPES,
  DELIVERY_TYPES,
  AVATAR_COLORS,
  PRODUCT_CATEGORIES,
} from "@/lib/constants";
```

> **Wilayas are not a client constant.** Algerian wilayas/communes are seeded in
> the D1 database and fetched with `getWilayas()` / `getCommunes(wilayaId)` from
> `@/actions/wilayas`.

#### ORDER_STATUSES
All possible order statuses.

```typescript
type OrderStatus = "new" | "preparing" | "ready" | "assigned" | 
                   "out_for_delivery" | "delivered" | "returned" | "cancelled";
```

#### ORDER_STATUS_COLORS
Tailwind classes for each status.

```typescript
const statusClass = ORDER_STATUS_COLORS[order.status];
// "bg-green-500/10 text-green-600 border-green-500/20"
```

#### VEHICLE_TYPES
Driver vehicle types.

```typescript
type VehicleType = "motorcycle" | "car" | "van";
```

#### DELIVERY_TYPES
Delivery methods.

```typescript
type DeliveryType = "home" | "stop_desk";
```

#### AVATAR_COLORS
Predefined avatar colors.

```typescript
const colors = AVATAR_COLORS; // ["#FF6B6B", "#4ECDC4", ...]
```

#### PRODUCT_CATEGORIES
Product categories in Arabic.

```typescript
const categories = PRODUCT_CATEGORIES; // ["أقمشة", "ملابس", ...]
```

**Use Cases:**
- Dropdown options
- Status badges
- Form validation
- Consistent data across app

---

## 📝 format.ts
Formatting utilities for consistent data display.

### Functions

#### `formatPrice(price: number): string`
Formats price in Algerian Dinar.

```typescript
import { formatPrice } from "@/lib/format";

formatPrice(1500); // "1,500 دج"
formatPrice(25000); // "25,000 دج"
```

#### `formatDate(date: string | Date): string`
Formats date in Arabic locale.

```typescript
formatDate("2024-03-15"); // "١٥/٠٣/٢٠٢٤"
formatDate(new Date()); // Current date in Arabic
```

#### `formatDateTime(date: string | Date): string`
Formats date and time in Arabic locale.

```typescript
formatDateTime("2024-03-15T10:30:00"); // "١٥/٠٣/٢٠٢٤، ١٠:٣٠"
```

#### `formatPhone(phone: string): string`
Formats phone number with spaces.

```typescript
formatPhone("0555123456"); // "0555 12 34 56"
```

#### `getInitials(name: string): string`
Extracts initials from name.

```typescript
getInitials("محمد أحمد"); // "مأ"
getInitials("John Doe"); // "JD"
```

#### `formatFileSize(bytes: number): string`
Formats file size in human-readable format.

```typescript
formatFileSize(1024); // "1 KB"
formatFileSize(1048576); // "1 MB"
```

#### `truncate(text: string, length: number): string`
Truncates text with ellipsis.

```typescript
truncate("Long text here", 10); // "Long text..."
```

#### `formatRelativeTime(date: string | Date): string`
Formats relative time in Arabic.

```typescript
formatRelativeTime(new Date(Date.now() - 3600000)); // "منذ ساعة"
formatRelativeTime(new Date(Date.now() - 60000)); // "منذ لحظات"
```

**Use Cases:**
- Displaying prices
- Formatting dates
- Phone number display
- User avatars
- File uploads

---

## 🌐 translations.ts
i18n translation hooks. Each feature file in `locales/*/` has a matching hook
(`useNavigation`, `useDashboard`, `useOrders`, `useCustomers`, `useProducts`,
`useProductGroups`, `useCustomerGroups`, `useCustomerTags`, `useReviews`,
`useOffers`, `useDelivery`, `useTeam`, `useProfile`, `useSettings`, `useMcp`,
`useAuth`, `useCommon`).

### Usage

```typescript
"use client";

import { useCustomers } from "@/lib/translations";

export function CustomersView() {
  const t = useCustomers();
  
  return (
    <div>
      <h1>{t.page_title}</h1>
      <p>{t.page_subtitle}</p>
      <Button>{t.add_customer}</Button>
    </div>
  );
}
```

### Translation Object Structure

```typescript
const t = useCustomers();
// Access nested keys
t.page_title          // "العملاء"
t.table.name          // "الاسم"
t.form.name_label     // "الاسم"
```

**Use Cases:**
- All UI text
- Form labels
- Error messages
- Button text
- Page titles

**See:** [locales/README.md](../locales/README.md) for full translation documentation

---

## 🛠️ utils.ts
General utility functions.

### Functions

#### `cn(...inputs: ClassValue[]): string`
Merges Tailwind CSS classes intelligently.

```typescript
import { cn } from "@/lib/utils";

// Conditional classes
<div className={cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "disabled-class"
)} />

// Override classes
<div className={cn(
  "text-blue-500",
  isPrimary && "text-red-500" // Overrides blue
)} />

// Array of classes
<div className={cn([
  "flex",
  "items-center",
  "gap-2"
])} />
```

**Use Cases:**
- Conditional styling
- Component variants
- Dynamic classes
- Class merging

**Powered by:** `clsx` + `tailwind-merge`

---

## ✅ validation.ts
Form validation helper functions.

### Functions

#### `validateRequiredField(value: string, fieldName: string): string | null`
Validates required fields.

```typescript
import { validateRequiredField } from "@/lib/validation";

const error = validateRequiredField(name, "Name");
if (error) {
  toast.error(error); // "Name is required"
}
```

#### `validatePhoneNumber(phone: string): string | null`
Validates Algerian phone numbers (10 digits starting with 0).

```typescript
const error = validatePhoneNumber("0555123456");
if (error) {
  toast.error(error); // "Invalid phone number format..."
}
```

#### `validateNumericField(value: string, fieldName: string): string | null`
Validates numeric fields.

```typescript
const error = validateNumericField(price, "Price");
```

#### `validatePositiveNumber(value: number, fieldName: string): string | null`
Validates positive numbers.

```typescript
const error = validatePositiveNumber(quantity, "Quantity");
```

#### `validateMinLength(value: string, minLength: number, fieldName: string): string | null`
Validates minimum length.

```typescript
const error = validateMinLength(password, 8, "Password");
```

**Use Cases:**
- Form validation
- Input validation
- Data validation before API calls

---

## 🎯 Best Practices

### When to Add New Utilities

1. **Repeated 3+ times** - Extract into utility
2. **Pure functions** - No side effects
3. **Single responsibility** - One function, one job
4. **Well documented** - JSDoc with examples
5. **Type safe** - Full TypeScript support

### File Organization

- **auth.ts** - Authentication only
- **format.ts** - Formatting only
- **validation.ts** - Validation only
- **constants.ts** - Constants only
- **utils.ts** - General utilities

### Adding New Functions

```typescript
/**
 * Brief description
 * 
 * @param param1 - Description
 * @param param2 - Description
 * @returns Description
 * 
 * @example
 * ```typescript
 * myFunction("example"); // "result"
 * ```
 */
export function myFunction(param1: string, param2: number): string {
  // Implementation
}
```

---

## 📚 Related Documentation

- [Hooks README](../hooks/README.md) - Custom React hooks
- [Types README](../types/README.md) - TypeScript types
- [Locales README](../locales/README.md) - Translations
- [Components README](../components/README.md) - UI components

---

**All utilities are centralized here for easy maintenance and reusability!** 🚀
