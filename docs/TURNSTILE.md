# Cloudflare Turnstile (Checkout Bot Protection)

End-user documentation for the optional Cloudflare Turnstile bot-protection
feature at checkout.

---

## What It Does

When enabled, the checkout order form on your storefront is protected by
**Cloudflare Turnstile** — an invisible challenge that separates real
customers from bots. A bot cannot place orders through your form anymore,
which means fewer fake orders, less wasted courier money on ghost deliveries,
and cleaner customer data.

**It is optional and off by default.** Until you configure it, nothing on your
storefront changes and no extra requests are made.

What it is **not**:

- Not applied to orders your team creates from the dashboard (you trust your
  own input).
- Not a replacement for phone verification (WhatsApp OTP) — the two features
  are independent and compose: a store can enable both, either, or neither.
- Not a hard blocker when Cloudflare's verification service is unreachable —
  see [Fail-open](#fail-open-orders-are-never-blocked) below.

---

## Before You Start

1. **Create a Turnstile widget** in the [Cloudflare dashboard](https://dash.cloudflare.com)
   (Turnstile → *Add widget*). Choose:
   - **Managed mode** (recommended) — Cloudflare automatically decides between
     an invisible check and a checkbox, based on the visitor's risk.
   - **Hostnames** — add your storefront's domain(s) to the widget's allowed
     hostnames. Every domain your store may appear on (including your custom
     store domain) must be listed, or the widget silently fails there.
2. The widget gives you two keys:
   - **Site key** — public; lives in the storefront page HTML by design.
   - **Secret key** — private; used only by the CodFlow server to verify
     tokens. It is never shown to customers and never sent to the browser.

---

## Turning It On

Dashboard → **Settings → Verification** (the Cloudflare Turnstile card,
below the WhatsApp phone verification card):

1. **Site key** — paste your widget's public site key.
2. **Secret key** — paste your widget's secret key. After saving, only the
   last 4 characters are ever displayed (e.g. `••••a9f2`) — the full key is
   never shown again and never leaves the server.
3. **Protect the order form** — the on/off switch.
4. **Save**.

The feature is live immediately. The checkout form on your storefront now
carries the Turnstile widget.

**Leaving either key field empty on Save keeps the stored key** — the
dashboard never re-sends the secret after the first save. You only type a key
again when replacing it with a new one.

### Permissions

Only dashboard users with the **Settings → Verification** permission
(`settings:verification` scope) can see and change these settings. Admins can
always manage them.

---

## What Your Customer Sees

1. Customer fills the order form (name, phone, wilaya, quantity…) and taps
   **Place order**.
2. In the **normal case** the challenge completes invisibly — the customer
   notices nothing and the order is placed exactly as before.
3. **Occasionally** (higher-risk visitor, bot-like behaviour) Cloudflare shows
   a small checkbox. The customer ticks it and taps **Place order** again.
4. If the challenge expired while the customer was filling the form
   (tokens expire after **5 minutes**) the widget resets itself silently, so
   the next submit uses a fresh token.
5. If the widget itself errors, the customer sees *"Security verification
   failed — please retry your order"* and the form can be resubmitted.

**Turnstile tokens are single-use**: a token that has already been validated
(or expired) cannot be reused — the server rejects it and the customer simply
submits again with a fresh token.

---

## Fail-Open: Orders Are Never Blocked

Bot protection improves order quality — it must never cost you sales. One
rule follows:

- **If Cloudflare's siteverify service is unreachable** (network error,
  timeout, or Cloudflare outage), the checkout **skips the challenge and
  places the order anyway**. This is not a bug; it is the designed behavior.
  You still receive the order.
- **A missing, invalid, expired, or reused token is never skipped.** The
  server rejects it with a friendly *"please retry"* message — that is the
  feature working.

There is no additional cost: Turnstile is free and there are no per-check
charges or quotas.

---

## Turning It Off

Switch **Protect the order form** off and Save — the storefront returns to the
old checkout instantly, from the very next order. Nothing else changes; your
Cloudflare widget and keys stay untouched.

To fully remove the configuration, clear the `store_turnstile_config` row
from the database — but simply disabling is enough and is instantly reversible
by re-enabling.

---

## Testing

While you develop or test your storefront locally, you can use Cloudflare's
testing keys — they work on any domain including `localhost`:

| Site key | Behavior |
|---|---|
| `1x00000000000000000000AA` | Always passes (visible widget) |
| `2x00000000000000000000AB` | Always fails (visible widget) |
| `3x00000000000000000000FF` | Forces an interactive challenge |

| Secret key | Behavior |
|---|---|
| `1x0000000000000000000000000000000AA` | Always passes validation |
| `2x0000000000000000000000000000000AA` | Always fails validation |
| `3x0000000000000000000000000000000AA` | Returns "token already spent" |

Pair the always-pass site key with the always-pass secret key to test the
happy path, and the always-fail pair to test the error path. Production
secrets reject these dummy tokens, so never ship testing keys to production.