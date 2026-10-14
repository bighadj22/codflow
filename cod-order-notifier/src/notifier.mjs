/**
 * CodFlow order notifier — pure logic, dependency-injected for testability.
 * Read-only: only GET /api/orders is ever called.
 */

export const STATE_KEY = "state:v1";
export const MAX_SEEN_IDS = 2000;

const STATUS_LABELS_FR = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  unreachable: "Injoignable",
  preparing: "En préparation",
  ready: "Prête",
  assigned: "Assignée",
  dispatched: "Expédiée",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  returned: "Retournée",
  cancelled: "Annulée",
};

const AMOUNT_FORMAT = new Intl.NumberFormat("fr-FR");
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Algiers",
  dateStyle: "short",
  timeStyle: "short",
});

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function orderTotal(order) {
  if (typeof order.codAmount === "number" && Number.isFinite(order.codAmount)) {
    return order.codAmount;
  }
  const price = Number(order.price) || 0;
  const fee = Number(order.deliveryFee) || 0;
  return price + fee;
}

export function statusLabel(status) {
  return STATUS_LABELS_FR[status] ?? status ?? "Inconnu";
}

export function formatOrderMessage(order) {
  const number = order.orderNumber ?? order.id ?? "?";
  const total = `${AMOUNT_FORMAT.format(orderTotal(order))} DZD`;
  const status = statusLabel(order.status);
  const created = order.createdAt ? DATE_FORMAT.format(new Date(order.createdAt)) : "?";
  const lines = [
    "\u{1F6D2} <b>Nouvelle commande</b>",
    `N\u00B0 : <code>${escapeHtml(number)}</code>`,
    `Montant total (COD) : <b>${escapeHtml(total)}</b>`,
    `Statut : <b>${escapeHtml(status)}</b>`,
    `Cr\u00E9\u00E9e le : ${escapeHtml(created)}`,
  ];
  const details = [];
  if (order.customerName) details.push(`\u{1F464} ${escapeHtml(order.customerName)}`);
  if (order.wilaya) details.push(`\u{1F4CD} ${escapeHtml(order.wilaya)}`);
  else if (order.wilayaId) details.push(`\u{1F4CD} wilaya ${escapeHtml(order.wilayaId)}`);
  if (order.commune) details.push(`\u{1F3D8} ${escapeHtml(order.commune)}`);
  if (details.length > 0) lines.push(details.join(" \u00B7 "));
  return lines.join("\n");
}

/**
 * Orders present in the API response that have not been recorded yet.
 * `seenIds` is an iterable of order ids already notified.
 */
export function selectNewOrders(orders, seenIds) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds ?? []);
  return (orders ?? []).filter((o) => o && o.id && !seen.has(o.id));
}

export function capSeenIds(ids) {
  const list = Array.from(ids);
  return list.length > MAX_SEEN_IDS ? list.slice(list.length - MAX_SEEN_IDS) : list;
}

/** Cloudflare KV-backed state store. */
export function kvStore(kv) {
  return {
    async load() {
      const raw = await kv.get(STATE_KEY);
      if (!raw) return { seeded: false, ids: [] };
      try {
        const parsed = JSON.parse(raw);
        return {
          seeded: Boolean(parsed.seeded),
          ids: Array.isArray(parsed.ids) ? parsed.ids : [],
        };
      } catch {
        return { seeded: false, ids: [] };
      }
    },
    async save(state) {
      await kv.put(STATE_KEY, JSON.stringify({ seeded: true, ids: capSeenIds(state.ids) }));
    },
  };
}

/** Filesystem-backed store, used by the local helper scripts only. */
export function createFileStore(readFile, writeFile, path) {
  return {
    async load() {
      try {
        const raw = readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        return {
          seeded: Boolean(parsed.seeded),
          ids: Array.isArray(parsed.ids) ? parsed.ids : [],
        };
      } catch {
        return { seeded: false, ids: [] };
      }
    },
    async save(state) {
      writeFile(path, JSON.stringify({ seeded: true, ids: capSeenIds(state.ids) }, null, 2));
    },
  };
}

export async function fetchRecentOrders(env, fetchImpl = fetch) {
  const base = String(env.COD_SERVER_URL || "").replace(/\/+$/, "");
  if (!base) throw new Error("COD_SERVER_URL is not configured");
  if (!env.COD_API_KEY) throw new Error("COD_API_KEY is not configured");

  const res = await fetchImpl(`${base}/api/orders?limit=100`, {
    method: "GET",
    headers: { "X-API-Key": env.COD_API_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Orders API returned HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.data) ? body.data : [];
}

export async function sendTelegramMessage(env, text, fetchImpl = fetch) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not configured");

  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram sendMessage failed with HTTP ${res.status}`);
  }
  return data.result;
}

/**
 * One polling pass.
 * First pass (not seeded) records existing orders without notifying.
 * Later passes notify only for unseen orders, newest-last.
 */
export async function runCheck(env, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const store = deps.store;
  const sendMessage = deps.sendMessage ?? ((e, text) => sendTelegramMessage(e, text, fetchImpl));

  if (!store) throw new Error("runCheck requires a store");

  const orders = await fetchRecentOrders(env, fetchImpl);
  const state = await store.load();
  const ids = new Set(state.ids);

  if (!state.seeded) {
    for (const order of orders) {
      if (order?.id) ids.add(order.id);
    }
    await store.save({ seeded: true, ids });
    return { seeded: true, seededCount: orders.length, notified: 0, scanned: orders.length };
  }

  const fresh = selectNewOrders(orders, ids);
  fresh.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let notified = 0;
  for (const order of fresh) {
    await sendMessage(env, formatOrderMessage(order));
    ids.add(order.id);
    await store.save({ seeded: true, ids });
    notified += 1;
  }

  return { seeded: false, notified, scanned: orders.length };
}
