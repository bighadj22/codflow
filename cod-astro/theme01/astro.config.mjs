import { defineConfig, envField, passthroughImageService } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import compress from "@playform/compress";
import icon from "astro-icon";

export default defineConfig({
  output: "server",
  compressHTML: true,
  session: false,
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  env: {
    schema: {
      STORE_API_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true, // Allow build to proceed with warning if missing
      }),
      COD_SERVER_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Optional media/CDN domain serving R2 images (e.g. media.yourdomain.com).
      // Unset → the image optimizer passes original URLs through unchanged.
      MEDIA_DOMAIN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  prefetch: true,
  image: {
    service: passthroughImageService(),
    remotePatterns: [{ protocol: "https" }],
  },
  build: {
    // Inline ALL stylesheets to eliminate render-blocking CSS
    inlineStylesheets: "always",
  },
  integrations: [
    icon({
      include: {
        heroicons: [
          "check-badge",       // features: Authentic Products, verified buyer
          "truck",             // features: Fast Delivery, announcement bar
          "banknotes",         // features: COD, HowItWorks step 3
          "clock",             // features: 24/7 Support
          "arrow-right",       // CTA arrows
          "magnifying-glass",  // search
          "shopping-bag",      // HowItWorks, product card order btn
          "chat-bubble-left-right", // HowItWorks step 2
          "check",             // selected state checkmarks
          "chevron-down",      // dropdown toggle
          "photo",             // image placeholder
          "home",              // mobile nav
          "squares-2x2",       // mobile nav products
          "check-circle",      // review success, verified buyer
          "credit-card",       // trust: COD payment
          "bolt",              // trust: fast / low stock
          "phone",             // thank-you step 1
          "cube",              // thank-you step 2 (package)
          "gift",              // offer free label
          "exclamation-triangle", // warning/error
          "chat-bubble-left",  // WhatsApp CTA
          "star",              // reviews header
          "home-modern",       // delivery: home
        ],
      },
    }),
    compress({
      CSS: true,
      HTML: {
        removeAttributeQuotes: false,
        removeComments: true,
        collapseWhitespace: true,
      },
      Image: true,
      JavaScript: true,
      SVG: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    environments: {
      ssr: {
        optimizeDeps: {
          // Deps discovered after boot trigger a re-bundle whose chunk renames
          // race the workerd reload and wedge/crash the runner
          // (withastro/astro#16933). Disable late discovery entirely: deps
          // found at request time load unbundled instead. Must live under
          // vite.environments.ssr — the legacy vite.ssr.optimizeDeps key is
          // ignored by Vite 8 here.
          noDiscovery: true,
          exclude: ["astro/assets/services/noop", "astro-icon/components"],
        },
      },
    },
    build: {
      // Minify for production
      minify: "esbuild",
      cssMinify: true,
      // Inline assets up to 100KB (way more than our 8.51KB CSS)
      assetsInlineLimit: 102400,
      // Disable CSS code splitting to keep all CSS together
      cssCodeSplit: false,
    },
  },
});
