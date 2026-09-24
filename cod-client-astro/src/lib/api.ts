import { PUBLIC_API_URL } from "astro:env/client";

import { currentJwt, refreshJwt } from "@/lib/session";

/**
 * Resolve the cod-server origin for browser code.
 *
 * `PUBLIC_API_URL` is baked at build time (astro:env/client), which is fine
 * for a self-hosted deployment where the dashboard and API origins are known
 * when the bundle is produced. Platform deployments can't bake it: one build
 * serves many stores, each with its own API origin. Those deployments follow
 * the `app.<store-domain>` → `api.<store-domain>` subdomain convention, so we
 * derive the origin from `window.location.hostname` at request time and only
 * fall back to the baked value when the convention doesn't apply (localhost,
 * self-hosted domains that don't start with `app.`).
 */
export function publicApiUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.startsWith("app.")) {
      return `https://api.${hostname.slice("app.".length)}`;
    }
  }
  return PUBLIC_API_URL;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public category?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = publicApiUrl();
  const call = () =>
    currentJwt().then((jwt) =>
      fetch(`${apiUrl}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          ...(init.headers ?? {}),
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
      })
    );

  let res = await call();
  if (res.status === 401) {
    await refreshJwt();
    res = await call();
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    let category: string | undefined;
    let context: Record<string, unknown> | undefined;
    try {
      const body = (await res.json()) as {
        error?: string;
        code?: string;
        category?: string;
        context?: Record<string, unknown>;
      };
      message = body.error ?? message;
      code = body.code;
      category = body.category;
      context = body.context;
    } catch {}
    throw new ApiError(message, res.status, code, category, context);
  }
  return (await res.json()) as T;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const apiUrl = publicApiUrl();
  const call = () =>
    currentJwt().then((jwt) =>
      fetch(`${apiUrl}${path}`, {
        credentials: "include",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      })
    );

  let res = await call();
  if (res.status === 401) {
    await refreshJwt();
    res = await call();
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      message = body.error ?? message;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.blob();
}
