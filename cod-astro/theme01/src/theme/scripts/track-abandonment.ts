/**
 * Abandoned Order Tracking
 *
 * Fires a POST /store/abandoned when the visitor has typed a valid name + phone
 * and stays on the page for 3 seconds without submitting. All updates use the
 * same sessionId (UPSERT on server), so there's exactly one DB record per tab.
 *
 * Conversion is marked by calling window.__markAbandonedConverted after a
 * successful order placement.
 */

const COD_SERVER_URL = (import.meta.env.PUBLIC_COD_SERVER_URL as string | undefined) ?? "";
const STORE_API_KEY = (import.meta.env.PUBLIC_STORE_API_KEY as string | undefined) ?? "";

// Skip entirely if env vars are missing (dev without server, etc.)
if (!COD_SERVER_URL || !STORE_API_KEY) {
  console.debug("[abandonment] env vars missing — tracking disabled");
} else {
  initAbandonmentTracking();
}

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
    return /^[0-9+\s-]+$/.test(v) && v.replace(/\D/g, "").length >= 9;
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

  async function sendAbandonment() {
    const data = collectFormData();
    if (!isValidName(data.customerName) || !isValidPhone(data.phone)) return;

    try {
      await fetch(`${COD_SERVER_URL}/store/abandoned`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Store-API-Key": STORE_API_KEY,
        },
        body: JSON.stringify(data),
        keepalive: true,
      });
      hasSentInitial = true;
    } catch {
      // Non-critical — tracking failure must never affect the order flow
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
      if (hasSentInitial) sendAbandonment();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[name=deliveryType]").forEach((el) => {
    el.addEventListener("change", () => {
      if (hasSentInitial) sendAbandonment();
    });
  });

  // Exposed globally so the order-submit success handler can call it
  (window as any).__markAbandonedConverted = async (
    orderId: string,
    orderNumber: string
  ): Promise<void> => {
    try {
      await fetch(`${COD_SERVER_URL}/store/abandoned/${sessionId}/convert`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Store-API-Key": STORE_API_KEY,
        },
        body: JSON.stringify({ orderId, orderNumber }),
        keepalive: true,
      });
    } catch {
      // Non-critical
    }
    sessionStorage.removeItem("cod_session_id");
  };
}
