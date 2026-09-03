# Transactional Email (Sendili)

End-user documentation for the optional email-sending feature, powered by the
**[Sendili](https://sendili.com)** service.

---

## What It Does

When enabled, CodFlow sends **transactional emails** on your behalf:

1. **Team-invite emails** — when an admin invites a team member, the member
   receives an email with their sign-in link and temporary password, in the
   language chosen at invitation (Arabic or English).
2. **Password-reset emails** — anyone on the sign-in page can click
   *Forgot password?* and receive a reset link (valid for **1 hour**,
   single-use).

**It is optional and off by default.** Until you configure it, no emails are
sent, no API calls are made, and both features keep working exactly as
before — the admin just hands the temporary password to the new member
manually, and password reset shows the standard "check your email" screen
without an email arriving.

What it is **not**:

- Not customer-facing order notifications or admin alerts (planned — the
  same integration will carry them when they ship).
- Not a mailing-list or marketing tool — Sendili sends every CodFlow email
  on its `transactional` lane.
- Not a replacement for the admin's one-time display of the API key — the
  API key is **never emailed**.

---

## Before You Start

1. **Create a Sendili account** at [sendili.com](https://sendili.com) and buy
   credits (one credit = one recipient; credits never expire, no monthly fee).
2. **Verify your sending domain** in the Sendili dashboard (add the DNS
   records they show you and wait for confirmation). Every CodFlow email is
   sent **from an address on a domain you verified** — this is required, not
   cosmetic: Sendili refuses sends from unverified domains.
3. **Create an API key** (looks like `sk_live_…`). Copy it somewhere safe.

---

## Turning It On

Dashboard → **Settings → Email Sending**:

1. **Paste your Sendili API key** into the key field and click anywhere
   outside it — the key is checked against Sendili immediately and your
   **verified domains load automatically**.
2. **From address** — type the local part (e.g. `support`, `notify`,
   `noreply`) and pick your verified domain from the dropdown next to it
   (e.g. `support@yourdomain.com`).
3. **From name** (optional) — what recipients see next to the address
   (defaults to nothing; your store name is a good choice).
4. **Enable email sending** — the on/off switch.
5. **Save**.

The feature is live immediately: the next team invite sends an email, and
*Forgot password?* delivers real reset links.

After saving, only the last 4 characters of the key are ever displayed
(e.g. `••••a9f2`) — the full key is never shown again and never leaves the
server. **Leaving the key field empty on Save keeps the stored key** — you
only type a key again when replacing it.

**Test connection** re-checks the key against Sendili at any time and lists
your verified domains again.

### Permissions

Only dashboard users with the **Settings → Email Sending** permission
(`settings:email` scope) can see and change these settings. Admins can always
manage them.

---

## What Your Team Member Sees (Invite)

A clean email from your store: greeting by name, a **sign-in button**
pointing at your dashboard, the **temporary password**, and a note to change
it after signing in. Rendered in Arabic (RTL) or English per the language
picked in the invite dialog.

The dialog also shows whether the email was sent: a green
*"Invitation email sent successfully"* banner, or an amber
*"email could not be sent — share the temporary password manually"* banner
with the password still displayed. **The member's account is always
created**, email or no email.

## What Anyone Sees (Password Reset)

1. On the sign-in page: **Forgot password?** → enter the account email →
   *"If an account exists… check your email"* — the same response whether or
   not the account exists (no account discovery).
2. The email contains a **Reset password** button (link valid **1 hour**,
   single-use).
3. The link opens the reset form: new password (min 8 characters) +
   confirmation → done, redirected to sign-in with the new password.

Anti-abuse: reset requests are limited to **3 per hour** per source.

---

## Fail-Soft: Business Actions Are Never Blocked

Email improves the experience — it must never break the operation behind it:

- **A failed invite email never fails user creation.** The account is
  created; the response carries `emailSent`/`emailError` and the dialog
  tells the admin to hand over the password manually.
- **A failed reset email reveals nothing.** The request always answers the
  same generic message; the failure is only visible because no email
  arrives.
- Retried requests cannot double-send: every email carries an idempotency
  key (`invite-<userId>`, `reset-<userId>-<token prefix>`) — Sendili replays
  the original result instead of sending a second copy.

Failure reasons (shown as stable codes, never raw provider text):
`out_of_credits` · `invalid_key` · `forbidden` (domain not verified /
sending disabled) · `rate_limited` · `validation` · `transient`.

---

## Turning It Off

Switch **Enable email sending** off and Save — invites and password resets
stop emailing instantly and behave exactly like an unconfigured store (the
admin again hands over the temporary password manually). Your Sendili
account, key, and credits are untouched; re-enabling is instant.

---

## Troubleshooting

| Symptom | Meaning / fix |
|---|---|
| *Test connection* → "Connection OK" + domains listed | Everything works. |
| Domains don't load after pasting the key | The key was rejected — check it, or use **Test connection** to see the reason. |
| *Test connection* → "The API key was rejected" | Wrong or revoked key — paste a fresh one from the Sendili dashboard. |
| *Test connection* → "insufficient credits" | Key is fine; buy credits at sendili.com/billing. Until then emails fail with `out_of_credits` (invites still create the account). |
| Send refused with `forbidden` | The from-address domain is not verified in your Sendili workspace — verify it or pick a verified domain. |
| Invite banner says email failed but user exists | Working as designed — share the temporary password manually and check the failure code. |
| Reset email never arrives | Check the failure reasons above; also confirm the account exists (unknown accounts get no email by design). |
| Reset link says invalid | Links expire after 1 hour and are single-use — request a new one. |
| Saving fails with "a Sendili API key is required" | You enabled sending with no key stored — paste one first. |

---

## Platform Notes (for whoever deploys CodFlow)

- **One-time setup:** apply migration `0013_store_email_config.sql` to the
  remote D1 before the feature can be configured in production
  (`npx wrangler d1 migrations apply codflow-os-db --remote` in `cod-server`).
- The Sendili key is stored per-store in D1 (`store_email_config`), never in
  wrangler secrets, and never sent to the browser — it is merchant
  integration config, the same as carrier tokens and the dzverify key.
  Storage decision (plaintext + masked reads, encryption rejected):
  [`docs/adr/0001-sendili-key-at-rest.md`](./adr/0001-sendili-key-at-rest.md).
- No row in `store_email_config` = feature completely inert (safe default
  for fresh installs).
- **One shared send path** (`cod-shared/lib/transactional-email.ts`) serves
  both senders: cod-server (invites, behind `POST /api/users`) and the
  dashboard worker (password resets, via better-auth's
  `emailAndPassword.sendResetPassword`). It never throws, maps every
  failure to the stable codes above, and drops provider message text (it can
  echo key fragments).
- Templates (`cod-shared/lib/email-templates.ts`): Arabic (RTL) and English,
  inline CSS only, every caller-supplied string HTML-escaped.
- Merchant endpoints (auth = `settings:email` scope):
  `GET/POST /api/stores/otp-config`'s siblings —
  `GET/POST /api/stores/email-config`, `POST /api/stores/email-config/test`.
  The test endpoint calls Sendili's account API and returns the verified
  domains (for the from-address picker).
- The `[[send_email]]` binding in cod-server's wrangler config is **unrelated**
  to this feature — it exists only because the `agents` npm package imports
  `cloudflare:email`; Sendili is plain HTTPS.
