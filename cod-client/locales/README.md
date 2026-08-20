# Locales Directory

This directory contains the internationalization (i18n) translation files for the
dashboard. Translations are plain JSON — one file per feature per language. There
is **no `next-intl`** dependency; the app uses the custom translation system in
`@/lib/translations`.

## Structure

```
locales/
├── ar/   # Arabic (primary, RTL)
├── en/   # English
└── fr/   # French
```

Each locale folder contains the same 17 feature files:

```
auth, common, navigation, dashboard, customers, customer-groups, customer-tags,
products, product-groups, offers, reviews, orders, delivery, team, profile,
settings, mcp
```

## Translation hooks

Import a typed hook per feature from `@/lib/translations`:

```typescript
import {
  useAuth,           // auth.json
  useCommon,         // common.json
  useNavigation,     // navigation.json
  useDashboard,      // dashboard.json
  useCustomers,      // customers.json
  useCustomerGroups, // customer-groups.json
  useCustomerTags,   // customer-tags.json
  useProducts,       // products.json
  useProductGroups,  // product-groups.json
  useReviews,        // reviews.json
  useOffers,         // offers.json
  useOrders,         // orders.json
  useDelivery,       // delivery.json
  useTeam,           // team.json
  useProfile,        // profile.json
  useSettings,       // settings.json
  useMcp,            // mcp.json
} from "@/lib/translations";
```

Usage in a client component:

```tsx
"use client";

import { useCustomers } from "@/lib/translations";

export function CustomersView() {
  const t = useCustomers();

  return (
    <div>
      <h1>{t.page_title}</h1>
      <p>{t.table.customer}</p>
      <Button>{t.new_customer}</Button>
    </div>
  );
}
```

The `Locale` type is `"ar" | "en" | "fr"` (defaults to `"ar"`). The non-hook
`t(section, path, locale)` helper is available for server-side translations.

## Top-level sections per feature file

These are the real sections in the Arabic files (`locales/ar/*.json`):

- **auth** — `sign_in, sign_out, sign_out_aria, unauthorized, no_access, email,
  password, invalid_credentials, signing_in, title, subtitle, welcome_back,
  admin, staff, forgot_password, forgot_password_title, reset_password_*,
  magic_link_*, consent`
- **common** — `currency, roles, time, table, statuses, error_occurred, retry,
  cancel, confirm, delete, confirm_delete, toggle_theme, no_results_found`
- **navigation** — `sidebar` (all routes incl. `store, orders, orders_all,
  orders_abandoned, customers, products, all_products, categories,
  product_groups, customer_groups, customer_tags, delivery, delivery_drivers,
  delivery_companies, delivery_shipping, team, settings, general, inventory,
  system, reviews, offers, stock_management, api_reference, mcp`), `navbar`,
  `mobile`, `company` (`name, tagline`), `theme`, `menu` (`collapse, expand`),
  `language`, `breadcrumbs`
- **dashboard** — `header, stats (total_orders, revenue, customers, delivered,
  active_orders), status_breakdown, recent_orders, order_statuses,
  status_tooltips`
- **customers** — `page_title, customers_count, search_placeholder,
  filter_wilaya, filter_all, no_customers, new_customer, create_customer,
  create_order_for, error_cannot_delete_with_orders, success_deleted,
  error_delete_failed, actions, filters, empty_state, table, profile, segments,
  form`
- **customer-groups** — `page_title, groups_count, search_placeholder,
  new_group, create_group, success_deleted, error_delete_failed, actions,
  empty_state, table, detail, form, tags`
- **customer-tags** — `page_title, tags_count, search_placeholder, new_tag,
  create_tag, success_deleted, error_delete_failed, actions, empty_state,
  table, detail, form`
- **products** — `page_title, products_count, add_product, success_deleted,
  error_delete_failed, search_placeholder, table, actions, filters, status,
  stock, empty_state, pricing_units, form, status_options, stock_dialog,
  stock_history, stock_overview`
- **product-groups** — `page_title, add_group, groups_count, search_placeholder,
  table, actions, empty_state, form`
- **offers** — `page_title, add_offer, offers_count, table, status, empty_state,
  actions, discount_type, form, buy_x_get_y, buy_x_free_shipping, any_variant,
  free_shipping_reward`
- **reviews** — `page_title, total, new_badge, empty_title, empty_desc,
  filter_all, filter_pending, filter_approved, filter_rejected, status_*,
  order_label, action_*, confirm_delete_*, toast_*, page_prev, page_next,
  page_of`
- **orders** — `page_title, orders_count, new_order_button, search_placeholder,
  table, actions, assign_driver_dialog, dispatch_dialog, filters, type,
  empty_state, status, detail, next_status, flow, form`
- **delivery** — `page_title, page_subtitle, tabs (drivers, companies, shipping),
  add_driver, add_company, search_placeholder, table, company_table, actions,
  status, empty_state, delivery_type, vehicle_type, driver_card,
  assign_dialog, driver_form, providers, payments, company_profile, webhook,
  credentials_dialog, shipping_profiles, driver_profile, compensations,
  companies, auto_validate, stop_desks`
- **team** — `header, invite_user, team_members, joined, manage_permissions,
  generate_api_key, revoke_api_key, rotate_api_key, rotate_key_dialog,
  search_placeholder, table, actions, filters, status, empty_state,
  status_updated, role_updated, api_key_*, invite_dialog, view_activity,
  activity_log, scope_dialog, scope_categories, scope_actions,
  invite_dialog_extra`
- **profile** — `title, subtitle, info, security`
- **settings** — `page_title, store, shipping`
- **mcp** — `page_title, page_subtitle, tabs, url_card, snippet,
  my_connections, team_connections, help, time`

## Adding a new translation key

1. Add the key to the matching feature file in **all three** locales
   (`ar`, `en`, `fr`).
2. Access it via the feature hook: `const t = useOrders(); t.my_new_key`.
3. Keep keys flat where possible (`my_key`, not deep nesting), and use
   placeholders for dynamic values:

   ```json
   { "items_count": "{count} item" }
   ```

   ```tsx
   <p>{t.items_count.replace("{count}", count.toString())}</p>
   ```

4. Do not hardcode UI text in components — always go through a hook.

## RTL

Arabic is right-to-left. The root layout sets `<html lang="ar" dir="rtl">`.
Use Tailwind logical properties (`ms-*`, `pe-*`, `start`/`end`) instead of
`left`/`right` so layout flips correctly.

## Related documentation

- [Components README](../components/README.md) — translation usage in components
- [Lib README](../lib/README.md) — the translation hooks (`@/lib/translations`)