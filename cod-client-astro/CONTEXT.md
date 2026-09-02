# cod-client-astro — Context

The merchant dashboard, rebuilt as a prerendered Astro app so that page serving
consumes zero Worker CPU on Cloudflare's free plan. The only server surface is
`/api/auth/*` (better-auth). All business data is fetched by the browser from the backend
(`PUBLIC_API_URL`) and authorized there.

Read `README.md` (setup + environment contract) and `DESIGN.md` (design
system) before changing anything here.

## Language

### Shell

A prerendered `.astro` page: static HTML skeleton plus islands. Shells contain
no data and no secrets — they are public files. Route protection happens in the
browser bootstrap (session redirect) and in cod-server (data authorization),
never in Astro middleware (it runs at build time for prerendered pages).

_Avoid_: protected page, server-rendered guard

### Island

A React component hydrated on the client for interactive regions (tables,
forms, dialogs). Islands fetch their own data through the API seam and own
their loading/error states. Everything else stays plain `.astro`.

_Avoid_: client component sprawl, whole-page hydration

### Identity

`{ user, role, scopes } | null` — the single shape every component consumes to
render RBAC-aware UI. Sourced from better-auth's session response (`role` is a
user additionalField; scopes join from `user_scopes`). Consumed through
`useIdentity()` / `canScope()` from the `RequireAuth` module — one hook, never
scattered lookups.

_Avoid_: role checks via ad-hoc fetches, duplicated scope lists

### Dictionary

All UI strings come from `src/i18n/` — never hardcoded in components. Source of
truth: `locales/{ar,en,fr}/{namespace}.json` (bundled at build time by
`dictionaries.ts`). `useT(namespace)` returns the translator; missing keys fall
back to
english, then render the raw key so gaps stay visible. Locale persists in
`localStorage.locale` (+ mirrored cookie), applied to `<html lang/dir>` by a
pre-paint inline script — no wrong-direction flash. LanguageSwitcher persists
and reloads to swap dictionaries wholesale.

_Avoid_: hardcoded UI strings, per-component string maps, wrangler-driven client text

### Silent gates

Auth transitions are invisible: at most ONE unlabeled spinner while the session
is checked or the redirect fires (`window.location.replace`, no history spam).
Never render labeled intermediate states ("Checking session…", "Redirecting…"),
dev badges, or placeholder copy in shipped UI. The static wrapper divs carry
`data-auth-gate` markers so build-time scans can prove gating shipped.

_Avoid_: labeled auth states, dev/stage copy, double spinners

### API seam

`src/lib/api.ts` — the only module allowed to call the backend API
(`PUBLIC_API_URL`). Attaches the bearer JWT, parses the platform error
envelope (`cod-shared/errors/codes.ts`), enforces explicit pagination
arguments. Components never call `fetch` directly.

_Avoid_: inline fetches, unpaged list requests, raw error strings

### Auth surface

`src/lib/auth/*` — the ported better-auth instance plus its catch-all route.
Configuration mirrors production `cod-client/lib/auth.ts`; the only permitted
SSR surface of this worker. Secrets contract: exactly one secret,
`BETTER_AUTH_SECRET`.

_Avoid_: second auth mechanism, new env-var shapes, cookie logic outside this module

## Boundaries

Terms owned by neighbors — use, don't redefine:

- **Schema / queries / RBAC scopes / error codes**: `cod-shared` (relative import)
- **Authorization enforcement**: cod-server. This app renders UI per identity but trusts nothing; the server is the wall
- **Storefront theming**: `cod-astro/theme01` owns its own style system; this dashboard does not import theme code
- **Legacy dashboard**: `cod-client` (Next.js) is a historical behavior reference only — this package is the primary dashboard

## Edge cases

**Static shells are public**: anyone can download the HTML/JS. That must stay
true — if a secret or personal datum would end up in a shell, it belongs behind
the API seam instead.

**Language switching**: default `ar` + `dir=rtl`. The `html[lang]` attribute
drives the Cairo/Inter font switch via CSS variables (same mechanism as the
Next app). Language state lives client-side; shells ship both font faces.

**No middleware-based auth**: any temptation to "protect" a route in
`src/middleware.ts` is wrong for prerendered routes by construction. If a page
genuinely needs per-request server decisions, it becomes an SSR route with
`prerender = false` — an exception requiring plan-level justification.
