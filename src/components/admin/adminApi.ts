import type { ApiResponse } from "@/types/api";
import { getActiveAccessToken, refreshAuthSession } from "@/lib/auth/client-session";

function getRequestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

function shouldSkipRefresh(input: RequestInfo | URL) {
  const path = getRequestPath(input);
  return path.includes("/api/auth/refresh") || path.includes("/api/admin/login") || path.includes("/api/auth/register");
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit, retry = true): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const accessToken = await getActiveAccessToken();
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && retry && !shouldSkipRefresh(input)) {
    const refreshed = await refreshAuthSession();
    if (refreshed?.accessToken) {
      const retryHeaders = new Headers(init?.headers);
      if (init?.body && !retryHeaders.has("content-type")) {
        retryHeaders.set("content-type", "application/json");
      }
      retryHeaders.set("authorization", `Bearer ${refreshed.accessToken}`);

      return fetch(input, {
        ...init,
        credentials: "include",
        headers: retryHeaders,
      });
    }
  }

  return res;
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await authFetch(input, init);

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = json && !json.success ? json.error.message : `请求失败 (${res.status})`;
    throw new Error(message);
  }

  if (!json) throw new Error("响应不是有效的 JSON");
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

