import { PUBLIC_API_URL } from "astro:env/client";

const API_URL = PUBLIC_API_URL;

import { currentJwt, refreshJwt } from "@/lib/session";

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
  const call = () =>
    currentJwt().then((jwt) =>
      fetch(`${API_URL}${path}`, {
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
  const call = () =>
    currentJwt().then((jwt) =>
      fetch(`${API_URL}${path}`, {
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
