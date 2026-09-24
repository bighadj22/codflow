# Shopping Cart

End-user documentation for the optional shopping cart: letting a customer order
several products in one delivery.

---

## What It Does

By default a CodFlow storefront sells **one product per order**. A customer
lands on a product page from your ad, fills the form, and you deliver that one
item. That flow is fast and it converts, and nothing below replaces it.

When you switch the cart on, your storefront gains:

- An **"Add to cart"** button on each product page, directly under your order
  button.
- A **cart icon** in the header, with a count of what the customer has picked.
- A **cart panel** that slides open, listing what they chose with quantity
  controls and a live total.
- A **checkout page** where they confirm the whole basket — their name, phone,
  wilaya, commune and delivery choice, exactly like the normal form, but for
  several products at once.

**It is off by default.** Until you turn it on, your storefront ships no cart
at all: same product page, same one-step order form, same speed.

What it is **not**:

- Not a replacement for the one-click order form. A customer who wants one
  product still orders it in one step and never sees the cart.
- Not a change to how you get paid. It is still cash on delivery, one delivery,
  one payment.
- Not a change to your existing orders. Orders taken before you switch it on
  are untouched.

---

## Before You Start

You need nothing. No new account, no keys, no integration. The cart is part of
CodFlow and is switched on from your dashboard.

Two things are worth deciding **before** you turn it on, because they affect
what customers are charged:

1. Whether you want to offer **free delivery above a certain basket value**.
2. How delivery should be charged when a basket **mixes products that ship
   differently**.

Both are explained under [Delivery settings](#delivery-settings).

---

## Turning It On

**Dashboard → Settings → Shopping cart → Enable the shopping cart.**

Save, and your storefront has a cart within seconds. There is no rebuild and no
waiting.

Turn it off the same way. See [Turning it off](#turning-it-off-safely) for what
happens to orders already placed.

---

## What Your Customer Sees

### On a product page

Nothing moves. Your order form stays exactly where it is, with the same
"Confirm order" button. **"Add to cart" appears directly underneath it**, styled
as the second choice, because for most customers the one-step order is still the
right path.

A customer who taps it gets the cart panel sliding open with their item in it.

### In the cart panel

Each line shows the photo, the product name, the variant they chose, the price,
and plus/minus buttons. The product name and photo link back to the product
page — that is how a customer adds *the same shirt in another colour*: they tap
back, pick the colour, and add it.

Prices and stock in the panel are **checked against your real catalogue**, not
remembered from when the customer added the item. If you changed a price or ran
out of a size while their cart sat open, the panel corrects itself and says so,
and the "Order now" button is blocked until they fix it. A customer can never
reach checkout with a basket you cannot fulfil.

### On the checkout page

The whole basket at the top, still editable, then the delivery details. The
delivery fee appears **as soon as they pick their wilaya**, and the total
updates live as they switch between home delivery and stop desk.

If you use WhatsApp verification or bot protection, both work here exactly as
they do on the product form.

---

## Delivery Settings

**Dashboard → Settings → Shopping cart.**

### Free delivery above an amount

Set a basket value above which **you** pay the delivery. Leave it empty and this
feature does not exist for your store.

When it is set, the cart and the checkout page show a **progress bar at the very
top**: "2.500 DA to free delivery", filling as the customer adds more, then
turning green with "You've earned free delivery" when they cross it.

This is the single strongest tool in the cart for raising basket size, and it is
the reason to have a cart at all. A customer 2.000 DA short of free delivery
very often adds a second item rather than pay 600 DA to ship one.

Pick the number deliberately: somewhere above your current average order, but
close enough to feel reachable. Too high and nobody chases it; too low and you
pay delivery on baskets you would have shipped anyway.

### Baskets that mix shipping profiles

This only applies if you set **different delivery prices for different
products**. If everything in your shop ships the same way, ignore it.

When a basket mixes products with different delivery pricing, you choose what
the customer is charged:

| Option | What happens | When to pick it |
|---|---|---|
| **Charge the highest rate in the basket** *(default)* | The customer pays the rate of the item that costs you most to ship | Your margin is never cut by a cheap item riding along with an expensive one. This is the safe default |
| **Always charge the default profile** | Per-product delivery pricing is ignored for baskets | Simplest promise to make, if your products mostly ship alike |

A single-product order is never affected by this setting.

---

## Abandoned Baskets

You already get a list of customers who typed their phone number and left
without ordering — **Dashboard → Abandoned orders**. That is one of the most
valuable lists in CodFlow, because those people are reachable.

With the cart on, that list now shows **the whole basket**, not just one
product. Every line, with its quantity and its line total, right in the list —
so you can pick up the phone and say exactly what they had without opening
anything.

The value column shows the **basket total**, so your "lost revenue" figure is
honest for multi-item baskets too.

Records captured before the cart existed still show exactly as they did.

---

## Facebook / Meta Tracking

If you have a Meta Pixel configured, the cart reports two more events
automatically:

- **AddToCart** — each time a customer puts something in the basket.
- **InitiateCheckout** — when they start filling in the checkout page.

Both carry the products and the basket value, which is what Meta's optimiser
learns from. You do not need to change anything: if you have a pixel, this is
already happening; if you do not, nothing is sent.

Your existing Purchase / Lead conversion event is unchanged.

---

## Related Products

At the **bottom of every product page**, under the description and reviews,
your storefront now shows a few other products from the same category.

This is automatic and needs no setup. It exists to catch the customer who
decided "not this one" — on a storefront reached from an ad, that customer
otherwise has nowhere to go but back to Facebook.

A few things worth knowing:

- Suggestions come from the **same category** as the product being viewed. If
  that category is thin, it falls back to the rest of your catalogue.
- A store with fewer than three products shows nothing — a "You may also like"
  heading over a single card looks like a mistake.
- It loads **after** the product itself, so it never slows down the page your ad
  is paying for.

The best thing you can do to improve these suggestions is **file your products
into sensible categories**.

---

## Turning It Off Safely

**Dashboard → Settings → Shopping cart → Enable the shopping cart** (uncheck),
then save.

The storefront goes back to exactly what it was: product page, one-step order
form, no cart icon, no checkout page.

**Orders already placed are completely unaffected.** A multi-product order taken
while the cart was on stays a normal CodFlow order:

- every line stays on it, with its quantity and price,
- the total is exactly what the customer agreed to,
- stock stays deducted — switching a feature off is not a cancellation, and the
  parcels are still going out,
- it prints, dispatches and returns like any other order.

You can turn it back on at any time with no further step.

---

## Common Questions

**Will this slow down my product page?**
No. The cart adds a small amount of code that loads after the page is already on
screen, and the related-products section is fetched separately after the product
is visible.

**What if a customer's basket sits open for a week?**
The basket lives in their own browser, so it survives. But nothing in it is
trusted: every price and every stock level is re-checked against your catalogue
when they open the cart and again when they order. They are always charged your
current price.

**Can a customer change a colour or size from inside the cart?**
Not from inside the panel — they tap the product name to go back to the product
page and choose there. That is deliberate: the product page already knows which
combinations exist and which are out of stock, and duplicating that inside the
cart is where mistakes happen.

**How many products can go in one basket?**
Up to 20 different items, up to 100 of any one item. These caps protect your
shop from abusive orders and are far above any genuine basket.

**Does the customer pay delivery once or per product?**
Once. One basket is one delivery and one delivery fee, charged as described
under [Delivery settings](#delivery-settings).

**What happens if a product sells out while it is in someone's basket?**
The cart marks that line and blocks checkout until they remove it or reduce the
quantity. They cannot place an order you would have to cancel.

**Do I need to change anything about how I dispatch?**
No. A multi-product order reaches your carrier with a combined description and
deducts stock line by line, like any other order.
