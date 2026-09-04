/**
 * Abandoned Order Tracking
 *
 * Sends shopper contact details to the same-origin proxy
 * POST /api/abandoned (which forwards to cod-server with the server-side
 * store key) when the visitor has typed a valid name + phone and pauses for
 * 3 seconds without submitting. All updates use the same sessionId (UPSERT
 * on the server), so there is exactly one DB record per browser tab.
 *
 * On page exit (tab close, navigation), a final capture is attempted via
 * navigator.sendBeacon so abandoners who never submit are still recorded.
 *
 * Conversion is handled by the inline script on the product page
 * (POST /api/abandoned/convert) — see pages/products/[slug].astro.
 *
 * Non-critical by contract: every failure is swallowed. Tracking can never
 * affect the order flow, page speed, or console cleanliness.
 */

const UPSERT_URL = "/api/abandoned";

initAbandonmentTracking();

function initAbandonmentTracking() {
  // One session per tab — survives navigation within the tab, not cross-tab
  let sessionId = sessionStorage.getItem("cod_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("cod_session_id", sessionId);
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasSentInitial = false;

  function isValidName(v: string) {
    return v.trim().length >= 2;
  }

  function isValidPhone(v: string) {
    // Algerian mobile, matching the order form + server schema: 05/06/07
    // followed by 8 digits, in local or international form.
    let digits = v.replace(/\D/g, "");
    if (digits.startsWith("00213")) digits = digits.slice(5);
    else if (digits.startsWith("213")) digits = digits.slice(3);
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    return /^[567]\d{8}$/.test(local);
  }

  function getWilayaName(wilayaId: number | undefined): string | undefined {
    if (!wilayaId) return undefined;
    const el = document.querySelector<HTMLSelectElement>("#f-wilaya");
    if (!el) return undefined;
    const opt = el.querySelector<HTMLOptionElement>(`option[value="${wilayaId}"]`);
    return opt?.textContent?.trim() || undefined;
  }

  function getCommuneName(communeId: string | undefined): string | undefined {
    if (!communeId) return undefined;
    const el = document.querySelector<HTMLSelectElement>("#f-commune");
    if (!el) return undefined;
    const opt = el.querySelector<HTMLOptionElement>(`option[value="${communeId}"]`);
    return opt?.textContent?.trim() || undefined;
  }

  function collectFormData() {
    const name = (document.querySelector<HTMLInputElement>("#f-name")?.value ?? "").trim();
    const phone = (document.querySelector<HTMLInputElement>("#f-phone")?.value ?? "").trim();
    const wilayaRaw = document.querySelector<HTMLSelectElement>("#f-wilaya")?.value;
    const wilayaId = wilayaRaw ? parseInt(wilayaRaw) || undefined : undefined;
    const communeId = document.querySelector<HTMLSelectElement>("#f-commune")?.value || undefined;
    const price = Number(document.querySelector<HTMLInputElement>("[name=pricePerUnit]")?.value) || undefined;

    return {
      sessionId: sessionId!,
      customerName: name,
      phone,
      wilayaId,
      communeId,
      wilayaName: getWilayaName(wilayaId),
      communeName: getCommuneName(communeId),
      productId: document.querySelector<HTMLInputElement>("[name=productId]")?.value || undefined,
      productName: document.querySelector<HTMLInputElement>("[name=productName]")?.value || undefined,
      variantId: document.querySelector<HTMLInputElement>("#variant-id-input")?.value || undefined,
      variantLabel: document.querySelector<HTMLInputElement>("#variant-label-input")?.value || undefined,
      price,
      deliveryType:
        (document.querySelector<HTMLInputElement>("[name=deliveryType]:checked")?.value as
          | "home"
          | "stop_desk"
          | undefined) || undefined,
      fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1] ?? undefined,
      fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1] ?? undefined,
    };
  }

  function isCapturable(data: ReturnType<typeof collectFormData>) {
    return isValidName(data.customerName) && isValidPhone(data.phone);
  }

  async function sendAbandonment() {
    const data = collectFormData();
    if (!isCapturable(data)) return;

    try {
      await fetch(UPSERT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        keepalive: true,
      });
      hasSentInitial = true;
    } catch {
      // Non-critical — tracking failure must never affect the order flow
    }
  }

  /**
   * Final capture attempt as the page unloads. sendBeacon is fire-and-forget
   * and survives navigation/tab close where fetch would be killed.
   */
  function sendBeaconOnExit() {
    const data = collectFormData();
    if (!isCapturable(data)) return;
    try {
      navigator.sendBeacon(
        UPSERT_URL,
        new Blob([JSON.stringify(data)], { type: "application/json" })
      );
    } catch {
      // Non-critical
    }
  }

  function scheduleSend() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sendAbandonment, 3000);
  }

  // Watch name + phone (debounced — fires after 3 s of no typing)
  document.querySelector("#f-name")?.addEventListener("input", scheduleSend);
  document.querySelector("#f-phone")?.addEventListener("input", scheduleSend);

  // Watch wilaya / commune / delivery type — immediate update once initial record exists
  ["#f-wilaya", "#f-commune"].forEach((sel) => {
    document.querySelector(sel)?.addEventListener("change", () => {
      if (hasSentInitial) void sendAbandonment();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[name=deliveryType]").forEach((el) => {
    el.addEventListener("change", () => {
      if (hasSentInitial) void sendAbandonment();
    });
  });

  // Capture shoppers who close the tab or navigate away mid-checkout
  window.addEventListener("pagehide", sendBeaconOnExit);
}
