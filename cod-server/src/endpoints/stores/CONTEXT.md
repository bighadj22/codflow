# Store Settings Context

The merchant's control panel for their one store: branding, theme, language, storefront text, SEO, and the Meta pixel that powers conversion tracking. Everything here shapes what shoppers see; nothing here records transactions.

## Language

### Identity

**Store**:
The single tenant itself — exactly one row per database. Endpoints address it implicitly (`/me`); there is no store list, no creation, no deletion anywhere.
_Avoid_: Account, shop profile

**Single Tenancy**:
The architectural rule that one D1 database serves exactly one merchant's store. It is why every other context never asks "whose data is this?"
_Avoid_: Multi-tenant mode, workspace

**Store API Key**:
The plaintext secret the storefront presents to authenticate. Written at provisioning and deliberately viewable by the merchant in settings — unlike the separate provisioned-key table that stores only hashes.
_Avoid_: Dashboard API key (team members' credential)

### Configuration

**Theme Settings**:
The visual identity: active theme slug, three colors (primary, accent, background) as 3–8 digit hex values allowing alpha, and font family with an optional web-font URL.
_Avoid_: CSS, stylesheet overrides

**Localization**:
Interface language (Arabic or English) plus the currency symbol shown to shoppers. The currency code itself stays fixed to DZD across the platform.
_Avoid_: Multi-currency support

**Content JSON**:
Every shopper-facing text string as one serialized blob the theme reads — the reason no copy is hardcoded in templates.
_Avoid_: Translations file, hardcoded strings

**SEO Fields**:
Meta title, description, and Open Graph image consumed directly by storefront server rendering.
_Avoid__: Marketing settings, ad config

**Announcement Bar**:
Optional banner text; null hides it entirely.
_Avoid_: Notification, popup

**Reviews Switch**:
The master gate for social proof — off hides reviews on the storefront and disables submitting them.
_Avoid_: Rating toggle, feedback switch

### Tracking

**Pixel Config**:
The Meta pixel integration: pixel ID, access token, optional test-event code, and an enabled switch. Absent until first saved; upserted thereafter.
_Avoid_: Analytics account, tracking cookie

**Test Event Code**:
A routing flag that sends events to Meta's test stream during integration work — must be cleared for production measurement.

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Public reading of this configuration**: Store context (`/store/*`) renders it; changes here appear there instantly
- **Delivery pricing**: Shipping Profiles context — nothing in these settings sets a fee
- **Team access**: Users context — admin role gates every endpoint here
- **Review content**: Reviews context owns moderation; the switch here merely silences the channel

## Edge Cases

**Status is stored, not enforced**: Flipping the store to `inactive` writes the flag but no audited code path blocks the storefront or dashboard because of it.

**No escape from single tenancy**: Every handler resolves the lone store implicitly — an ID parameter would be meaningless, so none exists.

**Currency symbol is cosmetic**: Merchants can retitle the symbol shoppers see while every amount in the system remains DZD integer math underneath.

**Pixel defaults fill silently**: Saving without an access token stores an empty string and enables tracking — omission equals permissive.
