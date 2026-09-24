# Legal Pages (Terms, Privacy, Refund, Shipping)

End-user documentation for the store's Terms & Conditions, Privacy Policy,
Refund & Return Policy, and Shipping Policy pages, plus any custom page you
add.

---

## What It Does

Meta reviews a store's ads and checks that the storefront has clear policy
pages before it will run them. A store with none of these pages gets its ads
rejected — a common, avoidable reason Algerian COD stores get blocked from
advertising.

Every CodFlow store is seeded with four pages, already written for a
**cash-on-delivery store selling in Algeria**:

- **Terms & Conditions**
- **Privacy Policy**
- **Refund & Return Policy**
- **Shipping Policy**

They are live on your storefront (`yourstore.com/pages/<slug>`), linked from
the footer, and linked from a consent line on the checkout form —
automatically, the moment your store exists. You do not have to write these
from scratch, and you are not blocked from advertising while you get around
to it.

**They are a starting point, not legal advice.** They are written to reflect
how COD selling actually works in Algeria — no online payment, confirmation
by phone call, inspection at the door, home delivery or carrier stop-desk —
grounded in Algeria's e-commerce (18-05), consumer protection (09-03), and
data protection (18-07) laws. Review them for your business and consult a
lawyer for your specific situation; the dashboard says this on the Pages
screen too.

---

## Editing a Page

Dashboard → **Pages**:

1. Pick a page from the list on the left. Each one shows whether it still has
   its original wording (⚠ **Needs review**) or you've edited it (✓
   **Reviewed**).
2. Edit its **title** and **content** with the same rich-text editor you
   already use for product descriptions — bold, headings, lists, links.
3. Optional **SEO** fields (meta title, meta description) if you want
   something different from the page title and content.
4. **Save**.

Saving a page marks it reviewed. That badge is for you — it never affects
whether the page is visible to shoppers.

### Editing in Another Language

If your store's language (Settings → General → Store Language) is Arabic,
your Arabic tab is the one shoppers actually read. The English and French
tabs are there too — already filled in — but they only matter if you switch
your store's language later. You do not have to translate anything yourself
unless you want to.

### Undoing a Change

**Reset to CodFlow template** on any of the four legal pages discards
whatever is currently saved for that language and puts the original wording
back. This cannot be undone, so it asks you to confirm first. Custom pages
you created yourself have no template to reset to.

---

## Business Details

Dashboard → **Pages → Business details** — the facts your legal pages are
written from:

| Field | Used for |
|---|---|
| Legal / business name | Who the store legally is, in Terms & Privacy |
| Commercial register (RC) | Displayed in Terms & Privacy |
| Tax ID (NIF) | Displayed in Privacy |
| Address | Displayed where a physical address is expected |
| Contact email / phone | Shown in every page's "Contact us" section, and in your storefront footer |
| Return window (days) | The Refund policy's return-after-delivery clause. **0 = no returns accepted after delivery** — only refusal at the door, which is always free regardless of this setting |
| Fastest / slowest delivery (days) | The delivery-time range quoted in Shipping (and Terms) |

**Any field you leave blank is simply left out of the page** — a page never
shows a placeholder like `[YOUR EMAIL]`. A store that fills in nothing still
gets four complete, publishable pages; filling in your details makes them
more specific to your business.

**Saving here does not rewrite pages you have already reviewed.** It only
changes what a future **Reset to CodFlow template** would produce. If you
update your return window after already customizing your Refund page, that
page keeps your wording until you explicitly reset it.

---

## Custom Pages

**+ New page** creates a page you write entirely yourself — an FAQ, an About
page, anything. It starts as a draft; publish it from its settings (**Show in
storefront footer**, **Published**) when it's ready. Unlike the four legal
pages, a custom page can be deleted.

---

## Where Pages Appear

- **Storefront**: `yourstore.com/pages/<slug>` — the slug is yours to change
  (**Page link** field); nothing breaks internally when you rename it, but a
  URL you've already given to Meta or shared elsewhere stops working, so the
  editor warns you before you save a change.
- **Footer**: every published page with **Show in storefront footer** on,
  titled in your store's language, in the order you set.
- **Checkout**: a one-line consent ("By placing this order, you agree to our
  Terms and Refund Policy") linking to your Terms and Refund pages, shown
  automatically once both exist and are published. It disappears if either
  is unpublished — never a broken link.

---

## Permissions

Only dashboard users with the **Pages** permission (`store_pages:manage` to
edit, `store_pages:read` to view) can see and change these pages. Admins can
always manage them.

---

## A Store That Predates This Feature

If your store existed before Legal Pages shipped, it doesn't have these four
pages yet. Dashboard → **Pages** shows an empty state with **Add Terms,
Privacy, Refund & Shipping** — one click, and it's safe to click even if some
pages already exist (it only creates what's missing).
