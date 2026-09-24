# theme01 — repository instructions for coding agents

`cod-astro/theme01` is the swappable storefront theme for CodFlow (Astro,
Cloudflare Workers, AR/FR/EN). It is a **theme layer, not a platform package**:
engine logic lives in the CodFlow platform (see `cod-server`). Read the root
`AGENTS.md` too — this file only overrides what differs here.

## Layout

- `src/core/` — platform-owned engine. **Do not modify.** All HTTP calls go
  through `src/core/api/client.ts`; Astro action/middleware proxies at
  `src/actions/index.ts` and `src/middleware.ts` re-export from here.
- `src/theme/` — the swappable theme layer: components, layouts, styles,
  config, content (AR/FR/EN string packs). This is where customization lands.
- `public/`, `scripts/` — static assets and repo-owned validator scripts.

## Commands

This package is part of the root npm workspace. Install at the repo root
(`npm ci`), then run inside this directory:

```sh
npm run dev         # astro dev :4321 (expects cod-server on :8787)
npm run build       # astro build
npm test            # vitest --run (unit/property tests)
npx astro check     # typecheck + diagnostics
npm run validate    # string + style validators, then build
```

There is no `typecheck` script; `npx astro check` is the typecheck for this
package. CI runs `astro check` + `npm test` for theme01 (plus typecheck +
tests for cod-server, cod-client-astro, and the legacy cod-client).

## Boundaries

- Keep engine logic out of the theme. Changes that belong in the platform
  (API shape, validation, order flow) go in `cod-server` / `cod-shared`, not
  here.
- Never modify `src/core/` — the core is versioned with the platform and
  breakage there breaks orders.
- All user-facing text needs AR/FR/EN translations and must keep RTL working.
- The theme stays swappable: a new theme is a new folder, not edits to core.

## Conventions & traps

- **No hardcoded user-facing strings** — add content keys to the language packs.
- **No hardcoded design tokens** (colors, radii, fonts) in component styles.
  See `THEME_GUIDE.md`.
- The `"overrides": { "vite": "^8.2.2" }` pin lives in the **root**
  `package.json` (npm ignores overrides inside workspace members) and is
  load-bearing: it keeps a single Vite major across astro/vitest/plugins.
  Removing it reintroduces a dev-server boot crash; bump it together with
  astro's Vite major. `npm ls vite` must show one version.
- `COD_SERVER_URL` is never set in `wrangler.jsonc` — `npm run deploy`
  (scripts/deploy.mjs) injects it at deploy time from the repo-root `.env`
  and refuses a localhost value without `--force-local`. Local dev reads it
  from this package's `.dev.vars`. Real secrets go in `.dev.vars` (gitignored)
  or `wrangler secret put` — never in `wrangler.jsonc`.
- `MEDIA_DOMAIN` is optional; unset, the image optimizer passes URLs through
  unchanged.
- **astro-icon uses an explicit allowlist** (`icon({ include: { heroicons: […] } })`
  in `astro.config.mjs`). An icon used in markup but missing from it throws
  *at request time* — `astro check`, the validators and the component tests all
  pass, and the page 200s with an empty body. `src/theme/icon-allowlist.test.ts`
  guards both directions; add the name to the list in the same commit.
- **Tailwind v4 compiles `translate-x-*` to the `translate` property, not
  `transform`.** Setting `element.style.transform` from a script does not
  override it. `rtl:` is also **not** a configured variant here, so
  `rtl:-translate-x-full` compiles to nothing. Both bit the cart drawer: it
  un-hid one full width off-screen and never appeared. Open/closed geometry
  belongs in CSS keyed on a data attribute — see `CartDrawer.astro`.
- **Scripts here self-initialise on import** (`product.ts`, `cart-ui.ts`,
  `turnstile-field.ts`), because ClientRouter was removed and `astro:page-load`
  never fires. A layout that *also* calls the init function binds every handler
  twice — one tap adding two items. Import for side effect; `initCart()` and
  `initCheckout()` are idempotent per root and return a teardown.
- **Every page that renders the customer form must load
  `track-abandonment.ts`.** Forgetting it loses the merchant's callback leads
  silently. `src/theme/page-contracts.test.ts` enforces this for every page that
  loads `otp-step.ts`.
- The same-origin proxies in `src/core/endpoints/` re-validate with their own
  Zod schemas and **Zod strips unknown keys** — a field missing from a proxy
  schema never reaches cod-server, however correct the caller is.