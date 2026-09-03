import type { APIRoute } from "astro";

/**
 * Email-link landing: /reset-password/<token> → /reset-password?token=<token>.
 *
 * The emailed URL is `${PUBLIC_APP_URL}/reset-password/<token>` (better-auth
 * builds it from baseURL) — this route hands the token to the prerendered
 * form page. The `callbackURL` query param is deliberately ignored: the
 * redirect target is fixed, so no untrusted URL ever reaches a redirect.
 */

export const prerender = false;

export const GET: APIRoute = ({ params, redirect }) => {
  const token = params.token ?? "";
  return redirect(`/reset-password?token=${encodeURIComponent(token)}`, 302);
};
