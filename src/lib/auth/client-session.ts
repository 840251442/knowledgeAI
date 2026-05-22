"use client";

type ClientRole = "ADMIN" | "PERSONAL";

type StoredAuthSession = {
  accessToken: string;
  accessTokenExpiresAt: number;
  role: ClientRole;
  userId: string;
};

type RefreshResponse = {
  accessToken: string;
  accessTokenExpiresIn: number;
  role: ClientRole;
  userId: string;
};

type RefreshApiResponse =
  | { success: true; data: RefreshResponse }
  | { success: false; error: { message: string } };

const STORAGE_KEY = "ka_auth_session";
const SESSION_EVENT = "ka-auth-session-change";
const EXPIRE_SKEW_MS = 30_000;
let cachedRawSession: string | null | undefined;
let cachedParsedSession: StoredAuthSession | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadAuthSession(): StoredAuthSession | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (
      !parsed ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.accessTokenExpiresAt !== "number" ||
      (parsed.role !== "ADMIN" && parsed.role !== "PERSONAL") ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    return parsed as StoredAuthSession;
  } catch {
    return null;
  }
}

export function saveAuthSession(input: {
  accessToken: string;
  accessTokenExpiresIn: number;
  role: ClientRole;
  userId: string;
}) {
  if (!isBrowser()) return;

  const record: StoredAuthSession = {
    accessToken: input.accessToken,
    accessTokenExpiresAt: Date.now() + input.accessTokenExpiresIn * 1000,
    role: input.role,
    userId: input.userId,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function subscribeAuthSession(onStoreChange: () => void) {
  if (!isBrowser()) return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_EVENT, onStoreChange);
  };
}

export function getAuthSessionSnapshot() {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRawSession) {
    return cachedParsedSession;
  }

  cachedRawSession = raw;
  if (!raw) {
    cachedParsedSession = null;
    return cachedParsedSession;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (
      !parsed ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.accessTokenExpiresAt !== "number" ||
      (parsed.role !== "ADMIN" && parsed.role !== "PERSONAL") ||
      typeof parsed.userId !== "string"
    ) {
      cachedParsedSession = null;
      return cachedParsedSession;
    }
    cachedParsedSession = parsed as StoredAuthSession;
    return cachedParsedSession;
  } catch {
    cachedParsedSession = null;
    return cachedParsedSession;
  }
}

export function getAuthSessionServerSnapshot(): StoredAuthSession | null {
  return null;
}

function shouldRefresh(session: StoredAuthSession) {
  return session.accessTokenExpiresAt - Date.now() <= EXPIRE_SKEW_MS;
}

export async function refreshAuthSession(): Promise<StoredAuthSession | null> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
  });

  let json: RefreshApiResponse | null = null;
  try {
    json = (await res.json()) as RefreshApiResponse;
  } catch {
    json = null;
  }

  if (!res.ok || !json || !json.success) {
    clearAuthSession();
    return null;
  }

  saveAuthSession(json.data);
  return loadAuthSession();
}

export async function getActiveAccessToken(): Promise<string | null> {
  const session = loadAuthSession();
  if (!session) return null;

  if (!shouldRefresh(session)) {
    return session.accessToken;
  }

  const refreshed = await refreshAuthSession();
  return refreshed?.accessToken ?? null;
}
