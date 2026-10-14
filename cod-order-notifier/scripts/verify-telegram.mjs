import { loadLocalEnv } from "./env.mjs";

const env = loadLocalEnv();
if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .dev.vars");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`, {
  method: "GET",
});
const data = await res.json();
if (!data?.ok) {
  console.error(`getUpdates failed with HTTP ${res.status}`);
  process.exit(1);
}

const updates = Array.isArray(data.result) ? data.result : [];
const messages = updates
  .filter((u) => u.message && u.message.text)
  .map((u) => ({
    at: new Date(u.message.date * 1000).toISOString(),
    from: (u.message.from && u.message.from.first_name) || "?",
    text: String(u.message.text).slice(0, 500),
  }));

console.log(JSON.stringify({ sinceFirstUnread: updates.length, sample: messages.slice(0, 6) }, null, 2));