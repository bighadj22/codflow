import { loadLocalEnv } from "./env.mjs";
import { sendTelegramMessage } from "../src/notifier.mjs";

const env = loadLocalEnv();

if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. Fill cod-order-notifier/.dev.vars first.");
  process.exit(1);
}

try {
  await sendTelegramMessage(
    env,
    "\u2705 <b>CodFlow</b> \u2014 message de test. Le bot est correctement configur\u00E9.",
  );
  console.log("Test message accepted by Telegram. Check your phone to confirm reception.");
} catch (err) {
  console.error(`Test failed: ${err.message}`);
  process.exit(1);
}
