import type { ApiResponse } from "@/types/api";

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });

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

