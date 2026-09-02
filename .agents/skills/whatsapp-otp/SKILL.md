---
name: whatsapp-otp
description: CodFlow's WhatsApp OTP phone-verification feature (dzverify provider) — optional, off by default, per-store. Use when working on OTP send/verify endpoints, the order-creation verification gate, the store_otp_config settings, theme01's checkout OTP step, or the dashboard Verification settings page.
---

# WhatsApp OTP Verification (dzverify)

Storefront phone verification at checkout. **Optional, off by default** —
activated per merchant from Dashboard → Settings → Verification by pasting a
dzverify API key. No config row = feature completely inert.

| File | What it holds |
|---|---|
| `PLAN.md` | The slice-by-slice implementation plan + all verified dzverify API facts, architecture decisions (fail-open contract, token design, RBAC scope), and status. **Start here.** |

Key invariants (full detail in PLAN.md):

- The dzverify API key is merchant config in D1 (`store_otp_config`), never a
  wrangler secret, never sent to the browser.
- Orders are NEVER blocked by quota exhaustion or provider outage — the
  server mints an HMAC **bypass token** and checkout proceeds unverified.
  Wrong/expired codes get no bypass (that is the flow working).
- Verification proof is a stateless HMAC token bound to the normalized
  E.164 phone, 15-min TTL, signed with a key derived from the store's dzverify
  API key.
- Storefront endpoints are `auth: "store"` (`/store/otp/send`,
  `/store/otp/verify`); merchant config endpoints use the
  `SETTINGS_VERIFICATION` RBAC scope.
- theme01: engine additions in `src/core/` are additive-only; the OTP step UI
  lives in `src/theme/`, strings in all three content packs, RTL verified.
