import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    // Whole-tree scanning guards (i18n, native-select, browser-dialogs) read
    // hundreds of source files synchronously and exceed the 5s default under
    // full-suite parallel load on Windows — same class of fix as cod-server's
    // raised hookTimeout for migration replay.
    testTimeout: 30000,
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
