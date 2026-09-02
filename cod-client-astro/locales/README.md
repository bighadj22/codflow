# Locales Directory

This directory contains the internationalization (i18n) translation files for
the dashboard. Translations are plain JSON — one file per feature namespace
per language. Dictionaries are **bundled at build time** by
`src/i18n/dictionaries.ts`: no loading states for text, ever.

## Structure

```
locales/
├── ar/   # Arabic (primary, RTL)
├── en/   # English (fallback locale)
└── fr/   # French
```

Each locale folder contains the same 17 namespace files:

```
auth, common, navigation, dashboard, customers, customer-groups,
customer-tags, products, product-groups, offers, reviews, orders, delivery,
delivery_companies, team, settings, mcp
```

## Translation hooks

The React layer is `src/i18n/react.ts`. Islands translate with `useT`:

```tsx
import { useT } from "@/i18n/react";

export function CustomersView() {
  const t = useT("customers");
  const common = useT("common");

  return (
    <div>
      <h1>{t("page_title")}</h1>
      <button>{common("cancel")}</button>
    </div>
  );
}
```

- `useT(ns)` returns `(key: string) => string` — flat dotted keys
  (`t("table.customer")`), synchronous, with English as the fallback locale.
- `useLocale()` exposes the current `"ar" | "en" | "fr"`.
- `switchLocale(locale)` persists the choice and reloads — dictionaries are
  bundled per locale, so a reload swaps every string at once.

## Registering a namespace

A new `locales/<lang>/<ns>.json` file is inert until registered:

1. Import it for **all three** languages in `src/i18n/dictionaries.ts`.
2. Add the name to the `Namespace` union there and to `NAMESPACES` in
   `src/i18n/i18n-guard.test.ts` (the guard enforces ar/en/fr leaf-key parity
   and that every RBAC scope action has a translation).

## Adding a new translation key

1. Add the key to the matching namespace file in **all three** locales.
2. Use placeholders for dynamic values: `{ "items_count": "{count} items" }`
   then `t("items_count").replace("{count}", String(count))`.
3. Never hardcode UI text in components — always go through `useT`.

## RTL

Arabic is right-to-left. The document direction flips with the locale
(`applyDocumentLocale`). Use Tailwind logical properties (`ms-*`, `pe-*`,
`start`/`end`) instead of `left`/`right` so layout mirrors correctly.

## Guards

`npm test` runs `src/i18n/i18n-guard.test.ts`, which enforces:
- identical leaf-key sets across ar/en/fr for every namespace,
- translations for every RBAC scope action (`team.scope_actions.*`),
- no hardcoded user-facing strings in scanned components.
