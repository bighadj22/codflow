/**
 * Scalar API reference, loaded from CDN.
 *
 * Why CDN instead of @scalar/api-reference-react: bundling the React
 * package adds ~1.5 MiB (gzip) to the cod-client Worker, which pushes
 * us over the 3 MiB Cloudflare Workers free-tier limit. Partners on
 * the free Cloudflare plan can't deploy. The standalone CDN bundle
 * (browser/standalone.js) loads the same UI from jsDelivr at runtime
 * — zero Worker bundle cost, identical feature set.
 *
 * Standalone bundle contract: it auto-mounts when it finds an element
 * with id="api-reference" and reads either `data-url` or
 * `data-configuration` (JSON-encoded full config). We pass the full
 * config via `data-configuration` so theme/sidebar/etc. survive.
 */

import Script from "next/script";

const SCALAR_CDN_URL = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";

export default function APIReferencePage() {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";

  const configuration = {
    url: `${workerUrl}/api/openapi.json`,
    theme: "default",
    layout: "modern",
    showSidebar: true,
    darkMode: true,
    showDeveloperTools: "never",
    documentDownloadType: "none",
    hideClientButton: true,
    hiddenClients: true,
  };

  return (
    <>
      <script
        id="api-reference"
        data-configuration={JSON.stringify(configuration)}
      />
      <Script src={SCALAR_CDN_URL} strategy="afterInteractive" />
    </>
  );
}
