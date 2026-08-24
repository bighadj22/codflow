# Product Groups Context

The category tree merchants sort products into for the storefront: nested collections with display order, SEO fields, and a live product count that doubles as the deletion guard.

## Language

### Tree Shape

**Product Group**:
A named category or collection products are filed under — the same record other contexts call "category". Names may repeat; slugs cannot.
_Avoid_: Category row (legacy naming), collection, folder

**Parent Link**:
An optional reference nesting a group under another, forming an unlimited tree. The link is application-level only — no database constraint guards it.
_Avoid_: Hierarchy constraint, tree FK

**Child List**:
The immediate sub-categories of a group, returned only one level deep — walking deeper requires following each child in turn.

**Position**:
A merchant-controlled integer deciding display order among siblings and across listings; lower sorts first.
_Avoid_: Sort index, priority

### Identity

**Slug**:
The group's URL-safe identifier: lowercase letters, numbers, hyphens — auto-generated from the name plus an ID suffix when omitted. Unique by database constraint alone.
_Avoid_: Name (duplicates allowed), handle

**Group SEO Fields**:
Optional meta title (≤60), description (≤160), and keyword string consumed by storefront category pages.
_Avoid_: Ad settings, marketing copy

**Group Image**:
An optional picture URL for the category's storefront presentation.
_Avoid_: Product photo

### Counting & Deletion

**Product Count**:
A live computation of non-deleted products filed under the group — **regardless of lifecycle status**, so drafts and archived items count too. It drives both display badges and the deletion guard.
_Avoid_: Active product count, sales count

**Membership Guard**:
A group holding any counted product refuses deletion until those products are reassigned or removed. Empty groups delete permanently and immediately.
_Avoid_: Cascade warning, soft delete

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Products carry the link**: Products context stores `categoryId` on each product; groups never track their members
- **Storefront rendering**: Store context reads this tree for navigation and category pages
- **No pricing, no stock**: groups are pure organization — fees and inventory live elsewhere
- **Audit trail**: unlike every sibling module, these handlers write no Activity Log entries today

## Edge Cases

**Drafts block deletion**: Because the count ignores lifecycle status, a group containing only draft or archived products still refuses deletion — move or delete those products first.

**Cycles are possible**: Nothing prevents setting a parent chain that loops back on itself; tree walkers must guard against infinite descent.

**Orphaned parents are possible**: Deleting is guarded, but pointing `parentId` at a nonexistent ID succeeds silently — the child simply dangles.

**Slug collisions crash late**: Uniqueness is database-enforced only; duplicate slugs surface as raw constraint errors rather than friendly conflicts.

**Renaming keeps the old slug**: Slug changes only happen when explicitly requested — editing a name never regenerates it.
