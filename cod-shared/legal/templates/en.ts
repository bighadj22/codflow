/**
 * English legal templates.
 *
 * Clause-for-clause parity with `ar.ts` and `fr.ts` — same sections, same
 * guards, same facts. `legal/render.test.ts` enforces that parity so the three
 * locales can never drift into being three different policies.
 */

import { doc, p, section, ul } from "../types";
import type { LegalTemplatePack, StoreLegalFacts } from "../types";

const seller = (f: StoreLegalFacts) => f.legalName ?? f.storeName;

const contactBlocks = (f: StoreLegalFacts) => [
  f.contactPhone ? p("Phone:", f.contactPhone) : null,
  f.contactEmail ? p("Email:", f.contactEmail) : null,
  f.address ? p("Address:", f.address) : null,
];

const noContact = (f: StoreLegalFacts) =>
  !f.contactPhone && !f.contactEmail
    ? p("You can reach us through the contact details shown on the store.")
    : null;

export const en: LegalTemplatePack = {
  terms: (f) =>
    doc(
      "Terms and Conditions",
      `Terms and conditions for buying from ${f.storeName}: placing an order, cash on delivery, shipping, and cancellation.`,
      section(
        "Who we are",
        p(
          `${f.storeName} is an online store selling in Algeria with cash on delivery. By using this site and placing an order, you agree to the terms below.`,
        ),
        f.legalName ? p("Registered name:", f.legalName) : null,
        f.rcNumber ? p("Commercial register (RC):", f.rcNumber) : null,
        f.nif ? p("Tax identification number (NIF):", f.nif) : null,
        ...contactBlocks(f),
      ),
      section(
        "Products and prices",
        p(
          "All prices shown are in Algerian dinar. The product price does not include the delivery fee, which is calculated from your wilaya and delivery method and shown to you before you submit the order.",
        ),
        p(
          "We do our best to show accurate photos and descriptions. Slight differences in colour or appearance may appear depending on your screen.",
        ),
        p(
          "We may change a price or withdraw a product at any time. The price that applies is the one confirmed with you during the confirmation call.",
        ),
      ),
      section(
        "Placing and confirming an order",
        p(
          "After you submit the form, your order reaches us as “awaiting confirmation”. An order placed on the site is an offer to buy and becomes a firm sale only once confirmed.",
        ),
        p(
          "Our team calls you to confirm the product, quantity, address and delivery fee before the order is dispatched.",
        ),
        p(
          "If we cannot reach you after several attempts, or the product turns out to be unavailable, we may cancel the order and let you know.",
        ),
      ),
      section(
        "Payment",
        p(
          "Cash on delivery is the only accepted payment method. We never ask for an advance payment or for any bank details on the site.",
        ),
        p(
          "You pay the full amount — product price plus delivery fee — in cash to the courier when you receive the parcel.",
        ),
        p(
          "If anyone asks you for an advance payment in our name, do not respond and tell us immediately.",
        ),
      ),
      section(
        "Delivery",
        p(
          "We deliver to the wilayas offered in the order form. Two methods are usually available: delivery to your address, or pickup at the carrier's office (stop desk).",
        ),
        p(
          `Delivery usually takes ${f.deliveryMinDays} to ${f.deliveryMaxDays} working days from confirmation. The details are set out in the shipping and delivery policy.`,
        ),
      ),
      section(
        "Cancellation",
        p(
          "You can cancel your order free of charge at any time before it is handed to the carrier, by contacting us.",
        ),
        p(
          "At delivery you may inspect the parcel before paying and may refuse it. In that case you pay nothing. Returns after receipt are covered in the return and refund policy.",
        ),
      ),
      section(
        "Your responsibilities",
        ul(
          "Give an accurate and complete name, phone number and address.",
          "Stay reachable on the number you gave, for the confirmation call and for the courier.",
          "Do not place fake or repeated orders you do not intend to receive.",
        ),
        p(
          "Wrong or incomplete details are the single biggest cause of failed delivery, and we are not responsible for delays caused by them.",
        ),
      ),
      section(
        "Limitation of liability",
        p(
          "We are responsible for the product matching what was shown and confirmed to you. We are not responsible for delays or failures caused by circumstances beyond our control, such as weather, road closures or carrier disruption.",
        ),
      ),
      section(
        "Personal data",
        p(
          "Your personal data is processed as described in the privacy policy, in line with Law 18-07 on the protection of natural persons in the processing of personal data.",
        ),
      ),
      section(
        "Governing law",
        p(
          "These terms are governed by Algerian law, in particular Law 18-05 on electronic commerce and Law 09-03 on consumer protection and the suppression of fraud. Any dispute is settled amicably first, failing which before the competent Algerian courts.",
        ),
      ),
      section(
        "Changes to these terms",
        p("We may update these terms. The version shown on this page is the one in force."),
      ),
      section("Contact us", ...contactBlocks(f), noContact(f)),
    ),

  privacy: (f) =>
    doc(
      "Privacy Policy",
      `How ${f.storeName} collects, uses and protects your personal data, and what your rights are.`,
      section(
        "Who is responsible",
        p(
          `${seller(f)} is responsible for processing the personal data you provide when ordering from ${f.storeName}. This policy explains what we collect, why, and how we protect it.`,
        ),
        f.rcNumber ? p("Commercial register (RC):", f.rcNumber) : null,
      ),
      section(
        "What we collect",
        ul(
          "First and last name.",
          "Phone number.",
          "Wilaya and commune, plus the street address for home delivery.",
          "Your order details and order history with us.",
          "Technical data about your visit (pages viewed, device type).",
        ),
        p("We collect no bank details, because payment is in cash on delivery."),
      ),
      section(
        "Why we use it",
        ul(
          "To prepare and deliver your order.",
          "To call you to confirm the order or update you on its status.",
          "To handle returns, exchanges and after-sales support.",
          "To improve the store and measure how our ads perform.",
          "To meet our legal and accounting obligations.",
        ),
      ),
      section(
        "Who sees your data",
        p("We do not sell or rent your data. We share it only as far as necessary with:"),
        ul(
          "The carrier handling your parcel — it receives your name, phone number and address so it can deliver.",
          "The SMS or WhatsApp provider, when phone verification is enabled.",
          "Advertising measurement platforms, when enabled, through identifiers that do not include your address.",
          "The competent authorities, where the law requires it.",
        ),
      ),
      section(
        "Cookies and measurement",
        p(
          "The site uses cookies necessary for it to work (such as remembering your cart) and may use measurement tools to understand how our pages and ads perform. You can delete or block cookies from your browser settings, bearing in mind that some site features may be affected.",
        ),
      ),
      section(
        "How long we keep it",
        p(
          "We keep order data for as long as needed to fulfil the order and provide after-sales support, then for the period our legal and accounting obligations require. After that it is deleted or anonymised.",
        ),
      ),
      section(
        "Your rights",
        p(
          "Under Law 18-07 you have the right to access your data, to correct it and to ask for its deletion, and to object to its use for marketing.",
        ),
        p("To exercise any of these rights, contact us using the details below. We respond as quickly as we can."),
      ),
      section(
        "Security",
        p(
          "We take reasonable technical and organisational measures to protect your data against loss and unauthorised access. No system, however, can guarantee absolute security.",
        ),
      ),
      section(
        "Children",
        p("Our store is intended for adults. We do not knowingly collect data about minors."),
      ),
      section(
        "Changes to this policy",
        p("We may update this policy. The version shown on this page is the one in force."),
      ),
      section("Contact us", ...contactBlocks(f), noContact(f)),
    ),

  refund: (f) =>
    doc(
      "Return and Refund Policy",
      `Return and refund terms at ${f.storeName}: inspect before you pay, refusing at delivery, and damaged or wrong items.`,
      section(
        "Check before you pay",
        p(
          "We are paid on delivery, and that protects you directly: you may open the parcel and inspect the product in front of the courier before paying anything.",
        ),
        p(
          "If the product does not match what you ordered, or arrives damaged, do not pay — refuse the parcel and tell us the same day so we can sort it out.",
        ),
      ),
      section(
        "Refusing at delivery",
        p(
          "Refusing a parcel at delivery costs you nothing: neither the product price nor the delivery fee. The parcel comes back to us through the carrier.",
        ),
        p(
          "Please refuse a parcel only for a genuine reason. Repeated refusals without reason may lead us to stop accepting orders from the same number.",
        ),
      ),
      f.returnWindowDays > 0
        ? section(
            "Returns after delivery",
            p(
              `You may request a return within ${f.returnWindowDays} days of receiving the product, provided it is:`,
            ),
            ul(
              "in its original condition and unused;",
              "in its original packaging with all accessories;",
              "accompanied by proof of purchase (order number or delivery note).",
            ),
            p("Contact us before returning anything. Do not ship a product back without agreeing it with us first."),
          )
        : section(
            "Returns after delivery",
            p(
              "Because inspection happens before payment, we do not accept returns once the parcel has been accepted and paid for, except for the damaged or wrong item cases below.",
            ),
          ),
      section(
        "Damaged or wrong item",
        p(
          "If you find after delivery that the product is damaged or different from what you ordered, contact us within 48 hours with clear photos of the product and its packaging.",
        ),
        p(
          "Once verified, we replace the product or refund what you paid. In that case we cover the return cost.",
        ),
      ),
      section(
        "Items that cannot be returned",
        ul(
          "Hygiene and personal care products once opened.",
          "Underwear and products that cannot be resold for hygiene reasons.",
          "Products made or customised to your order.",
          "Products damaged by misuse after delivery.",
        ),
      ),
      section(
        "How refunds are paid",
        p(
          "Because payment is in cash, refunds are made by whichever method we agree with you: cash when we collect the product from you, or a transfer to your CCP or bank account.",
        ),
        p("Processing usually takes a few days from when we receive the product and check its condition."),
      ),
      section(
        "Return shipping costs",
        p(
          "We cover return costs when the fault is ours — a damaged or wrong item. In other cases return shipping is the buyer's responsibility.",
        ),
      ),
      section("Contact us", ...contactBlocks(f), noContact(f)),
    ),

  shipping: (f) =>
    doc(
      "Shipping and Delivery Policy",
      `Delivery times, fees and methods at ${f.storeName}: home delivery or carrier office pickup, by wilaya.`,
      section(
        "Where we deliver",
        p(
          "We deliver to the wilayas listed in the order form. If your wilaya is not in the list, delivery there is not available at the moment.",
        ),
      ),
      section(
        "Delivery methods",
        p("Two methods are usually available, chosen when you place the order:"),
        ul(
          "Home delivery: the courier hands you the parcel at the address you gave.",
          "Office pickup (stop desk): you collect your parcel from the nearest carrier office, usually at a lower fee.",
        ),
      ),
      section(
        "Delivery times",
        p(
          `Delivery usually takes ${f.deliveryMinDays} to ${f.deliveryMaxDays} working days from the phone confirmation of your order — not from the moment you submit it on the site.`,
        ),
        p(
          "It can take longer in distant wilayas, during holidays and peak periods, and for causes beyond our control such as weather or road closures.",
        ),
      ),
      section(
        "Delivery fees",
        p(
          "Fees vary by wilaya and by the method you choose. They are shown in the order form before you submit, and our team confirms them again on the phone.",
        ),
        p("They are paid in cash to the courier together with the product price, on receipt."),
      ),
      section(
        "Order confirmation",
        p(
          "No order is dispatched before it is confirmed with you by phone. If we cannot reach you after several attempts, the order stays pending and may be cancelled.",
        ),
      ),
      section(
        "Tracking your parcel",
        p("Once your parcel is with the carrier, you can find out its status by contacting us with your order number."),
      ),
      section(
        "Delivery attempts",
        p(
          "The courier calls you on arrival in your wilaya. If they cannot reach you, the parcel is returned to us and the order may be cancelled. Please keep your number reachable.",
        ),
      ),
      section(
        "Inspection at delivery",
        p(
          "You may inspect the parcel before paying. If the product is not as expected you may refuse delivery and pay nothing — see the return and refund policy.",
        ),
      ),
      section("Contact us", ...contactBlocks(f), noContact(f)),
    ),
};
