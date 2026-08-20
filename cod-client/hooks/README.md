# Custom Hooks Directory

This directory contains reusable React hooks for common patterns across the application.

## Available Hooks

### useDialog
Manages dialog state with open/close functionality and optional data.

**Use Case:** Modal dialogs, forms, confirmations

```tsx
import { useDialog } from "@/hooks/useDialog";

function MyComponent() {
  const { open, data, openDialog, closeDialog } = useDialog<Customer>();

  return (
    <>
      <Button onClick={() => openDialog(customer)}>Edit</Button>
      <Dialog open={open} onOpenChange={closeDialog}>
        {data && <CustomerForm customer={data} onClose={closeDialog} />}
      </Dialog>
    </>
  );
}
```

**API:**
- `open: boolean` - Dialog open state
- `data: T | null` - Optional data passed to dialog
- `openDialog(data?: T)` - Open dialog with optional data
- `closeDialog()` - Close dialog and clear data

---

### useDebounce
Debounces a value by delaying updates until after a specified delay.

**Use Case:** Search inputs, API calls, expensive calculations

```tsx
import { useDebounce } from "@/hooks/useDebounce";

function SearchComponent() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    // API call only fires after user stops typing for 300ms
    fetchResults(debouncedSearch);
  }, [debouncedSearch]);

  return <Input value={search} onChange={(e) => setSearch(e.target.value)} />;
}
```

**API:**
- `useDebounce<T>(value: T, delay?: number): T`
- Default delay: 300ms
- Returns debounced value

---

### useLocalStorage
Syncs state with localStorage for persistent data.

**Use Case:** User preferences, cached data, form drafts

```tsx
import { useLocalStorage } from "@/hooks/useLocalStorage";

function SettingsComponent() {
  const [theme, setTheme] = useLocalStorage("theme", "light");
  const [settings, setSettings] = useLocalStorage("settings", {
    notifications: true,
    language: "ar",
  });

  return (
    <div>
      <Button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        Toggle Theme
      </Button>
    </div>
  );
}
```

**API:**
- `useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void]`
- Automatically syncs with localStorage
- Handles JSON serialization
- SSR-safe (returns initialValue on server)

---

### useMediaQuery
Tracks whether a media query matches the current viewport.

**Use Case:** Responsive behavior, conditional rendering

```tsx
import { useMediaQuery, useIsMobile, useIsDesktop } from "@/hooks/useMediaQuery";

function ResponsiveComponent() {
  const isMobile = useIsMobile();
  const isTablet = useMediaQuery("(min-width: 769px) and (max-width: 1023px)");
  const isDesktop = useIsDesktop();

  return (
    <div>
      {isMobile && <MobileView />}
      {isTablet && <TabletView />}
      {isDesktop && <DesktopView />}
    </div>
  );
}
```

**API:**
- `useMediaQuery(query: string): boolean`
- `useIsMobile()` - Shorthand for `(max-width: 768px)`
- `useIsTablet()` - Shorthand for `(min-width: 769px) and (max-width: 1023px)`
- `useIsDesktop()` - Shorthand for `(min-width: 1024px)`

---

## Creating New Hooks

When creating a new hook:

1. **Name with `use` prefix** - Follow React conventions
2. **Add JSDoc comments** - Document parameters and return values
3. **Include usage examples** - Show how to use the hook
4. **Keep it focused** - One hook, one responsibility
5. **Make it reusable** - Generic enough for multiple use cases
6. **Add to this README** - Document the new hook

### Template

```typescript
import { useState, useEffect } from "react";

/**
 * useMyHook
 * 
 * Brief description of what this hook does.
 * 
 * @example
 * ```tsx
 * const { value, setValue } = useMyHook(initialValue);
 * ```
 */
export function useMyHook<T>(initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    // Side effects here
  }, [value]);

  return { value, setValue };
}
```

## Best Practices

1. **Extract repeated logic** - If you use the same pattern 3+ times, make a hook
2. **Keep hooks pure** - Avoid side effects when possible
3. **Document edge cases** - Explain limitations and gotchas
4. **Test hooks** - Consider adding unit tests
5. **Consider performance** - Use memoization when needed
6. **Handle cleanup** - Return cleanup functions from useEffect

## Common Patterns

### Form State Management
```tsx
const { open, data, openDialog, closeDialog } = useDialog<FormData>();
```

### Search with Debounce
```tsx
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 300);
```

### Persistent Preferences
```tsx
const [preferences, setPreferences] = useLocalStorage("prefs", defaultPrefs);
```

### Responsive Rendering
```tsx
const isMobile = useIsMobile();
return isMobile ? <MobileUI /> : <DesktopUI />;
```

## Related Documentation

- [Components README](../components/README.md) - Using hooks in components
- [Lib README](../lib/README.md) - Utility functions
- [React Hooks Docs](https://react.dev/reference/react) - Official React docs
