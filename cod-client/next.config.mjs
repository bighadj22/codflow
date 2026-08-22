import path from "node:path";

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  // Share local miniflare state with cod-server by pointing at the same
  // persist path. Without this, Next dev uses cod-client/.wrangler/state/v3
  // while cod-server uses cod-server/.wrangler/state/v3, and their local D1s
  // diverge. Path mirrors what `wrangler --persist-to ../.wrangler-shared`
  // produces (state lives under <path>/v3).
  await initOpenNextCloudflareForDev({
    persist: { path: "../.wrangler-shared/v3" },
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // cod-shared lives outside this package (../../cod-shared/*). Turbopack
  // treats this package's dir as the workspace root by default and fails to
  // resolve imports above it, so point it at the monorepo root explicitly.
  turbopack: {
    root: path.resolve(import.meta.dirname, ".."),
  },
  images: {
    unoptimized: true,
  },
  // Silence workspace root warning. Must match turbopack.root — Next warns and
  // prefers outputFileTracingRoot if they diverge, which re-breaks resolution.
  outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
  // Reduce parallelism during build to avoid SQLite lock conflicts
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
