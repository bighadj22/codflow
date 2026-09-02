# WhatsApp Phone Verification (OTP)

End-user documentation for the optional WhatsApp phone-verification feature at
checkout, powered by the **dzverify** service.

---

## What It Does

When enabled, a customer placing an order on your storefront receives a 6-digit
code on **WhatsApp** and must type it in before the order is placed. This
confirms the phone number is real and reachable — which means fewer fake
orders, fewer wrong numbers, and less wasted courier money on COD deliveries
nobody answers.

**It is optional and off by default.** Until you configure it, nothing on
your storefront changes, no API calls are made, and it costs nothing.

What it is **not**:

- Not a login or 2FA mechanism for the dashboard.
- Not applied to orders your team creates from the dashboard (you trust your
  own input).
- Not a hard blocker when the verification service is down — see
  [Fail-open](#fail-open-orders-are-never-blocked) below.

---

## Before You Start

1. **Create a dzverify account** at [app.dzverify.com](https://app.dzverify.com)
   and finish their WhatsApp onboarding.
2. **Create an API key** at `app.dzverify.com/api-keys`. The full key is shown
   **only once**, at creation — copy it somewhere safe.
   - New keys include the scopes needed to send and verify codes.
   - The *Check key* balance preview needs the `usage:read` scope. Without it
     the key still works for verification — you just won't see the balance
     (see [Troubleshooting](#troubleshooting)).

**Pricing (dzverify):**

| Item | Cost |
|---|---|
| Each code sent | 5 DA — only for successful sends; if WhatsApp rejects the delivery, the 5 DA is refunded |
| Free trial credit | 50 DA (= 10 codes) |

---

## Turning It On

Dashboard → **Settings → Verification**:

1. **Paste your dzverify API key** into the key field. After saving, only the
   last 4 characters are ever displayed (e.g. `••••a9f2`) — the full key is
   never shown again and never leaves the server.
2. **Check key** (optional but recommended) — calls dzverify and shows:
   `Key is valid — Balance: 50 DA · sends left: ~10 · trial`.
3. **WhatsApp message language** — Arabic (default), French, or English. This
   is the language the 6-digit code message is sent in.
4. **Require phone verification** — the on/off switch.
5. **Save**.

The feature is live immediately. The checkout form on your storefront now
includes the verification step.

**Leaving the key field empty on Save keeps the stored key** — the dashboard
never re-sends the full key after the first save. You only type a key again
when replacing it with a new one.

### Permissions

Only dashboard users with the **Settings → Verification** permission
(`settings:verification` scope) can see and change these settings. Admins can
always manage them.

---

## What Your Customer Sees

1. Customer fills the order form (name, phone, wilaya, quantity…) and taps
   **Place order**.
2. A verification card appears: *"We sent a 6-digit code to your WhatsApp"*.
   The customer types the code — it verifies automatically once all 6 digits
   are entered.
3. Wrong code → *"Wrong code — check WhatsApp and try again"* plus how many
   attempts are left. The code allows **5 attempts** and stays valid for
   **5 minutes**.
4. Expired / out of attempts → *"This code has expired — request a new one"* —
   the customer taps **Resend code** (available after a 60-second cooldown).
5. Changed their mind about the number? **Change phone** returns to the form.
   Editing the phone after verifying also quietly cancels the verification —
   the new number must be verified before ordering.
6. On success, the order is placed exactly as before.

**Phone formats accepted** (all treated as the same number):
`0551234567`, `5 51-234 567`, `+213551234567`, `213551234567`. Foreign
numbers in `+CC…` form pass through. Anything else → the customer is asked to
enter a valid Algerian mobile number.

---

## Fail-Open: Orders Are Never Blocked

Phone verification improves order quality — it must never cost you sales.
Two rules follow from that:

1. **If dzverify cannot send the code** — your balance ran out, or their
   service is temporarily down — the checkout **skips verification and places
   the order anyway**, unverified. This is not a bug; it is the designed
   behavior. You still receive the order (worth checking that phone number
   before shipping it, and topping up your dzverify balance).
2. **A wrong or expired code is never skipped.** The customer must enter the
   correct code or request a new one. That is the feature working.

The verification proof the storefront attaches to the order is
**valid for 15 minutes** after the code is confirmed.

### Anti-abuse limits (protect your balance)

| Limit | Value | What the customer sees |
|---|---|---|
| Resend cooldown (per phone) | 60 seconds | Countdown on the resend button |
| Sends per IP address | ~20 / hour | "Too many requests — please wait…" |
| Sends per phone number (dzverify) | 5 / hour | Same |
| Sends per dzverify account (dzverify) | 200 / hour | Same |

Only *successful* sends are billed.

---

## Turning It Off

Switch **Require phone verification** off and Save — the storefront returns to
the old checkout instantly, from the very next order. Nothing else changes;
your dzverify account and key stay untouched.

To fully remove the configuration (e.g. you stop using dzverify), clear the
row from the database — but simply disabling is enough and is instantly
reversible by re-enabling.

---

## Troubleshooting

| Symptom | Meaning / fix |
|---|---|
| *Check key* shows balance, plan, and "sends left" | Everything works. |
| *Check key* → "Key is valid but lacks the usage:read scope" | The key **works** for verification. Only the balance preview needs a key with `usage:read` — create one in the dzverify dashboard if you want the preview. |
| *Check key* → "The API key was rejected" | Wrong or revoked key — paste a fresh one. |
| *Check key* → "Balance exhausted — top up at app.dzverify.com" | Key is fine; add credit. Until then, orders place **unverified** (fail-open). |
| Orders arrive without verification | Either verification is disabled, or fail-open kicked in (balance empty / dzverify down). Top up and re-test the key. |
| Customer sees "This code has expired" | Normal after 5 minutes — resend. |
| Customer with JavaScript disabled | The form submits directly and the server rejects it with a clear "phone verification is required" message shown in the form's error alert. |
| Saving fails with "a dzverify API key is required" | You enabled verification with no key stored — paste one first. |

---

## Platform Notes (for whoever deploys CodFlow)

- **One-time setup:** apply migration `0012_store_otp_config.sql` to the
  remote D1 before the feature can be configured in production
  (`npx wrangler d1 migrations apply codflow-os-db --remote` in `cod-server`).
- The dzverify key is stored per-store in D1 (`store_otp_config`), never in
  wrangler secrets, and never sent to the browser — it is merchant integration
  config, the same as carrier tokens and the Meta pixel token.
- No row in `store_otp_config` = feature completely inert (safe default for
  fresh installs).
- Storefront endpoints (auth = store API key):
  `POST /store/otp/send` `{ phone }` → `{status: "sent", requestId, expiresAt,
  maxAttempts}` or `{status: "unavailable", reason, bypassToken}` (fail-open);
  `POST /store/otp/verify` `{ phone, requestId, code }` → `{otpToken}`.
- Merchant endpoints (auth = `settings:verification` scope):
  `GET/POST /api/stores/otp-config`, `POST /api/stores/otp-config/test`.
- The storefront flag is `otpEnabled` on `GET /store/config`; order submission
  carries the proof as an optional `otpToken` field.
- Detailed design decisions and test coverage:
  `.agents/skills/whatsapp-otp/PLAN.md`.
