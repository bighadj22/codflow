# Error Components

This directory contains reusable error display components for the COD platform.

## Components

### ErrorModal

A modal dialog component for displaying blocking errors with proper internationalization support.

**Features:**
- ✅ Displays error messages in modal format
- ✅ RTL layout support for Arabic locale
- ✅ Action buttons (Retry, Cancel, Contact Support)
- ✅ Critical error mode (prevents dismissal)
- ✅ Error code display for debugging
- ✅ Context interpolation support

**Usage:**

```tsx
import { ErrorModal } from "@/components/errors/error-modal";
import { useErrorLocale } from "@/lib/errors/use-locale";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useErrorLocale();
  
  return (
    <ErrorModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      message="Cannot delete customer with existing orders"
      locale={locale}
      errorCode="CUSTOMER_HAS_ORDERS"
    />
  );
}
```

**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | Yes | - | Whether the modal is open |
| `onClose` | `() => void` | Yes | - | Callback when modal should close |
| `message` | `string` | Yes | - | Error message (already localized) |
| `locale` | `"en" \| "ar"` | Yes | - | User's language preference |
| `errorCode` | `string` | No | - | Error code for debugging |
| `onRetry` | `() => void` | No | - | Callback for retry button |
| `isCritical` | `boolean` | No | `false` | Prevents modal dismissal |
| `onContactSupport` | `() => void` | No | - | Callback for contact support button |

**Examples:**

See `error-modal.example.tsx` for comprehensive usage examples including:
- Simple error display
- Recoverable errors with retry
- Critical errors that block dismissal
- Errors with contact support
- Integration with backend error responses
- Arabic locale (RTL) examples

## Testing

Unit tests are located in `error-modal.test.tsx`. Run tests with:

```bash
npm test -- error-modal.test.tsx
```

## Design Patterns

### Error Flow

1. **Server Action** catches API error
2. **Error Mapper** converts error code to localized message
3. **Component** displays error in modal
4. **User** takes action (retry, cancel, contact support)

### Locale Handling

The component uses the `useErrorLocale()` hook to get the user's language preference:
- `"en"` - English (LTR layout)
- `"ar"` - Arabic (RTL layout)

### Critical Errors

Critical errors prevent the user from dismissing the modal:
- Session expired
- Invalid API key
- Permission denied

These errors require the user to take action (e.g., retry, log in again).

### Button Visibility

| Scenario | Close/Cancel | Retry | Contact Support |
|----------|--------------|-------|-----------------|
| Simple error | ✅ Close | ❌ | ❌ |
| With retry | ✅ Cancel | ✅ | ❌ |
| With support | ✅ Close | ❌ | ✅ |
| Critical | ❌ | ✅ (optional) | ✅ (optional) |

## Integration with Error System

This component is part of the comprehensive API Error Messaging System:

1. **Backend** (`cod-server`):
   - Error codes defined in `cod-shared/errors/codes.ts`
   - Custom error classes in `cod-server/src/lib/errors/classes.ts`
   - Error middleware formats responses

2. **Frontend** (`cod-client`):
   - Error registry in `lib/errors/registry.ts`
   - Error mapper in `lib/errors/mapper.ts`
   - Error modal component (this file)
   - Error toast utility in `lib/errors/toast.ts`

## Related Files

- `lib/errors/mapper.ts` - Maps error codes to messages
- `lib/errors/registry.ts` - Error message translations
- `lib/errors/use-locale.ts` - Locale detection hook
- `lib/errors/toast.ts` - Toast notification utility
- `components/ui/dialog.tsx` - Base dialog component

## Requirements

This component implements the following requirements from the API Error Messaging System spec:

- **9.6**: Display business logic errors in modal dialogs
- **11.4**: Apply RTL text direction for Arabic locale
- **15.2**: Provide "Retry" buttons for recoverable errors
- **15.3**: Offer alternative actions (Cancel, Contact Support)
- **19.2**: Display blocking errors in modal format for critical errors
