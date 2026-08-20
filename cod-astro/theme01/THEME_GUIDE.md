# theme01 — Multi-Niche Storefront

The original CodFlow storefront. Friendly, approachable, conversion-
focused. Multi-language by design (Arabic / French / English) and
neutral enough to fit any niche — beauty, electronics, supplements,
home goods, general retail. The default theme every new partner gets
unless they explicitly switch.

> theme01 is the platform's "safe default." It optimises for
> familiarity over flair. Loud branding decisions belong to a future
> niche theme (theme02 sneakers, theme03 onwards — not shipped yet).
> Don't push theme01 in a direction that makes it less useful as a fallback.

---

## The Two Hard Rules

### 1. Never hardcode a visible string

Every string the user can read lives in **`src/theme/content/<lang>.ts`**
(typed by `src/theme/content/types.ts`). Theme01 ships three locale packs —
`ar.ts`, `fr.ts`, `en.ts` — resolved at request time by `resolveContent()` in
`src/theme/content/index.ts` (the store's active language comes from
`StoreConfig.lang`, currently `"ar" | "en"` in the D1 schema). Components
consume strings via the `content` prop
(passed down from `getStoreContext()` → `StoreLayout`). Adding a new
label means adding a key to `types.ts` first, then filling it in
**all three** language files, then reading it in the component — never
typing the literal in the JSX.

```astro
{/* ❌ NO */}
<button>Add to Cart</button>

{/* ✅ YES */}
<button>{content.formSubmit}</button>
```

If you only fill the EN value and leave AR/FR empty, TypeScript will
fail the build — `StoreFrontContent` is exact.

### 2. Never hardcode a color, radius, font, or spacing value

Theme01's design tokens live in two places:

- **Static UI tokens** in `src/theme/styles/global.css` `:root`
  (`--clr-surface`, `--clr-border`, `--clr-text`, `--clr-text-2`,
  `--safe-top`, `--safe-bottom`).
- **Partner-overridable tokens** injected at request time by
  `BaseHead.astro` from `getStoreContext().config`
  (`--clr-primary`, `--clr-accent`, `--clr-bg`, `--font-body`).
  These reflect the partner's choice in the dashboard.

Components reference `var(--clr-primary)`, never `#7c3aed`. Same for
radius (`var(--radius-card)`, `var(--radius-input)`,
`var(--radius-btn)`), shadows (`var(--shadow-md)`,
`var(--shadow-primary)`), and easings (`var(--animate-spring)`).

```css
/* ❌ NO */
.btn { background: #7c3aed; border-radius: 12px; }

/* ✅ YES */
.btn { background: var(--clr-primary); border-radius: var(--radius-btn); }
```

This rule is what makes theme01 work for any partner without
re-skinning the components. The same theme renders cleanly in
purple-and-orange (current default), green-and-red, blue-and-yellow,
or any palette the partner picks.

---

## Design System — what theme01 looks like

### Palette

theme01 expects the partner to pick a `primaryColor` and `accentColor`
in the dashboard. Defaults are chosen so the theme reads well even
before customisation.

| Token              | Default            | Source                  | Usage                                         |
|--------------------|--------------------|-------------------------|-----------------------------------------------|
| `--clr-primary`    | `#7c3aed`          | `BaseHead.astro` runtime| Brand color — buttons, badges, links          |
| `--clr-accent`     | `#f59e0b`          | `BaseHead.astro` runtime| Secondary highlight — sale stripes, hovers    |
| `--clr-bg`         | `#f8f8f8`          | `BaseHead.astro` runtime| Page background                                |
| `--clr-surface`    | `#ffffff`          | `:root` (static)        | Cards, input backgrounds                      |
| `--clr-border`     | `rgba(0,0,0,.06)`  | `:root` (static)        | Hairlines                                      |
| `--clr-text`       | `#0f172a`          | `:root` (static)        | Body text, headings                            |
| `--clr-text-2`     | `#64748b`          | `:root` (static)        | Captions, secondary text                       |

> **Accessibility note** — `global.css` carries explicit guidance on
> safe `--clr-primary` values. Keep contrast ≥ 4.5:1 against white.
> See the comment block above `:root` in `global.css` for recommended
> hex values.

### Typography

- **Default:** `Cairo` (a strong AR + Latin sans, free Google Font), loaded
  together with **Plus Jakarta Sans** as the Latin fallback, then system-ui.
- **Override:** Partners can supply their own `fontFamily` and
  `fontUrl` via the store config; `BaseHead.astro` rewrites
  `--font-body` and the Google Fonts `<link>` accordingly.

theme01 stays **single-font**. A separate display face would clash
with the niche-neutral mandate — use weight changes (400 / 600 / 800)
for hierarchy instead.

### Radius — friendly, rounded

theme01's signature is **soft, generous corners**. This is what
distinguishes it visually from theme02 (sharp).

- `--radius-card`  `1.25rem` (20px) — product cards, sections
- `--radius-input` `1rem`    (16px) — form fields, dropdowns
- `--radius-btn`   `1rem`    (16px) — buttons

Don't go below 12px or above 24px. Below feels cold; above feels
cartoonish.

### Shadow

- `--shadow-sm`      `0 1px 2px rgba(0,0,0,.04)` — hairline lift
- `--shadow-md`      `0 4px 12px rgba(0,0,0,.05)` — card resting state
- `--shadow-lg`      `0 12px 24px rgba(0,0,0,.08)` — modal, hover
- `--shadow-primary` `0 8px 24px color-mix(... primary 25%)` — for
  CTAs to glow with the partner's brand color

### Motion

- `--animate-spring` — `cubic-bezier(0.175, 0.885, 0.32, 1.1)`. The
  signature easing for theme01. Snappy with a tiny overshoot — feels
  app-y. Use for hover states, button press, modal open.

---

## Layout Decisions

### Languages first

Theme01 defaults to **Arabic** (`lang="ar"`, `dir="rtl"`). Components
must work bidirectionally:

- Use logical CSS properties — `padding-inline`,
  `margin-inline-start`, `inset-inline-start` — never `padding-left` /
  `padding-right`.
- Tailwind: prefer `ps-*` / `pe-*` / `start-*` / `end-*` over
  `pl-*` / `pr-*` / `left-*` / `right-*`.
- Direction-implying icons (back arrows, chevrons) flip when
  `dir="rtl"`. Most do via `transform: scaleX(-1)` on the SVG, or
  `rotate-180` in the existing RTL-aware components.

### Mobile-first with bottom nav

Theme01 has a **mobile bottom-tab navigation** (`MobileNav.astro`).
This is part of theme01's identity — feels like a native app on
phone. Don't remove it.

On desktop the bottom nav is hidden; the top header takes over.

### Pages

- **Home (`/`)** — hero, trust strip, featured / new arrivals,
  categories, footer. Sections live inside friendly rounded cards.
- **Listing (`/products`, `/category/[slug]`)** — 2-col grid on
  mobile, 3-col on tablet, 4-col on desktop. Cards are rounded with
  `--shadow-md`.
- **Product detail (`/products/[slug]`)** — gallery left (sticky on
  desktop, swipeable on mobile), info + form right. Order form is
  inline below the fold on mobile.
- **Thank you** — friendly confirmation with "what happens next"
  steps.

---

## Component Inventory (theme01)

```
src/theme/components/
├── home/
│   ├── Hero.astro              ← gradient hero with CTAs + trust badges
│   ├── CategoryCards.astro     ← 4 category image cards (streaming)
│   ├── BestSellers.astro       ← featured products grid (streaming)
│   ├── HowItWorks.astro        ← 3-step COD trust section
│   ├── NewArrivals.astro       ← newest products grid (streaming)
│   ├── FeaturesBar.astro       ← 5-icon trust strip
│   ├── WhatsAppCTA.astro       ← promo banner with CTA
│   ├── CustomerTestimonials.astro ← review cards (streaming, conditional)
│   ├── FeaturedProducts.astro  ← product grid (used on other pages)
│   ├── CategoryBar.astro       ← category pills (presentational)
│   ├── CategoryBarWithData.astro ← category pills (streaming)
│   └── TopAnnouncementBanner.astro ← unused (handled by StoreLayout)
├── layout/
│   ├── BaseHead.astro       ← <head>, fonts, runtime token injection
│   ├── Header.astro         ← top bar with brand + back button
│   ├── Footer.astro         ← multi-column footer with trust badges
│   └── MobileNav.astro      ← bottom tab bar (theme01 signature)
├── product/
│   ├── ProductCard.astro
│   ├── ProductGallery.astro
│   ├── ProductInfo.astro
│   ├── ProductDetailContent.astro
│   ├── ReviewsList.astro
│   └── ReviewForm.astro
├── order/
│   ├── OrderForm.astro
│   ├── VariantSelector.astro
│   ├── OfferTiers.astro
│   ├── CustomerFields.astro
│   └── OrderSummary.astro
├── ui/
│   └── Select.astro         ← carries the v1.0.88 dropdown bug fix
└── (others as needed)
```

---

## What's shared with the platform (DO NOT TOUCH from theme01)

```
src/core/**
src/middleware.ts
src/content.config.ts
src/pages/api/**
```

Same boundary as theme02 — the data layer is platform-owned. If you
think you need to change something there, that's a platform change,
not a theme change.

---

## Theme01-specific copy notes

- Three locales must stay in sync: `ar.ts`, `fr.ts`, `en.ts`.
  `types.ts` enforces shape exactness — adding a key to one without
  the others fails the build.
- Default language is Arabic (`lang="ar"`). The English file is
  written for store owners reviewing copy or for English-speaking
  Algerian customers — not for international stores.
- Currency: `DZD` / `دج` (`StoreConfig.currencySymbol`).
- Phone validation: 10 digits starting `05` / `06` / `07`. Validated
  in `src/core/`, never in the theme.

---

## Versioning

theme01 has been the production storefront since the platform's
launch. Every release tag (`v1.0.x`) ships a theme01 build. When the
multi-theme switch design lands, theme01 becomes one of N theme bundles in the
release matrix, but it remains the default for new provisions.

---

# 🚨 BRIEFING FOR THE NEXT AI AGENT (designer / contributor pass)

You are working on **theme01**, the platform's default storefront.
Read this section before touching anything. theme01's job is to be
**broadly useful** — every partner gets it unless they explicitly
switch. That makes it different from theme02 (sneakers): you cannot
make styling choices that only suit one niche.

## DO NOT TOUCH

```
src/core/**                    ← actions, API client, types, middleware, data
src/middleware.ts              ← Astro action redirect handler
src/content.config.ts
src/pages/api/**               ← /api/communes, /api/product-reviews, /api/submit-review
astro.config.mjs               ← exception: only edit `integrations` if needed
wrangler.jsonc                 ← Worker name + bindings
package.json deps              ← only add new dev deps if absolutely required
```

If you find yourself wanting to change one of these, it's a platform
change. Stop and ask.

## YOUR JURISDICTION

```
src/theme/**                   ← every component, every style
src/theme/styles/global.css    ← static tokens; refine but don't break the system
src/theme/content/{ar,fr,en}.ts ← all three locales must stay in sync
src/theme/components/**
src/pages/index.astro
src/pages/products/index.astro
src/pages/products/[slug].astro
src/pages/category/[slug].astro
src/pages/thank-you.astro
```

## THE TWO HARD RULES (re-read every commit)

1. **No hardcoded user-facing string.** Add a key to `content/types.ts`
   first, fill it in **all three** of `ar.ts`, `fr.ts`, `en.ts`, then
   read it in the component. Grep your diff for any string literal in
   a component — if it's visible, it's a violation.

2. **No hardcoded color, radius, or font value.** Use the CSS
   variables defined in `global.css` `:root` and the runtime
   variables emitted by `BaseHead.astro`. If you need a token that
   doesn't exist, add it to `:root` first. Inline `#7c3aed`, `12px`,
   `1rem` etc. in component styles is forbidden. The partner's
   `primaryColor` / `accentColor` / `fontFamily` flow through
   `--clr-primary` / `--clr-accent` / `--font-body` at request time
   — components must respect that, not override it.

## DESIGN BAR — what "theme01 quality" means

theme01 is the **safe default**. Don't ship a hero that only looks
good for one niche, don't pick fonts without AR + Latin coverage,
don't choose accent treatments that depend on a specific brand
color. Every visual decision must work at:

- A beauty store (pastels, soft pinks, friendly typography)
- An electronics store (bold dark navy, sharp angles)
- A supplements store (greens, action-oriented)
- A general retail store (the partner's own choice)

**Reference quality bar:** Shopify's default themes (Dawn, Refresh,
Studio). They're niche-neutral but feel premium because they nail
the basics — typography hierarchy, generous whitespace, consistent
spacing rhythm, accessible contrast, smooth motion.

**RTL is a first-class concern, not an afterthought.** Test every
component in `lang="ar" dir="rtl"`. If your design assumes Latin
left-to-right reading order, it will break for ~70% of users.

**Mobile is the primary surface.** Algerian e-commerce traffic is
80%+ mobile. The bottom nav is part of theme01's identity — keep it.

## DATA CONTRACT — what each page receives

Pages already fetch via `getStoreContext()` and `fetchProductByHandle(handle)`
from `@/core/api/client`. Your job is to render what they pass to your
components. Don't fetch in components — pass props.

Key shapes (from `src/core/api/types.ts` + `src/core/api/validation.ts`):
- `Product` has `id, name, description, price, compareAtPrice,
  images[], variants[], offers[], inventory, trackInventory, …`
- `ProductVariant` has `id, price, compareAtPrice, inventory,
  variations: Record<string, string>` (e.g. `{"Size": "M",
  "Color": "Red"}`).
- `Offer` has `discountType: "free" | "free_shipping",
  triggerQuantity, rewardQuantity, …`
- `StoreConfig` has `name, currency, currencySymbol, primaryColor,
  accentColor, lang ("ar" | "en"), reviewsEnabled, …`
- `StoreFrontContent` (from `src/theme/content/types.ts`) — the
  resolved language pack passed to every component as `content`.

## TECHNICAL GOTCHAS — already paid for in production

These are real bugs we've shipped fixes for. Do not re-introduce.

1. **No `<ClientRouter />` (Astro view transitions).** It caused
   `/_astro/page.<hash>.js` to be re-served with empty Content-Type
   on the deployed Worker, killing every interactive script.
   Removed in v1.0.90. If soft navigation is genuinely needed, ask
   the human first.

2. **No `astro:page-load` event listeners.** That event is part of
   the transitions module — it never fires without ClientRouter.
   Use `DOMContentLoaded` (or run-now-if-already-ready):
   ```js
   if (document.readyState === "loading") {
     document.addEventListener("DOMContentLoaded", init);
   } else {
     init();
   }
   ```

3. **Dropdown visibility uses inline `display: none`, NOT a
   `.hidden` class.** Tailwind class ordering can leave
   `.hidden`-classed absolutely-positioned divs visible and
   click-trapping the form underneath. Reference:
   `src/theme/components/ui/Select.astro` (already fixed in
   v1.0.88). Carry the same pattern into any new dropdown / popover
   / drawer.

4. **No `transition:name=*` / `transition:persist` directives.**
   Same reason as #1.

5. **Don't add a `_headers` file in `public/`.** Doesn't apply to
   programmatic Worker deploys via the Cloudflare API path. Was tried
   in v1.0.89, didn't work, removed.

6. **D1 has no transactions in this codebase.** Sequential awaits
   only. (You shouldn't be touching DB code anyway — see DO NOT
   TOUCH.)

## Tailwind notes for theme01

- Project uses **Tailwind v4** via `@tailwindcss/vite` and
  `@import "tailwindcss"` at the top of `global.css`.
- theme01 uses the `@theme {}` block to bridge Tailwind utility
  classes (e.g. `bg-primary`, `text-primary`) to runtime CSS
  variables. This is fine — the `@theme` mapping points at variables
  that `:root` (or BaseHead's runtime block) defines.
- You may use Tailwind utilities for layout (`flex items-center
  gap-4`, `grid-cols-3`) and the `@theme`-bridged colors
  (`bg-primary`, `text-primary`). Do **not** use Tailwind raw colour
  utilities (`bg-purple-500`, `text-red-600`). Always go through the
  token.

## Quality bar before you say "done"

A page is done when:

- ✅ Hex literal grep (`#[0-9a-fA-F]{3,6}`) inside
  `src/theme/components/**` and `src/pages/**` returns zero hits.
- ✅ Visible-string grep inside `.astro` template bodies returns no
  English / Arabic / French copy that isn't from a content key.
- ✅ All three locale files (`ar.ts`, `fr.ts`, `en.ts`) parse and
  satisfy `StoreFrontContent`. (TypeScript will tell you.)
- ✅ The page renders cleanly in `npm run dev` AND in
  `wrangler dev` (the deployed Worker is the source of truth — dev
  alone is not enough).
- ✅ DevTools console is empty on a freshly-loaded product page.
- ✅ All clickable elements respond on first click. Touch & drag
  the gallery on mobile. Bottom nav active state updates on
  navigation.
- ✅ Page renders correctly in **all three** of `lang=ar/dir=rtl`,
  `lang=fr/dir=ltr`, `lang=en/dir=ltr`. Spot-check the order form,
  the gallery, and the navigation.
- ✅ Lighthouse mobile score on the PDP is ≥ 85 Performance and
  ≥ 95 Accessibility (theme01's target is 100 Accessibility — don't
  regress it).
- ✅ This `THEME_GUIDE.md` reflects whatever new components you
  added. Every component you create needs a one-line entry in the
  Component Inventory section above.

## Where to look when stuck

- **Need a component pattern?** theme01's existing components
  already cover most cases. Read first, mirror the style.
- **Need to know what an action returns?** Read
  `src/core/actions/` and `src/core/api/types.ts`.
- **Need an example of token usage?** `Header.astro`, `Footer.astro`,
  `OrderForm.astro` are token-clean. Match that style.
- **Need to verify a deployment quirk?** `git log --oneline
  cod-astro/theme01/` — recent `fix(cod-astro)` commits each
  document a real production incident.

## What "improving theme01" looks like

Good moves:
- Tighten typography rhythm and vertical spacing
- Add motion polish (more uses of `--animate-spring`)
- Improve the empty / error / loading states (often skipped)
- Improve PDP conversion (sticky CTA on mobile, trust strip below
  the buy button, scarcity / social proof if data is available)
- Clean up token-violating inline styles you find while working

Bad moves:
- Replacing the Cairo font with a Latin-only display face (breaks
  Arabic stores)
- Swapping rounded cards for sharp ones (that's theme02's identity)
- Removing the bottom nav (it's theme01's identity)
- Adding a hero pattern that only works for one niche

When in doubt, the question to ask is: *"Does this still work for
a beauty store, an electronics store, a supplements store, and a
general retail store, in three languages?"* If the answer is no,
you're in theme02 (or theme03+) territory.
