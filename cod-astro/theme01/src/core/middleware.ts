// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Handles the POST/Redirect/GET pattern for Astro Actions.            ║
// ║  Changing this file will break form submission for all pages.        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";

/**
 * POST/Redirect/GET pattern for Astro Actions (Astro 5 docs pattern).
 *
 * On ERROR  → store result cookie + 303 redirect back to the form page
 *             → page re-renders, getActionResult() returns the error, field
 *               errors are displayed to the user.
 *
 * On SUCCESS → store result cookie + call next()
 *             → next() renders the originating page from the same POST request
 *             → getActionResult() returns the success data, the page issues
 *               Astro.redirect('/thank-you?...') which the browser follows.
 *
 * IMPORTANT: on success we must call next(), NOT context.redirect(). Using
 * context.redirect() drops the setActionResult cookie from the response, so
 * getActionResult() sees undefined on the next page and the thank-you redirect
 * never fires.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { action, setActionResult, serializeActionResult } = getActionContext(context);

  if (action?.calledFrom === "form") {
    const result = await action.handler();
    setActionResult(action.name, serializeActionResult(result));

    if (result.error) {
      // Redirect back to the form page so getActionResult() can surface field errors
      const referer = context.request.headers.get("Referer");
      return context.redirect(referer ?? context.url.pathname, 303);
    }

    // Success: let next() render the page; the page will redirect to /thank-you
  }

  return next();
});
