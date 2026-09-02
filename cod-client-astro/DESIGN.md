# CodFlow Astro Dashboard Design System

## Direction

CodFlow is a merchant workbench for Algerian cash-on-delivery operations. Its
visual source is the supplied Shopify Admin references: a charcoal global
utility bar, light navigation rail, cool-gray workspace, white operational
surfaces, compact typography, and restrained semantic color. CodFlow keeps its
own identity, terminology, Arabic-first behavior, and delivery workflows.

The interface is operational, compact, and calm. It should feel reliable when
used for long order-processing sessions on desktop and for quick decisions on
mobile. It must not use the previous dashboard's decorative glass cards, glow
blobs, gradient surfaces, or oversized rounded compositions.

## Palette

- Utility header: charcoal `#1A1A1A` with white controls and low-contrast search field.
- Workspace: cool gray `#F6F6F7`; navigation rail `#EBEBEB`; surfaces white `#FFFFFF`.
- Structural border: `#E1E3E5`; input border: `#8C9196`; primary text: `#202223`; secondary text: `#6D7175`.
- Primary actions: charcoal `#202223` with white text. Links: blue `#2C6ECB`.
- CodFlow mark: luxury amethyst `#6D28D9`; do not use it as a general action color.
- Status colors are semantic only: green success, yellow pending, blue information, red return/error, gray neutral.

### Dark mode — "Midnight Amethyst"

Dark mode is not gray-on-gray. It is the same system inverted around a
purple-tinted charcoal scale so surfaces step visibly lighter as they elevate:

- Elevation ladder (dark to light): topbar `#0C0E0D`, canvas `#121513`,
  rail `#171B18`, card `#1C201D`, popover/overlays `#232824`, fills/hovers `#2A302B`.
- Borders are whisper hairlines (`#303632`; rail `#262B27`), never heavy outlines;
  input borders sit at `#4A524C`.
- Text: near-white `#EDF1EE` with secondary text `#9BA39D`. Primary actions invert
  to the light token (`#EDF1EE`) with deep charcoal-green label text.
- Brand presence: accent fills are translucent amethyst (`#6D28D9` at ~16%
  with `#C4B5FD` foreground) — used for identity tiles and highlights.
- Status chips are translucent tinted glass over the surface: ~10–14% color fill,
  ~30% matching border, bright tinted text (success chips carry the brand green).
  Never opaque muddy blocks.
- Links and focus rings stay blue (`#86B6FA` / `#8AB4F8`) for cross-mode familiarity.

## Typography

- Arabic: Cairo Variable.
- English and French: Inter Variable with Cairo fallback for Arabic data.
- Body copy is 15px with normal letter spacing.
- Page titles are 24px and bold, not display-scale.
- Labels use 11px to 12px semibold text when compact metadata is needed.
- Do not use all-bold text, negative tracking, or decorative display typography.

## Geometry And Elevation

- Control height: 36px to 40px.
- Standard control radius: 8px. Operational surfaces use 12px. Status labels use 8px rather than full pills.
- Surfaces use 1px borders and restrained soft shadows only when elevation clarifies layering.
- No nested cards. Page regions are layouts; cards frame repeated items, tables, and focused tools.
- Use 4px-based spacing with 8px as the dominant rhythm.

## Shell

- Desktop: full-width 56px charcoal utility bar above a 240px persistent navigation rail and scrollable content column.
- Sidebar: grouped navigation on `#EBEBEB`; active item is a white 8px-radius row with restrained shadow.
- Utility bar: CodFlow mark at the start, centered global search, locale/appearance/account controls at the end.
- Mobile: the same 56px utility bar plus an accessible light navigation drawer.
- Auth screen: one centered rounded card split into a form panel and a media panel.
  The form panel carries the brand mark top-start, a locale selector top-end, and a
  centered narrow column (title, subtitle, labeled fields, full-width dark action).
  The media panel is a full-height brand-tinted visual placeholder on the end side
  and is hidden below `lg`. The current route is always communicated by navigation
  state and page heading.

## Data Surfaces

- Tables are compact, bordered, and horizontally scrollable only when necessary.
- Mobile tables become stacked, tappable rows with the primary identifier first.
- Order number is the primary link; customer, status, and COD total are the first scanning fields.
- Status pills are semantic and compact, never the main visual hierarchy.
- Every async surface has loading, error, empty, and filtered-empty states.

## Interaction

- Primary actions are text plus a familiar Lucide icon when both improve scanability.
- Icon-only actions require an accessible label and a tooltip/title when the action is not obvious.
- Touch targets are at least 40px in the dashboard shell and 44px where mobile actions are primary.
- Keyboard focus is visible with the primary ring.
- Arabic switches the document to RTL; directional icons mirror where meaning requires it.

## Migration Rules

- New pages must use `DashboardChrome`; do not create a parallel shell.
- New strings belong in `locales/{ar,en,fr}` and are consumed through `useT`.
- New routes must be real before they appear in navigation.
- Preserve the API seam and auth gate; visual migration must not move authorization into the client.
- Keep desktop and mobile behavior equivalent for the merchant's core task.
