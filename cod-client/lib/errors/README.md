# Error Handling Utilities

This directory contains utilities for handling and displaying errors in the COD client application.

## Files

- **`registry.ts`** - Centralized error message registry with English and Arabic translations
- **`mapper.ts`** - Error mapping utility that converts error codes to localized messages
- **`toast.ts`** - Toast notification utility for displaying errors to users
- **`toast.example.ts`** - Usage examples for the toast utility

## Toast Utility

The toast utility provides functions for displaying error, success, warning, and info messages as toast notifications.

### Features

- ✅ **RTL Support**: Automatic RTL text direction for Arabic locale (handled by Toaster component)
- ✅ **Retry Button**: Automatic retry button for recoverable errors (network timeouts, service unavailable)
- ✅ **Dismissible**: Toasts can be dismissed by users (configurable)
- ✅ **Localized**: Supports Arabic, English, and French messages
- ✅ **Customizable**: Duration and dismissibility can be customized

### Usage

#### Basic Error Toast

```typescript
import { showErrorToast } from "@/lib/errors/toast";
import { getLocale } from "@/lib/locale";

const locale = getLocale();
showErrorToast("Failed to save customer", locale);
```

#### Error Toast with Retry Button

```typescript
import { showErrorToast } from "@/lib/errors/toast";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";

try {
  await saveCustomer(data);
} catch (error) {
  if (error instanceof ApiClientError && error.code) {
    const locale = getLocale();
    const message = mapError(error.code, locale, error.context);
    
    showErrorToast(message, locale, {
      code: error.code,
      onRetry: () => saveCustomer(data),
    });
  }
}
```

#### Success Toast

```typescript
import { showSuccessToast } from "@/lib/errors/toast";
import { getLocale } from "@/lib/locale";

const locale = getLocale();
showSuccessToast("Customer saved successfully", locale);
```

#### Client Component Usage

```tsx
"use client";

import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useLanguage } from "@/lib/i18n-context";

export function CustomerForm() {
  const { locale } = useLanguage();
  
  const handleSubmit = async (data: any) => {
    try {
      await saveCustomer(data);
      showSuccessToast("Customer saved successfully", locale);
    } catch (error) {
      if (error instanceof Error) {
        showErrorToast(error.message, locale);
      }
    }
  };
  
  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

### API Reference

#### `showErrorToast(message, locale, options?)`

Display an error message as a toast notification.

**Parameters:**
- `message` (string) - The localized error message to display
- `locale` ("ar" | "en" | "fr") - The user's language preference
- `options` (object, optional):
  - `code` (string) - Error code from backend (used to determine if error is recoverable)
  - `onRetry` (function) - Callback function to execute when retry button is clicked
  - `duration` (number) - Duration in milliseconds before auto-dismiss (default: 5000)
  - `dismissible` (boolean) - Whether the toast can be dismissed by user (default: true)

**Example:**
```typescript
showErrorToast("Network timeout", "en", {
  code: "NETWORK_TIMEOUT",
  onRetry: () => retryOperation(),
  duration: 10000,
});
```

#### `showSuccessToast(message, locale, duration?)`

Display a success message as a toast notification.

**Parameters:**
- `message` (string) - The localized success message to display
- `locale` ("ar" | "en" | "fr") - The user's language preference
- `duration` (number, optional) - Duration in milliseconds before auto-dismiss (default: 3000)

#### `showWarningToast(message, locale, duration?)`

Display a warning message as a toast notification.

**Parameters:**
- `message` (string) - The localized warning message to display
- `locale` ("ar" | "en" | "fr") - The user's language preference
- `duration` (number, optional) - Duration in milliseconds before auto-dismiss (default: 4000)

#### `showInfoToast(message, locale, duration?)`

Display an info message as a toast notification.

**Parameters:**
- `message` (string) - The localized info message to display
- `locale` ("ar" | "en" | "fr") - The user's language preference
- `duration` (number, optional) - Duration in milliseconds before auto-dismiss (default: 3000)

## Recoverable Errors

The following error codes are classified as recoverable and will automatically show a retry button:

- `NETWORK_TIMEOUT` - Request timed out
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable
- `EXTERNAL_API_FAILURE` - External API failure

## RTL Support

RTL (Right-to-Left) text direction is automatically handled by the Toaster component based on the user's locale preference. When the locale is set to "ar" (Arabic), the Toaster component applies RTL direction to all toasts.

Individual toasts inherit the direction from the Toaster component, so you don't need to manually set the direction for each toast.

## Testing

Unit tests are available in `toast.test.ts`. Run tests with:

```bash
npm test -- lib/errors/toast.test.ts
```

## Integration with Error Mapper

The toast utility integrates seamlessly with the error mapper:

```typescript
import { showErrorToast } from "@/lib/errors/toast";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import { ApiClientError } from "@/lib/api-client";

try {
  await deleteCustomer(id);
} catch (error) {
  if (error instanceof ApiClientError && error.code) {
    const locale = getLocale();
    const message = mapError(error.code, locale, error.context);
    
    showErrorToast(message, locale, {
      code: error.code,
      onRetry: error.code === "NETWORK_TIMEOUT" ? () => deleteCustomer(id) : undefined,
    });
  }
}
```

## See Also

- [Error Registry](./registry.ts) - Centralized error messages
- [Error Mapper](./mapper.ts) - Error code to message mapping
- [Locale Utility](../locale.ts) - Locale detection
- [Toast Examples](./toast.example.ts) - More usage examples
