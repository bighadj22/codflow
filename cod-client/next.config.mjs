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
  images: {
    unoptimized: true,
  },
  // Reduce parallelism during build to avoid SQLite lock conflicts
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
