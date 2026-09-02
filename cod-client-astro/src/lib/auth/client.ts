import { createAuthClient } from "better-auth/client";

/** Same-origin better-auth client — the single shared instance for islands. */
export const authClient = createAuthClient();
