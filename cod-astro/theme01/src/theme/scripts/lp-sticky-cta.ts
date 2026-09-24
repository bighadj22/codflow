/**
 * Landing-page sticky "Order Now" CTA (theme layer).
 * Preserved for backwards compatibility with landing page templates.
 */

import { initStickyCta } from "./sticky-cta";

export { initStickyCta, initStickyCta as initLpStickyCta };

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initStickyCta());
  } else {
    initStickyCta();
  }
}
