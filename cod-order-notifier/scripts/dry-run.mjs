import { readFileSync, writeFileSync } from "node:fs";
import { loadLocalEnv } from "./env.mjs";
import { runCheck, createFileStore } from "../src/notifier.mjs";

const env = loadLocalEnv();
const statePath = new URL("../.local-state.json", import.meta.url);
const store = createFileStore(readFileSync, writeFileSync, statePath);

const sent = [];
const result = await runCheck(env, {
  store,
  sendMessage: async (_env, text) => {
    sent.push(text);
  },
});

console.log(
  JSON.stringify(
    {
      mode: "dry-run (no Telegram message sent)",
      ...result,
      wouldNotify: sent.length,
    },
    null,
    2,
  ),
);
