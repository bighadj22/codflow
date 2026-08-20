import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getCFEnv(): CloudflareEnv | null {
  try {
    return getCloudflareContext().env as CloudflareEnv;
  } catch {
    return null;
  }
}
