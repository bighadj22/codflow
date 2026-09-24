/**
 * Sticky "Order Now" CTA (theme layer).
 *
 * The fixed bottom button is visible on mobile while the order form is out of
 * view and hides the moment any part of the form enters the viewport (or has
 * already been scrolled past) — the CTA and the form's own submit button
 * must never compete for the tap. The anchor href does the scrolling
 * (html has scroll-behavior: smooth), so no-JS visitors still get a working
 * jump-to-form link.
 */

export function initStickyCta(): (() => void) | void {
  const cta = document.getElementById("product-sticky-cta") ?? document.getElementById("lp-sticky-cta");
  const form = document.getElementById("order-section") ?? document.getElementById("order-section-wrapper");
  if (!cta || !form) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      // Hide if the form is in the viewport OR has been scrolled past
      const isAtOrPastForm = entry.isIntersecting || entry.boundingClientRect.top < 0;
      cta.classList.toggle("is-hidden", isAtOrPastForm);
    },
    { threshold: 0 }
  );
  observer.observe(form);

  return () => observer.disconnect();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initStickyCta());
  } else {
    initStickyCta();
  }
}
