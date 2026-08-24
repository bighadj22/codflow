# Wilayas Context

Algeria's administrative geography as read-only reference data: the 58 provinces and their communes that every address, delivery fee, and dispatch target ultimately points at.

## Language

### Geography

**Wilaya**:
One of Algeria's 58 provinces. Its official government number (1–58) doubles as the primary key across orders, shipping rules, driver pay grids, and carrier lookups — it is an integer everywhere, never a UUID.
_Avoid_: State, region, department

**Commune**:
A municipality within a wilaya, addressed by a text ID in `c-XX-YYY` format where XX encodes the wilaya number (e.g. `c-16-001`). The precise destination unit for addresses.
_Avoid_: City, district, town

**Postal Code**:
The zero-padded five-digit string carried by each commune (e.g. `16001`). A lookup aid — most notably for stop-desk matching — never a substitute for the Commune ID.
_Avoid_: ZIP code, commune number

**Bilingual Names**:
Every record carries a French name (`name`) and an Arabic name (`nameAr`); search matches either script.
_Avoid_: Translations, localized labels

### Reference Data Rules

**Read-Only Reference**:
No create, update, or delete endpoints exist anywhere in this module. The dataset changes only through system seeds and migrations.
_Avoid_: Catalog management, admin editing

**Open Access**:
Any authenticated user may read the geography — no RBAC scope beyond login is required.
_Avoid_: Public API, restricted reference

**Official Ordering**:
Wilayas always list in official-number order; communes list alphabetically by Latin name.
_Avoid_: Sorted results, custom ordering

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Prices per wilaya or commune**: Shipping Profiles context — geography carries no pricing whatsoever
- **Customer addresses**: Customers / Orders contexts consume these IDs, they don't produce them
- **Driver coverage grids**: Drivers context references wilaya IDs only
- **Carrier territories and Station Codes**: Delivery context maps carriers onto this geography their own way

## Edge Cases

**Tolerant ID parsing**: Path parameters like `16abc` parse as `16` and are accepted — route validation deliberately mirrors the handler's `parseInt` semantics so clients are never surprised by a stricter layer.

**ID ≠ Postal Code**: `c-16-001` identifies the commune; `16001` is its postal code. Similar digits, entirely different fields — conflating them breaks stop-desk and address flows.

**Some Arabic names are empty**: The seed contains communes with blank `nameAr`; searching by Arabic simply won't match those rows.

**No pagination**: Both listings always return complete results — there is no limit or offset to reason about.
