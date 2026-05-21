import { NextResponse } from "next/server";

import type { ApiError, ApiSuccess } from "@/types/api";

export function apiOk<T>(data: T, init?: ResponseInit) {
  const body: ApiSuccess<T> = { success: true, data };
  return NextResponse.json(body, init);
}

export function apiError(
  message: string,
  options?: { status?: number; code?: string },
  init?: ResponseInit,
) {
  const status = options?.status ?? 500;
  const body: ApiError = {
    success: false,
    error: {
      message,
      code: options?.code,
    },
  };

  return NextResponse.json(body, { status, ...init });
}

