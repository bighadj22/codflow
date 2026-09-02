import { fileURLToPath } from "node:url";
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

const orderDetailFallback = {
  name: "order-detail-static-fallback",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const pathname = request.url?.split("?", 1)[0] ?? "";
       const isOrderDetail = /^\/orders\/[^/]+\/?$/.test(pathname) && pathname !== "/orders/new" && pathname !== "/orders/abandoned";
       const isCustomerDetail = /^\/customers\/[^/]+(?:\/edit)?\/?$/.test(pathname) && pathname !== "/customers/new";
       const isCustomerGroupDetail = /^\/customer-groups\/[^/]+(?:\/edit)?\/?$/.test(pathname) && pathname !== "/customer-groups/new";
       const isCustomerTagDetail = /^\/customer-tags\/[^/]+(?:\/edit)?\/?$/.test(pathname) && pathname !== "/customer-tags/new";
       const isProductDetail = /^\/products\/[^/]+(?:\/edit)?\/?$/.test(pathname) && pathname !== "/products/new" && pathname !== "/products/stock";
       const isProductGroupEdit = /^\/product-groups\/[^/]+\/edit\/?$/.test(pathname);
       const isOfferEdit = /^\/offers\/[^/]+\/?$/.test(pathname) && pathname !== "/offers/new";
       const isDriverRoute = /^\/delivery\/drivers\/[^/]+(?:\/(edit|compensations))?\/?$/.test(pathname) && pathname !== "/delivery/drivers/new";
       const isDeliveryCompanyRoute = /^\/delivery\/companies\/[^/]+(?:\/(credentials|stop-desks))?\/?$/.test(pathname);
       const isShippingProfileRoute = /^\/delivery\/shipping-profiles\/[^/]+(?:\/edit)?\/?$/.test(pathname) && pathname !== "/delivery/shipping-profiles/new";
       const isTeamMemberRoute = /^\/team\/[^/]+\/?$/.test(pathname);
       if (isOrderDetail || isCustomerDetail || isCustomerGroupDetail || isCustomerTagDetail || isProductDetail || isProductGroupEdit || isOfferEdit || isDriverRoute || isDeliveryCompanyRoute || isShippingProfileRoute || isTeamMemberRoute) {
         request.url = "/";
       }
      next();
    });
  },
};

// Static-first: every page prerenders at build time except routes that opt out
// with `export const prerender = false` (currently only /api/auth/*).
export default defineConfig({
  output: "static",
  // No Astro.session usage (auth is better-auth + its own KV) — docs:
  // session:false skips SESSION KV provisioning and drops the session
  // runtime from the Worker bundle.
  session: false,
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: "client", access: "public" }),
    },
  },
  integrations: [react()],
  adapter: cloudflare({
    // No astro:assets usage yet — noop image service per adapter docs.
    imageService: "passthrough",
    // Share one local D1/KV state with cod-server (`npm run dev` there uses
    // --persist-to ../.wrangler-shared): without this, astro dev gets its own
    // empty SQLite and sign-in fails against an unmigrated database.
    persistState: { path: "../.wrangler-shared" },
  }),
  vite: {
    plugins: [orderDetailFallback, tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
