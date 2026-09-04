# Store Settings Context

The merchant's control panel for their one store: branding, theme, language, storefront text, SEO, the Meta pixel that powers conversion tracking, and the outbound email integration. Everything here shapes what shoppers and teammates see; nothing here records transactions.

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
The Meta pixel integration: pixel ID, ad-account label, access token, the conversion-event choice, and an enabled switch. Absent until first saved; upserted thereafter.
_Avoid_: Analytics account, tracking cookie

**Ad Account Name**:
The merchant's own label for the Meta ad account this pixel belongs to — reference only, never sent to Meta.
_Avoid_: Account ID, billing account

**Conversion Event**:
The merchant's choice of which Conversions API event to optimize for — Lead at order placement or Purchase at confirmed delivery. Saving requires the choice explicitly; the platform never defaults it for the merchant.
_Avoid_: Default event, optimization goal, primary event

**Test Mode**:
A switch routing Conversions API events to Meta's test stream instead of production measurement. Browser pixel events are unaffected — Meta's Test Events tool catches those itself.
_Avoid_: Sandbox, debug mode, staging

**Test Event Code**:
The code Meta's Test Events tool generates — attached to server events only while Test Mode is on, and never counted for real measurement.
_Avoid_: Debug code, sandbox key

**Access Token**:
The Meta system-user token used for server-side events. Write-only through the API — reads return a masked hint, and saving with an empty token keeps the stored one.
_Avoid_: API key, login credential

### Email

**Email Config**:
The Sendili integration row: API key, from address, optional sender name, and an enabled switch. Absent until first saved. No row = email sending disabled (safe default — same rule as the verification config).
_Avoid_: SMTP settings, mail account

**From Address**:
The sending address; its domain must be verified in the merchant's Sendili workspace or every send is refused. The dashboard picks it from the verified-domain list, so merchants never guess.
_Avoid_: Sender account, reply address

**Accepted, Not Delivered**:
A Sendili 200 means the message was queued, not that it arrived — delivery is the receiving mail server's decision. Nothing in CodFlow ever claims "delivered" from a send response.
_Avoid_: Delivery confirmation

**Suppressed Recipient**:
An address Sendili stopped delivering to (hard bounce or spam report). Skipped without charge and listed in the send result; a fully-suppressed send is recorded as rejected.
_Avoid_: Bounced list, blacklist

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Public reading of this configuration**: Store context (`/store/*`) renders it; changes here appear there instantly
- **Delivery pricing**: Shipping Profiles context — nothing in these settings sets a fee
- **Team access**: Users context — admin role gates every endpoint here
- **Review content**: Reviews context owns moderation; the switch here merely silences the channel
- **What gets emailed and how it survives failure**: the transactional email module (cod-shared) owns the send path; this context only stores its configuration

## Edge Cases

**Status is stored, not enforced**: Flipping the store to `inactive` writes the flag but no audited code path blocks the storefront or dashboard because of it.

**No escape from single tenancy**: Every handler resolves the lone store implicitly — an ID parameter would be meaningless, so none exists.

**Currency symbol is cosmetic**: Merchants can retitle the symbol shoppers see while every amount in the system remains DZD integer math underneath.

**Pixel token keeps on empty**: Saving without an access token keeps the previously stored token — the key is write-only and reads return only a masked hint (same rule as the verification and email keys, ADR-0001). Saving still requires the conversion-event choice.

**The email key never comes back**: Like the verification key, the Sendili API key is write-only through the API — reads return a masked hint, and saving with an empty key keeps the stored one. (Storage decision: ADR-0001.)
