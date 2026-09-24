# Store Pages Context

Merchant-owned content pages: the four legal documents Meta Ads requires before it will run a store's ads (Terms, Privacy, Refund/Return, Shipping), plus any custom page a merchant adds later. See report-md/LEGAL_PAGES_PLAN.md.

## Language

**Store Page**:
One row in `store_pages` — identity and publication state (kind, slug, status, footer visibility, position). The words live elsewhere.
_Avoid_: Page, Document

**Legal Page**:
A Store Page whose `kind` is terms/privacy/refund/shipping. Seeded automatically, can be unpublished but never deleted.
_Avoid_: Policy page, required page

**Custom Page**:
A Store Page whose `kind` is `custom` — merchant-authored from scratch, no template behind it, can be deleted outright.
_Avoid_: Extra page, free-form page

**Translation**:
One row in `store_page_translations` — one locale's title + body for one Store Page. A page and its translations are 1-to-many; a store serves exactly one locale (`stores.lang`) at a time.
_Avoid_: Locale, version

**Template**:
The pre-written prose for one legal kind in one locale (`cod-shared/legal/templates/`), written as typed data (sections/blocks), not an HTML string — a clause with no merchant fact behind it is never rendered, not rendered with a placeholder.
_Avoid_: Boilerplate, default text

**Legal Profile**:
The merchant facts (`store_legal_profile`) a template is rendered with — RC/NIF, contact details, return window, delivery window. One profile per store; substituted into every legal kind's templates.
_Avoid_: Business info, company details

**Source**:
A translation's `template`/`merchant` flag. `template` means still the untouched seed — never reviewed. Flips to `merchant` the first time it is saved, permanently, until an explicit reset.
_Avoid_: Status, edited flag (status already means published/draft on the page)

**Seed**:
Creating a store's four legal pages (all three locales each) from the current templates. Idempotent — skips any kind the store already has. Never happens as a side effect of a read.
_Avoid_: Initialize, bootstrap

**Reset (to template)**:
Discarding one locale's saved translation and re-rendering it from the current template + the store's legal profile. Only legal kinds have a template to reset to.
_Avoid_: Restore, revert

**Write chokepoint**:
`writeTranslation` in `cod-shared/queries/store-pages.ts` — the only function that ever assigns `body_html`. Sanitises via the same HTMLRewriter allow-list product descriptions use, derives `body_plain`. Every write path — merchant save, seed, reset — goes through it, template content included (proven safe, not merely trusted).
_Avoid_: Save function, write handler

## Boundaries

Terms owned by neighboring contexts:

- **Storefront rendering**: `/pages/<slug>` in theme01 renders whatever `resolvePublishedPage` returns with `set:html`, never re-sanitising — same contract as a product's rich-text description.
- **Rich-text sanitisation rules**: owned by `cod-shared/lib/rich-text.ts` (products' context). This module calls it; it does not define the allow-list.
- **Which store**: this deployment is single-tenant — `getStore(db)` (stores context) resolves "the" store once per request; store-pages never resolves it itself.

## Edge Cases

**A store with no legal profile still gets four complete pages**: every clause guarded on a merchant fact (RC number, contact, return window) is simply omitted, never rendered with a placeholder like `[YOUR EMAIL]`.

**Filling in the legal profile does not retroactively edit already-seeded pages**: a page only changes on an explicit reset, per locale. This is deliberate — a merchant who already reviewed and edited a page must not have it silently rewritten underneath them.

**A legal page can be unpublished but never deleted**: it is the artefact Meta looks for. `deleteStorePage` refuses with `STORE_PAGE_CANNOT_DELETE_LEGAL` for any kind but `custom`.

**"Reset to template" on a custom page is refused, not a no-op**: `STORE_PAGE_NOT_LEGAL` — a custom page was never seeded from anything, so "reset" has no meaning to fall back to silently.

**Switching a store's language never reveals a blank policy page**: seeding always writes all three locales for every legal kind, even though the storefront only ever serves one.
