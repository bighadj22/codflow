# WhatsApp OTP Verification — Feature Plan

Storefront phone verification at checkout via the **dzverify** WhatsApp OTP
API, plus a merchant dashboard settings page. Optional, **off by default**,
per-store configurable, production-grade, fully tested.

**How to use this file**: work slices in order. Mark each `DONE ✅` with the
date when its checklist is fully green. Every slice ends with typecheck +
tests passing in every touched package, or it is not done.

## Product definition

**What it does**: when a merchant activates it, a customer placing an order
on the storefront gets a 6-digit code on WhatsApp and must enter it before
the order is placed — verifying the phone number is real and reachable.

**What it is NOT**:
- Not a hard checkout blocker when the service is unavailable (see
  Fail-open contract below)
- Not applied to dashboard-created orders (merchant trusts their own input)
- Not a login/2FA mechanism

**Activation flow (merchant)**: Dashboard → Settings → Verification → paste
dzverify API key → Test connection (shows balance / plan) → toggle Enabled →
Save. Until a row exists, the feature is completely inert — nothing in the
storefront changes, zero API calls, zero cost.

## dzverify API — verified facts (source of truth for this plan)

Provider: dzverify, `https://api.dzverify.com`, REST + JSON.

- **Auth**: `X-API-Key` header. Keys carry scopes; defaults are
  `otp:send`, `otp:verify`, `otp:read`. `usage:read` is NOT default — needed
  for the quota endpoint.
- **Send**: `POST /v1/otp/send` body `{ recipient: "+213612345678", language?
  ("en"|"fr"|"ar"), maxAttempts? (1–10, def 5), ttlSeconds? (60–900, def 300) }`
  → `201 { success, data: { id, recipient, channel: "WHATSAPP", status:
  "SENT", attempts, maxAttempts, ttlSeconds, expiresAt, sentAt, verifiedAt,
  createdAt } }`. The 6-digit code is NEVER in any response — only the end
  user's WhatsApp.
- **Verify**: `POST /v1/otp/verify` body `{ requestId, code }` →
  `200 VERIFIED` (request is spent, can never verify again) |
  `422 VALIDATION_ERROR` wrong code, `details.attemptsRemaining` (retry) |
  `409 CONFLICT` terminal — expired / failed / already verified (send a new
  OTP) | `404 NOT_FOUND` unknown id.
- **Quota**: `GET /v1/account/quota` → `{ balanceCentimes, balanceDa,
  otpEstimate, plan: "trial"|"active"|"suspended"|"none", ... }`. Never 404;
  pre-onboarding accounts get a zeroed snapshot.
- **Errors**: `401 UNAUTHORIZED` (bad key) · `402 OUT_OF_CREDITS`
  (`details.reason`: exhausted / race_lost / no_quota_row / suspended) ·
  `403 FORBIDDEN` (missing scope) · `404` · `409 CONFLICT` (terminal) ·
  `422 VALIDATION_ERROR` (bad input / wrong retryable code) ·
  `422 BUSINESS_RULE_VIOLATION` (rate limit — `details.limit`,
  `details.windowSeconds`; or WhatsApp delivery failed) · `500 INTERNAL_ERROR`.
- **Rate limits**: 5 sends / recipient / hour · 200 sends / account / hour ·
  10 verifies / request / minute. Excess → 422 BUSINESS_RULE_VIOLATION.
- **Billing**: 5 DA (500 centimes) per successful send; refunded if WhatsApp
  rejects. Trial grant: 50 DA (10 OTPs).
- **Conventions**: phones are E.164 (`+213612345678`, no spaces/dashes).
  Timestamps are Unix milliseconds UTC. Unknown body fields → 422.

## Architecture decisions (read before implementing)

1. **Config storage — `store_otp_config` table, pixel-config pattern.**
   Dedicated per-store table, `store_id UNIQUE ... ON DELETE CASCADE`,
   `enabled integer NOT NULL DEFAULT 1`, `language text NOT NULL DEFAULT 'ar'`,
   `api_key text NOT NULL`. **No row = feature fully disabled (safe
   default)** — new repos / fresh setups get the old behavior for free. The
   dzverify key is merchant-managed integration config in D1 (same as carrier
   tokens and the pixel access token), NOT a wrangler secret — that is what
   makes per-merchant enable + dashboard editing natural.

2. **RBAC — new scope `SETTINGS_VERIFICATION: "settings:verification"`.**
   Guards the merchant config endpoints. Admins bypass via the `*`
   wildcard; non-admin staff can be granted just this scope. Also add a
   `settings` category to `SCOPE_CATEGORIES` grouping the (currently
   uncategorized) `SETTINGS_*` scopes — additive, consistent.

3. **Storefront endpoints — `auth: "store"` routes in a new
   `endpoints/store-otp/` folder** (second-router-at-`/store` precedent:
   abandoned-orders). Theme01 calls them server-side only; the browser never
   sees the store API key or the dzverify key.
   - `POST /store/otp/send` `{ phone }` →
     `{ status: "sent", requestId, expiresAt, maxAttempts }` or
     `{ status: "unavailable", reason, bypassToken }`
   - `POST /store/otp/verify` `{ phone, requestId, code }` →
     `{ status: "verified", otpToken }`

4. **Verification proof — HMAC-signed token, stateless.** After a successful
   verify, cod-server mints `otpToken = b64url(payload).b64url(hmac)` with
   payload `{ p: phone, e: expMs, t: "v" }`, HMAC-SHA256 keyed with
   `SHA-256(api_key + "codflow-otp-v1")` (Web Crypto; key rotates with the
   merchant's dzverify key — no new secret to manage). `POST /store/orders`
   recomputes and compares when the feature is enabled: token must be valid,
   unexpired (15 min), and match the normalized order phone. Orders carry the
   token in a new optional `otpToken` body field.

5. **Fail-open contract (the quota rule).** OTP is a conversion-quality
   feature, never a revenue blocker:
   - dzverify **402 OUT_OF_CREDITS** or **5xx/unreachable** at SEND time →
     server mints a **bypass token** (`t: "b"`, same signing, 15 min) and
     returns `status: "unavailable"`; the theme submits the order with it and
     checkout proceeds **unverified**. The bypass is server-attested — an
     attacker cannot mint one; it only exists when dzverify itself said the
     service can't run.
   - Wrong code / expired / attempts exhausted → **no bypass**; that is the
     flow working correctly (retry / request a new code).
   - Rate limits (422 BUSINESS_RULE_VIOLATION on send) → surfaced to the
     customer with the wait window; no bypass. Per-recipient limit = this
     phone spammed; account limit = protects merchant money.
   - `POST /store/orders` with the feature enabled but **no token** →
     rejected `OTP_VERIFICATION_REQUIRED` (defense in depth; the theme always
     sends either token).

6. **Phone normalization — Algeria-aware E.164.** Store order phones are
   free-form (`min 9 max 20`, no regex server-side). The OTP path normalizes:
   strip spaces/dashes; `0(5|6|7)XXXXXXXX` or `(5|6|7)XXXXXXXX` → `+213…`;
   already-`+213…` stays; other `+CC…` passes through. Un-normalizable →
   `400 INVALID_PHONE_FORMAT` (customer fixes the field). Token phone and
   order phone are compared AFTER normalization, so "0551234567" and
   "+213551234567" are the same customer.

7. **Storefront feature flag — `otpEnabled` on `GET /store/config`**
   (`reviewsEnabled` / `pixelId` precedent): true only when a config row
   exists AND `enabled`. The key never leaves the server.

8. **theme01 — engine/theme boundary respected.** Engine-shaped additions
   land in `src/core/` (API client functions, optional `otpToken` on the
   placeOrder action schema — additive only, no behavior change when absent;
   proxied endpoints), presentation lands in `src/theme/` (OTP step
   component, strings in the trilingual content packs). Re-read
   `cod-astro/theme01/AGENTS.md` before touching anything and run its
   validators (`npm test`, `npx astro check`, `npm run validate`).

9. **Dashboard — settings category "Verification"** modeled exactly on
   TrackingSettings: `SettingsSection` card, key field with show/hide eye,
   language select, enabled `role="switch"`, Save, plus a **Test connection**
   button hitting the quota endpoint (shows balance DA · OTP estimate · plan;
   a 403 there means the key lacks `usage:read` — report "key OK, quota
   unavailable" rather than failing).

10. **Cost-control guard on send (KV).** The `RATE_LIMIT` KV binding exists;
    add a light phone cooldown (60 s per store+phone) and an hourly per-IP
    cap (~20) before calling dzverify. KV is eventually consistent — fine for
    cost control; dzverify's own limits remain the hard bound. Failure of the
    KV write must never block a send (fire-and-forget reads/writes where
    possible).

## Design check (codebase-design)

- **dzverify client** = one deep module: small interface
  (`sendOtp`, `verifyOtp`, `getQuota`), all error taxonomy + envelope parsing
  hidden inside. Tests mock fetch — no network, ever.
- **Token module** = pure functions (sign / verify / normalize phone) — the
  whole security surface is unit-testable with zero infrastructure.
- **Order gate** = one function reused by the single order-creation path;
  no branching leaks into queries.
- The seam is the store's public API: `/store/otp/*` + `otpToken` field.
  theme01 depends only on that seam — swappable themes get OTP for free.

## Slices

### Slice 0 — Baseline & verification reads
- [ ] `cd cod-server && npm run typecheck && npm test` — record results (green before proceeding)
- [ ] Read (spot-verify, never assume): `endpoints/store/handlers.ts` (createStoreOrder + where the gate goes), `endpoints/store/validation.ts`, `endpoints/store/routes.ts`, `cod-shared/queries/store.ts` (getStoreConfig), `cod-shared/queries/pixel-config.ts`, `endpoints/stores/routes.ts` + `handlers.ts` (config endpoint pair), `cod-shared/rbac/scopes.ts` + `SCOPE_CATEGORIES`, `src/db/migrations/0005_store_pixel_config.sql`, `cod-shared/errors/codes.ts`
- [ ] Read theme01: `AGENTS.md`, `src/core/actions/index.ts`, `src/core/api/client.ts`, `src/theme/components/order/OrderForm.astro`, `src/theme/scripts/product.ts`, `src/theme/content/types.ts` (+ one language pack), `src/pages/products/[slug].astro`
- [ ] Read dashboard: `features/settings/*` (model, api, TrackingSettings, SettingsSection), `features/settings/components/SettingsPageApp.tsx`
- [ ] Confirm `abandoned-orders` convert path does NOT create orders (so the OTP gate has a single choke point) — record finding
- [ ] Record baseline test counts for cod-server / cod-client-astro / theme01

### Slice 1 — dzverify client + phone normalizer (pure, fully tested)
- [ ] `cod-server/src/endpoints/store-otp/dzverify.ts`: types (OtpRequest, QuotaSummary, error codes), `createDzverifyClient(apiKey)` with `sendOtp`, `verifyOtp`, `getQuota`; parses both envelopes; throws typed `DzverifyError { code, statusCode, details? }`
- [ ] `cod-server/src/endpoints/store-otp/phone.ts`: `normalizeAlgerianPhone(raw): string | null` (+ tests: local, +213, spaces/dashes, foreign +CC, garbage)
- [ ] `dzverify.test.ts`: fetch-mocked — success paths, every documented error code, rate-limit details, non-JSON body. No network.
- [ ] Verify: typecheck + tests green

### Slice 2 — Schema + shared queries + config exposure
- [ ] Migration `0012_store_otp_config.sql` (0005 style; ⚠️ schema change — flagged for owner approval, this plan is the approval request)
- [ ] `storeOtpConfig` in `cod-shared/db/schema.ts` (mirrors pixel config)
- [ ] `cod-shared/queries/otp-config.ts`: `getOtpConfig(db, storeId)` (undefined when absent), `upsertOtpConfig(db, storeId, data)`; `getOtpConfig` never selects api_key for storefront use — separate `getOtpConfigRaw` if needed (pixel-config pattern)
- [ ] `getStoreConfig` (cod-shared/queries/store.ts): expose `otpEnabled` (row exists && enabled) — key NOT exposed
- [ ] `StoreConfigSchema` (`cod-server/src/openapi/schemas/store.ts`): add `otpEnabled: z.boolean()`
- [ ] Tests: migration SQL reviewed line-by-line; query upsert idempotency; config exposure truth table (no row / row+disabled / row+enabled)
- [ ] Apply migration local; verify with a D1 query. Verify: green

### Slice 3 — Merchant config API + RBAC
- [ ] `SCOPES.SETTINGS_VERIFICATION = "settings:verification"` + `SCOPE_CATEGORIES` `settings` group (all SETTINGS_* scopes)
- [ ] Error codes: `OTP_VERIFICATION_REQUIRED`, `OTP_TOKEN_INVALID`, `OTP_PHONE_MISMATCH`, `OTP_QUOTA_EXHAUSTED`, `OTP_RATE_LIMITED` (+ usage review for phone format reuse)
- [ ] `endpoints/stores/` routes (defineRoute, route-builder skill): `GET /api/stores/otp-config` (sanitized — key masked to last 4), `POST /api/stores/otp-config` (upsert; empty key on update = keep existing), `POST /api/stores/otp-config/test` (quota call via stored-or-submitted key; 401→invalid, 403→"valid, quota scope missing", 200→balance snapshot)
- [ ] Handler tests following `handlers.test.ts` mock patterns; scope guard verified (403 without scope, admin bypass)
- [ ] Verify: green

### Slice 4 — OTP token module (pure, fully tested)
- [ ] `cod-server/src/endpoints/store-otp/token.ts`: `signOtpToken(apiKey, phone, type "v"|"b")`, `verifyOtpToken(apiKey, token)` → `{ phone, expiresAt, type } | null`; HMAC-SHA256 via Web Crypto; 15-min TTL; b64url; payload versioned (`v: 1`)
- [ ] Tests: round-trip, expiry, tamper (flipped byte → null), wrong key → null, type isolation (bypass ≠ verified), phone binding. Constant-time compare.
- [ ] Verify: green

### Slice 5 — Storefront send/verify endpoints
- [ ] `endpoints/store-otp/store-routes.ts` + `handlers.ts` + `validation.ts`; mount at `/store` in `src/index.ts` (abandoned-orders precedent); tags `["Storefront"]`
- [ ] `POST /store/otp/send`: load config (disabled → `OTP_NOT_ENABLED` 422); normalize phone; KV guards (60 s per store+phone, ~20/hr per IP — failures never block); call dzverify; map outcomes: 201 → `{status:"sent", requestId, expiresAt, maxAttempts}`; 402/5xx → `{status:"unavailable", reason, bypassToken}`; rate-limit 422 → `OTP_RATE_LIMITED` with `windowSeconds` context; delivery-failure 422 → surface message; 401/403 (bad merchant key) → `OTP_NOT_CONFIGURED`-style 502 (merchant misconfiguration, logged loudly)
- [ ] `POST /store/otp/verify`: validate, call dzverify; 200 → mint+return `otpToken`; wrong code → 422 with `attemptsRemaining` context; 409 → mapped terminal error; 404 → invalid request
- [ ] Tests via fetch-mock (dzverify) + db mocks: full matrix incl. fail-open bypass minting, KV guard trips, disabled config
- [ ] Verify: green

### Slice 6 — Order-creation gate
- [ ] `storeOrderSchema`: optional `otpToken` (string, max ~512)
- [ ] `createStoreOrder` handler: after stock check — if config enabled: require token (`OTP_VERIFICATION_REQUIRED`), verify signature/expiry (`OTP_TOKEN_INVALID`), compare normalized phones (`OTP_PHONE_MISMATCH`); bypass tokens pass with a `console.info` (order proceeds unverified — the merchant's chosen trade-off); disabled → zero behavior change
- [ ] OpenAPI response/request schemas updated
- [ ] Tests: disabled (no change), enabled+valid token, no token, expired, tampered, phone mismatch, bypass accepted, token from a DIFFERENT store's key rejected
- [ ] Verify: green + full suite

### Slice 7 — theme01 storefront (engine-additive + theme UI)
- [ ] `src/core/api/client.ts`: `sendOtp` / `verifyOtp` functions (additive)
- [ ] `src/core/actions/index.ts`: optional `otpToken` on placeOrder schema (additive; absent = today's behavior)
- [ ] Proxied browser endpoints (pattern: `src/pages/api/…` thin server routes using core's store headers): `POST /api/otp/send`, `POST /api/otp/verify`
- [ ] `src/theme/components/order/OtpStep.astro`: clean OTP screen — WhatsApp icon, "code sent to {phone}", single 6-digit input (`inputmode=numeric`, large, letter-spaced), auto-verify at 6 digits, expiry countdown, resend (cooldown), "change phone" back-link; theme tokens ONLY (`card`, `form-input`, `btn-primary`, `--clr-*`); errors inline (wrong code + attempts left, expired, rate-limit wait)
- [ ] `product.ts`: intercept submit when `otpEnabled` → run OTP step; verified → set hidden `otpToken` → native submit (PRG preserved); unavailable → submit with bypass token; phone edited after verification → invalidate token, re-verify
- [ ] Content packs: `otp_*` strings in `src/theme/content/types.ts` + ar/en/fr packs (TS build fails otherwise)
- [ ] No-JS reality documented: form submits directly → server rejects `OTP_VERIFICATION_REQUIRED` shown in the existing serverError alert (acceptable; feature is opt-in)
- [ ] Theme validators: `npm test`, `npx astro check`, `npm run validate` — all green; manual RTL + LTR pass described in PR notes

### Slice 8 — Dashboard settings page (cod-client-astro)
- [ ] `features/settings/model.ts`: `verification` category (ShieldCheck icon, labelKey)
- [ ] `features/settings/api.ts` + `types.ts`: `getOtpConfig` / `saveOtpConfig` / `testOtpConnection`
- [ ] `VerificationSettings.tsx` (TrackingSettings template): key field + eye toggle, language select (ar/en/fr), enabled switch, Save; Test connection button → quota badge (balance DA · ~N OTPs · plan); disabled-state hint copy
- [ ] i18n: `store.otp_*` keys in `locales/{ar,en,fr}/settings.json`
- [ ] Tests (seam-mock pattern) + typecheck green

### Slice 9 — End-to-end verification + docs
- [ ] Full suites: cod-server, cod-client-astro, theme01 validators
- [ ] Isolation proof: `git diff` shows no behavior changes in untouched domains; storefront order flow identical when no config row exists (test pins this)
- [ ] README claims audit — only code-verified statements (likely no README change needed; feature is settings-level)
- [ ] Manual test script (local wrangler dev): seed config row → checkout shows OTP step; quota-exhaustion simulation → order proceeds unverified; disable → old flow
- [ ] Update this plan to final state; production rollout checklist (migration remote, deploy server + dashboard + theme01, merchant onboarding steps)

## Rules of engagement

1. Never assume — read every file a slice touches before editing it.
2. One slice = one coherent commit-sized unit (no commits unless asked).
3. Green to move on: typecheck + tests in every touched package.
4. New server endpoints use the route-builder skill (`defineRoute()`, SCOPES constants).
5. No secrets in code/tests; the dzverify key lives only in D1 via the dashboard.
6. No hardcoded UI strings — i18n packs ×3 (dashboard) and content packs ×3 (theme01), RTL verified.
7. Fail-open only where this plan says so (quota / provider down at send); the verify flow itself is strict.
8. theme01 core changes are additive-only; presentation stays in theme/.
9. Findings and divergences get recorded in this file, not in code comments.

## Status

| Slice | Status |
|---|---|
| 0 Baseline & reads | DONE ✅ 2026-09-01 |
| 1 dzverify client + phone | DONE ✅ 2026-09-01 |
| 2 Schema + queries + config flag | DONE ✅ 2026-09-01 |
| 3 Merchant API + RBAC | DONE ✅ 2026-09-01 |
| 4 Token module | DONE ✅ 2026-09-01 |
| 5 Store send/verify endpoints | DONE ✅ 2026-09-01 |
| 6 Order gate | DONE ✅ 2026-09-01 |
| 7 theme01 storefront | DONE ✅ 2026-09-01 |
| 8 Dashboard settings | DONE ✅ 2026-09-01 |
| 9 E2E verification + docs | DONE ✅ 2026-09-01 |

**Slice 7–9 findings (2026-09-01)**:
- Theme01 core stays additive: 2 client functions, 2 proxy endpoints
  (`/api/otp/send`, `/api/otp/verify`), optional `otpToken` on the action
  schema. The OTP driver lives in `src/theme/scripts/otp-step.ts` (submit
  intercept with `capture: true`, auto-verify at 6 digits, resend countdown,
  phone-edit invalidation, fail-open bypass submission).
- The dashboard i18n guard test enforces translations for EVERY RBAC scope
  action — adding `settings:verification` required a `team.json`
  `scope_actions.verification` entry in all three locales (good guard).
- Isolation proof: store routes test needed one mock addition
  (otp-config → undefined = feature inert) — the "disabled = zero change"
  contract is now pinned by an existing-suite test, not just new ones.

## Verification summary (2026-09-01)

| Package | Gate | Result |
|---|---|---|
| cod-server | typecheck + tests | ✅ 84 files / 1386 tests |
| cod-client-astro | typecheck + tests | ✅ 33 files / 139 tests |
| cod-astro/theme01 | astro check + tests + validate (build) | ✅ 0 errors, 6 tests, build OK |

Migration `0012_store_otp_config.sql` applied locally. No secrets committed;
the dzverify key enters only via the dashboard → D1.

## Production rollout checklist (human steps)

1. `cd cod-server && npx wrangler d1 migrations apply codflow-os-db --remote`
2. Deploy cod-server (`npx wrangler deploy --env production`)
3. Build + deploy theme01 (`npm run build` + `wrangler deploy`) and
   cod-client-astro (`npm run build` + `npx wrangler deploy`)
4. Merchant onboarding: Dashboard → Settings → Verification → paste dzverify
   key → "Check key" (balance/plan shown) → toggle Require verification →
   Save. Remove the row (or disable) to return to the old checkout instantly.
5. When real keys exist: manual smoke — place a test storefront order through
   the OTP step; simulate quota exhaustion (top up to < 5 DA) and confirm the
   order still places unverified.

**Slice findings (2026-09-01)**:
- cod-shared had no test infrastructure; cod-server's vitest include now also
  covers `../cod-shared/**/*.test.ts` (additive — the layer's tests run
  through cod-server's setup).
- `/store/config` handler passes the `getStoreConfig` row through directly,
  so `otpEnabled` flows to theme01 with no handler change — only the schema
  needed the field.
- Abandoned-orders convert path confirmed: marks sessions converted, never
  creates orders — `createStoreOrder` is the single gate point.
- The dzverify quota scope (`usage:read`) is NOT in a key's default scopes —
  the test-connection endpoint therefore treats 403 as "key valid, quota
  unavailable" instead of a failure.
