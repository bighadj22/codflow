# Components

This directory contains all React components organized by feature and type.

## Directory Structure

```
components/
├── ui/                    # Reusable UI primitives (shadcn/ui)
├── auth/                  # Authentication components
├── layout/                # Layout components (Sidebar, Navbar, MobileNav)
├── dashboard/             # Dashboard-specific components
├── customers/             # Customer management components
├── customer-groups/       # Customer group management components
├── customer-tags/         # Customer tag management components
├── products/              # Product management components
├── product-groups/        # Product group management components
├── offers/                # Offers components
├── reviews/               # Reviews components
├── orders/                # Order management components
├── delivery/              # Delivery management components
├── mcp/                   # MCP access management components
├── team/                  # Team management components
├── profile/               # User profile components
├── rbac/                  # Permission-guarded components (ProtectedRoute/ProtectedAction)
├── errors/                # Error modal / boundary components
└── settings/              # Settings components
```

## Component Categories

### UI Components (`ui/`)
Reusable, generic UI components based on shadcn/ui:
- Form elements (Button, Input, Select, etc.)
- Layout components (Card, Dialog, Sheet, etc.)
- Feedback components (EmptyState, LoadingState, ErrorState)
- Data display (StatCard, Badge, Avatar, etc.)

### Feature Components
Domain-specific components organized by feature:
- Each feature has its own directory
- Components are named descriptively
- Related components are grouped together

## Component Patterns

### View Components
Main page components that compose smaller components:
```tsx
// customers-view.tsx
export function CustomersView() {
  return (
    <div>
      <CustomersStats />
      <CustomersTable />
    </div>
  );
}
```

### Dialog Components
Modal dialogs for forms and actions:
```tsx
// customer-form-dialog.tsx
export function CustomerFormDialog({ open, onOpenChange, customer }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        {/* Form content */}
      </DialogContent>
    </Dialog>
  );
}
```

### Stats Components
Metric cards for each feature:
```tsx
// customers-stats.tsx
export function CustomersStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="..." value={0} icon={Users} />
    </div>
  );
}
```

## Design Patterns

### Consistent Styling
- Use `rounded-xl` for cards and containers
- Use `border-border` for borders
- Use `bg-card` for card backgrounds
- Use `bg-muted` for input backgrounds
- Use `h-11` for inputs and buttons
- Use `py-3` for select items
- Use `text-base` for mobile-friendly text

### Dialog Structure
```tsx
<DialogContent className="p-0">
  <DialogHeader className="px-6 pt-6 pb-0">
    <DialogTitle>Title</DialogTitle>
  </DialogHeader>
  <div className="px-6">
    {/* Content */}
  </div>
  <DialogFooter className="px-6 pb-6 pt-4">
    <Button>Action</Button>
  </DialogFooter>
</DialogContent>
```

### Mobile-First Buttons
```tsx
<Button className="flex-1 sm:flex-none">
  {/* Full width on mobile, auto on desktop */}
</Button>
```

### Translation Pattern
```tsx
import { useCustomers } from "@/lib/translations";

export function Component() {
  const t = useCustomers();

  return <h1>{t.page_title}</h1>;
}
```

## Best Practices

1. **Single Responsibility** - One component, one job
2. **Composition** - Build complex UIs from simple components
3. **Props over State** - Lift state up when possible
4. **Type Safety** - Use TypeScript interfaces for props
5. **Accessibility** - Use semantic HTML and ARIA attributes
6. **Performance** - Memoize expensive calculations
7. **Documentation** - Add JSDoc comments to complex components

## Creating New Components

When creating a new component:

1. **Choose the right directory** - Feature-specific or UI?
2. **Name it descriptively** - Clear, action-oriented names
3. **Define prop types** - Use TypeScript interfaces
4. **Add JSDoc comments** - Document purpose and usage
5. **Follow design patterns** - Consistent styling and structure
6. **Use translations** - No hardcoded text
7. **Keep it focused** - Split if it gets too large (>200 lines)

## Component Size Guidelines

- **Small**: < 100 lines (ideal)
- **Medium**: 100-200 lines (acceptable)
- **Large**: > 200 lines (consider splitting)

If a component exceeds 200 lines, consider:
- Extracting sub-components
- Moving logic to custom hooks
- Splitting into multiple files

## Examples

### Good Component Structure
```tsx
import { useCustomers } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}

/**
 * CustomerCard Component
 * 
 * Displays customer information in a card format.
 */
export function CustomerCard({ customer, onEdit }: CustomerCardProps) {
  const t = useCustomers();
  
  return (
    <Card className="p-4">
      <h3>{customer.name}</h3>
      <Button onClick={() => onEdit(customer)}>
        {t.table.actions}
      </Button>
    </Card>
  );
}
```

### Using Custom Hooks
```tsx
import { useDialog } from "@/hooks/useDialog";
import { useDebounce } from "@/hooks/useDebounce";

export function CustomersView() {
  const { open, data, openDialog, closeDialog } = useDialog<Customer>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  // Component logic
}
```

### Using Constants
```tsx
import { ORDER_STATUSES, ORDER_STATUS_COLORS } from "@/lib/constants";
import { formatPrice, formatDate } from "@/lib/format";

export function OrderCard({ order }) {
  return (
    <div>
      <p>{formatPrice(order.total)}</p>
      <p>{formatDate(order.createdAt)}</p>
      <span className={ORDER_STATUS_COLORS[order.status]}>{order.status}</span>
    </div>
  );
}
```
