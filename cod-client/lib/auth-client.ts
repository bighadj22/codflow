import { cloudflareClient } from "better-auth-cloudflare/client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Use window.location.origin for client-side auth to get the actual deployed URL
// This ensures the auth client uses the correct URL in production (https://app.domain.com)
// instead of the build-time localhost value
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [cloudflareClient(), magicLinkClient()],
});
