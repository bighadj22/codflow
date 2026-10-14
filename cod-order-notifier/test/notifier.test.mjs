import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  orderTotal,
  formatOrderMessage,
  selectNewOrders,
  capSeenIds,
  runCheck,
  MAX_SEEN_IDS,
} from "../src/notifier.mjs";

const order = (over = {}) => ({
  id: "id-1",
  orderNumber: "ORD-20260101-0001",
  status: "new",
  price: 3000,
  deliveryFee: 500,
  codAmount: 3500,
  customerName: "Ahmed <script>",
  wilaya: "الجزائر",
  commune: "بئر مراد رايس",
  createdAt: "2026-01-01T12:00:00.000Z",
  ...over,
});

function memoryStore(initial = { seeded: false, ids: [] }) {
  let state = { seeded: initial.seeded, ids: [...initial.ids] };
  return {
    async load() {
      return { seeded: state.seeded, ids: [...state.ids] };
    },
    async save(next) {
      state = { seeded: true, ids: [...next.ids] };
    },
    get state() {
      return state;
    },
  };
}

function fetchReturning(orders) {
  return async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: orders, count: orders.length }) });
}

test("escapeHtml neutralises angle brackets and ampersands", () => {
  assert.equal(escapeHtml("a <b> & c"), "a &lt;b&gt; &amp; c");
});

test("orderTotal prefers codAmount and falls back to price + fee", () => {
  assert.equal(orderTotal(order({ codAmount: 4200 })), 4200);
  assert.equal(orderTotal(order({ codAmount: null, price: 1000, deliveryFee: 250 })), 1250);
});

test("formatOrderMessage includes number, total, status and creation time", () => {
  const msg = formatOrderMessage(order());
  assert.match(msg, /ORD-20260101-0001/);
  assert.match(msg, /3\u202F500 DZD|3 500 DZD/);
  assert.match(msg, /Nouvelle/);
  assert.match(msg, /13:00/);
  assert.ok(!msg.includes("<script>"));
  assert.ok(msg.includes("&lt;script&gt;"));
});

test("selectNewOrders keeps only unseen ids", () => {
  const fresh = selectNewOrders([order({ id: "a" }), order({ id: "b" })], new Set(["a"]));
  assert.deepEqual(fresh.map((o) => o.id), ["b"]);
});

test("capSeenIds keeps the most recent ids", () => {
  const ids = Array.from({ length: MAX_SEEN_IDS + 5 }, (_, i) => `id-${i}`);
  const capped = capSeenIds(ids);
  assert.equal(capped.length, MAX_SEEN_IDS);
  assert.equal(capped.at(-1), `id-${MAX_SEEN_IDS + 4}`);
  assert.equal(capped[0], "id-5");
});

test("first run seeds silently without sending or notifying", async () => {
  const store = memoryStore();
  const sent = [];
  const result = await runCheck(
    { COD_SERVER_URL: "https://api.example.com", COD_API_KEY: "k" },
    {
      fetchImpl: fetchReturning([order({ id: "a" }), order({ id: "b" })]),
      store,
      sendMessage: async (_e, text) => sent.push(text),
    },
  );
  assert.deepEqual(result, { seeded: true, seededCount: 2, notified: 0, scanned: 2 });
  assert.equal(sent.length, 0);
  assert.deepEqual([...store.state.ids].sort(), ["a", "b"]);
});

test("subsequent run notifies only the new order and persists it", async () => {
  const store = memoryStore({ seeded: true, ids: ["a"] });
  const sent = [];
  const result = await runCheck(
    { COD_SERVER_URL: "https://api.example.com", COD_API_KEY: "k" },
    {
      fetchImpl: fetchReturning([
        order({ id: "b", orderNumber: "ORD-B" }),
        order({ id: "a", orderNumber: "ORD-A" }),
      ]),
      store,
      sendMessage: async (_e, text) => sent.push(text),
    },
  );
  assert.equal(result.notified, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /ORD-B/);
  assert.deepEqual([...store.state.ids].sort(), ["a", "b"]);
});

test("no duplicate notification when the same order is polled again", async () => {
  const store = memoryStore({ seeded: true, ids: ["a", "b"] });
  const sent = [];
  const result = await runCheck(
    { COD_SERVER_URL: "https://api.example.com", COD_API_KEY: "k" },
    {
      fetchImpl: fetchReturning([order({ id: "a" }), order({ id: "b" })]),
      store,
      sendMessage: async (_e, text) => sent.push(text),
    },
  );
  assert.equal(result.notified, 0);
  assert.equal(sent.length, 0);
});

test("runCheck fails loudly when the orders API rejects the key", async () => {
  const store = memoryStore();
  await assert.rejects(
    runCheck(
      { COD_SERVER_URL: "https://api.example.com", COD_API_KEY: "bad" },
      {
        fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
        store,
        sendMessage: async () => {},
      },
    ),
    /Orders API returned HTTP 401/,
  );
});
