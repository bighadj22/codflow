import { runCheck, kvStore, sendTelegramMessage } from "./notifier.mjs";

async function handle(env) {
  if (!env.COD_API_KEY || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error(
      "[notifier] missing configuration: set COD_API_KEY, TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets",
    );
    return { ok: false, error: "missing_configuration" };
  }
  try {
    const result = await runCheck(env, {
      store: kvStore(env.ORDER_NOTIFY_KV),
      sendMessage: (e, text) => sendTelegramMessage(e, text),
    });
    console.log(
      `[notifier] run done seeded=${result.seeded} notified=${result.notified} scanned=${result.scanned}`,
    );
    return { ok: true, ...result };
  } catch (err) {
    console.error(`[notifier] run failed: ${err && err.message ? err.message : "unknown error"}`);
    return { ok: false, error: "run_failed" };
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(handle(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.json({ ok: true, service: "cod-order-notifier" });
    }
    return new Response("Not found", { status: 404 });
  },
};
