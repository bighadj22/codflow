# Meta Pixel & Conversions API

End-user documentation for Meta ad tracking in CodFlow: the **Meta Pixel**
(browser side) and the **Conversions API** (server side), and how they work
together.

---

## What It Does

CodFlow reports what happens in your store to Meta, so Meta can attribute
orders to your Facebook/Instagram ads and optimize them:

- **Browser events (Meta Pixel)** — what the shopper's browser does: viewing
  a product (`ViewContent`), reaching the order form (`InitiateCheckout`),
  placing an order (`Lead`), and every page view (`PageView`).
- **Server events (Conversions API)** — what your store *knows* server-side,
  sent directly from CodFlow to Meta with hashed customer data (phone, name,
  city) for stronger matching. Server events survive browser restrictions
  such as ad blockers and iOS privacy limits.

**It is optional and off by default.** Until you configure it in Settings,
nothing is sent to Meta and no pixel script loads on your storefront.

**You choose what counts as a conversion** — this is the most important
setting in the feature (see *Lead or Purchase?* below).

What it is **not**:

- Not a Meta ad manager — you still create ads in Ads Manager; this only
  feeds them data.
- Not analytics or a dashboard — you read results in **Meta Events Manager**.
- Not able to "unsay" an event — once Meta receives an event, it cannot be
  retracted (relevant to the Lead choice below).

---

## Before You Start

Collect these from Meta:

1. **Pixel ID** — Meta Events Manager → Data Sources → your pixel
   (e.g. `1234567890123456`). If you have no pixel yet, create one first
   (Events Manager → Create Data Source).
2. **Conversions API access token** — in Events Manager, open your pixel →
   Settings → Conversions API → *Generate access token*. Copy it somewhere
   safe: **it is shown once and never displayed again by CodFlow**.
3. **(Optional) Test event code** — from the Test Events tab of your pixel
   (e.g. `TEST12345`), for verifying your setup safely.

Your domain should also be **verified** in Meta Business Manager
(Business Settings → Brand Safety → Domains) — Meta uses it to trust the
events your store sends.

---

## Turning It On

Dashboard → **Settings → Tracking & Analytics**:

1. **Enable Meta tracking** — the master on/off switch. Off = no pixel on
   your storefront and no server events, period.
2. **Ad Account Name** *(optional)* — your own label for the ad account this
   pixel belongs to (e.g. "My Store — Main Account"). Purely for your
   reference in the settings page; CodFlow never sends it to Meta.
3. **Meta Pixel ID** — from step 1 above.
4. **Conversions API Access Token** — from step 2 above. Paste it once and
   save: afterwards the field shows only a masked hint (`••••a9f2`). Leaving
   the field empty on later saves **keeps the stored token**.
5. **Conversion Event — Lead or Purchase?** — required, you must pick one:

   | | **Lead — at order placement** | **Purchase — at confirmed delivery** |
   |---|---|---|
   | Fires | the moment an order is placed | when the order is marked *Delivered* |
   | Speed | immediate — fast ad optimization signal | days later (delivery time) |
   | Accuracy | counts **unconfirmed** orders: refusals, fake phones, cancellations | counts **real revenue**: cash actually collected |
   | Meta dedup | deduplicated with the browser pixel Lead | server-only, no duplication |
   | 7-day limit | n/a (fires immediately) | if delivery happens more than 7 days after the order, the event is skipped (Meta's hard limit) |

   For COD in Algeria, many merchants start with **Lead** to build ad data
   fast, then switch to **Purchase** once volume is stable. You can change
   this at any time — only future events follow the new choice.

6. **Test Mode** — see below. Recommended for first-time setup.
7. **Save.**

---

## Test Mode (turn it on, verify, then turn it off)

Test Mode sends your **server events to Meta's test stream** instead of your
production measurement — nothing counts, nothing pollutes your ad data.

To verify the setup:

1. Turn **Test Mode on** and enter your **Test Event Code** (from Events
   Manager → your pixel → *Test Events* tab).
2. Save, then open your storefront in a browser and place a test order.
3. In the Meta **Test Events** tab you should see, within ~20 minutes:
   - browser events (`PageView`, `ViewContent`, `InitiateCheckout`, `Lead`)
   - server events (`Lead` or `Purchase` from "CodFlow" / your server)
   - the server `Lead` and browser `Lead` arriving with the **same event ID**
     → Meta reports them as *deduplicated* (one conversion, not two).
4. **Turn Test Mode off** and save before going live. While it is on, a
   warning banner stays visible on the settings page — your events are not
   being counted.

> **Important:** after disabling Test Mode, remove the test event code from
> Events Manager behavior by simply leaving Test Mode off — the code is only
> attached while the switch is on.

---

## How It Works

### The two channels

```
Shopper's browser                     CodFlow server (Cloudflare)
─────────────────                     ──────────────────────────
Pixel script loaded
  └─ PageView          (every page)
  └─ ViewContent       (product page)
  └─ InitiateCheckout  (first interaction in the order form)   Order placed ──┐
  └─ Lead + eventID    (thank-you page)  ──┐                                 │
                                          │                                 ▼
                                    same eventID ──→ CAPI Workflow: server Lead (if you chose Lead)
                                          │        Meta counts ONE (dedup, 48h window)
                                                                            │
                                        Order delivered ───────────────────┤
                                                                            ▼
                                                           CAPI Workflow: server Purchase (if you chose Purchase)
```

- **Deduplication:** when you choose **Lead**, the browser and the server
  both send a `Lead` for the same order with the **same event ID** (the
  internal order ID). Meta matches them within 48 hours and counts **one**
  conversion. This is Meta's recommended "redundant setup": you get the
  browser event's speed and the server event's reliability.
- **Purchase is server-only:** it fires when an order is marked **Delivered**
  (or *Out for delivery* for the far southern wilayas, to stay inside Meta's
  7-day window). If Meta is temporarily down, it retries automatically up to
  5 times with backoff — a Meta hiccup can never block or delay your delivery
  flow.
- **Attribution preserved:** the `_fbc` (ad click) and `_fbp` (browser)
  cookies are captured **at order placement** and stored with the order, so
  the delivery-day Purchase event still attributes back to the ad the
  customer clicked days earlier.

### When exactly does CAPI fire? (the trigger chain)

Both server events run as **durable Cloudflare Workflows** — queued, retried
on failure (5 attempts with backoff), and audit-logged. Nothing here depends
on a browser still being open.

**Lead** — fires the moment an order is placed:

```
Storefront checkout → order accepted (201)
                      └─ Workflow "capi-{orderId}-Lead" starts
                          ├─ you chose Lead?  → send to Meta (dedup'd with the browser Lead)
                          └─ you chose Purchase? → skip silently, no event
```

**Purchase** — fires when an order *reaches delivery*. There are two ways an
order gets there, and both trigger the same Workflow:

```
1. You / your team updates the order in the dashboard
   Dashboard → Orders → mark Delivered ──┐
                                          ├──→ Workflow "capi-{orderId}-Purchase"
2. The carrier's webhook updates it automatically          │
   Yalidine / ZR Express webhook → status "Livré"/"Delivered" ┘
                                          │
                                          ├─ you chose Purchase? → send to Meta
                                          └─ you chose Lead?     → skip silently
```

**What this means with webhooks:** if you dispatch orders to **Yalidine** or
**ZR Express**, their systems call CodFlow's webhook whenever the shipment
moves — picked up, out for delivery, delivered, returned. When the webhook
reports *delivered*, CodFlow marks the order Delivered **and** starts the
Purchase Workflow in the same instant: no one has to touch the dashboard.

The other carriers (**NOEST, EcoTrack**) don't send webhooks to CodFlow —
their status is pulled when you open the order in the dashboard — so for
them the Purchase event starts when you (or a teammate) view or update the
order and the status resolves to Delivered.

Timing rule (both events): Meta rejects events older than **7 days** from
order placement. That's why far-southern wilayas (Adrar, Tamanrasset,
Tindouf, …) fire Purchase at *Out for delivery* instead of *Delivered* —
waiting for final delivery there can push past the 7-day limit.

### Privacy: what is sent

CodFlow sends Meta only what its Conversions API accepts, per Meta's spec:

- **Hashed (SHA-256, on our servers before sending):** phone number,
  first/last name, city, postal code, country, internal customer ID.
- **Sent as-is (Meta requires these unhashed):** ad-click and browser
  identifiers, and the shopper's IP address and browser User-Agent —
  captured at order placement for accurate attribution.
- **Never sent:** addresses, notes, product names, prices beyond the order
  total, your ad account label.

### Audit trail

Every server event attempt is recorded in the `capi_event_log` table —
event, order, outcome (sent / failed / skipped), Meta's trace ID, and any
error. If something silently fails, the answer is there.

> **Phone numbers:** checkout only accepts **Algerian mobile numbers**
> (starting 05, 06, or 07). Shoppers can type them in any common form —
> `0551234567`, `+213 551 23 45 67`, `00213…` — CodFlow normalizes them to
> one canonical format before storing. Cleaner phone data also means a
> higher match rate for your Meta events.

---

## Verifying Events in Meta

1. **Live events:** Events Manager → your pixel → *Overview*. Expect
   `PageView`, `ViewContent`, `InitiateCheckout`, and your chosen
   conversion event. Events appear within ~20 minutes.
2. **Event Match Quality (EMQ):** the pixel's *Diagnostics* tab scores how
   well your server events match Meta users (0–10). Higher = better
   attribution. Because CodFlow sends phone + name + city + IP + user-agent
   + click IDs, expect a healthy score.
3. **Test events:** the Test Events tab (with Test Mode on, as above).
4. **Browser debugging:** install Meta's **Pixel Helper** Chrome extension —
   it shows every pixel call on your storefront live.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No events at all in Events Manager | tracking disabled, or pixel ID / token wrong | check the switches in Settings → Tracking; re-paste values |
| Browser events appear, server events don't | access token invalid or revoked | generate a fresh token in Events Manager, save it in Settings |
| Server events appear only in Test Events tab | Test Mode still on | turn Test Mode **off** and save |
| `Lead` counted twice | you send your own pixel `Lead` outside CodFlow | don't add a second pixel script manually — CodFlow already fires the browser Lead with the matching event ID |
| `Purchase` missing for a delivered order | delivery happened >7 days after placement (Meta's hard limit), or the event is still retrying | check `capi_event_log`; the skip is by design |
| Pixel Helper shows nothing on the storefront | no Pixel ID saved, or script blocked by an ad blocker | save the Pixel ID; test in a clean browser profile |
| Order delivered via Yalidine/ZR but no Purchase in Meta | conversion event set to Lead, or tracking/test-mode off | check Settings → Tracking first, then `capi_event_log` for a skipped row |
| Customer's order rejected with an Arabic phone error | the phone isn't an Algerian mobile (05/06/07) | customers must use a DZ mobile number — fixed-line or foreign numbers are refused at checkout |

---

## FAQ

**Can I run my own pixel script alongside CodFlow's?**
No — the browser `Lead` and the server `Lead` share one event ID *because
both come from CodFlow*. A second, manually-installed pixel would
double-count conversions.

**I chose Purchase — where did my Lead events go?**
The browser pixel still fires `Lead` on the thank-you page, but the
server-side mirror is off — the Conversions API conversion signal becomes
`Purchase` at delivery instead. Meta optimizes on whichever event you
selected.

**Does my carrier need webhooks for tracking to work?**
No — webhooks only change **how quickly** the Purchase event starts. With
Yalidine or ZR Express, the carrier reports *delivered* to CodFlow
automatically and the Purchase Workflow starts by itself. With NOEST or
EcoTrack, it starts when your team updates the order in the dashboard. The
`Lead` conversion event never depends on carriers — it fires at order
placement either way.

**Does switching Lead → Purchase affect past events?**
No. The choice applies from the moment you save. Past events stay as they
were reported.

**What happens if I turn tracking off?**
The pixel script stops loading on your storefront and no server events are
sent. Existing settings and history are kept — flipping it back on resumes
immediately.

**Is the access token safe?**
It is stored in your store's database and is write-only through the
dashboard: the API returns only a masked hint (`••••a9f2`), and saving with
an empty token field keeps the stored one.
