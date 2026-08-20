/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface CloudflareEnv {
  /** Raw store API key — set as a Cloudflare secret */
  STORE_API_KEY: string;
  /** Base URL of cod-server (e.g. https://api.yourdomain.com). Local: http://localhost:8787 */
  COD_SERVER_URL: string;
  /** Optional media/CDN domain serving R2 images (e.g. media.yourdomain.com) — used by the image optimizer */
  MEDIA_DOMAIN?: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface SelectOption {
  value: string;
  label: string;
}

interface Window {
  __selectSetLoading: (id: string, loading: boolean, loadingText: string) => void;
  __selectPopulate: (id: string, options: SelectOption[], placeholder: string) => void;
  __selectSetDisabled: (id: string, disabledText: string) => void;
}
