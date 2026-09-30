import { AUTH_URL, CALL_URL } from "./config";
import type { Session } from "./session";

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new ApiError(body?.detail ?? body?.message ?? `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function authenticate(path: "login" | "register", email: string, password: string) {
  return request<{ accessToken: string; userId: string; email: string; tokenType: string; expiresInSeconds: number }>(
    `${AUTH_URL}/api/auth/${path}`, null, { method: "POST", body: JSON.stringify({ email, password }) },
  ).then(({ accessToken, userId, email: accountEmail }) => ({ token: accessToken, userId, email: accountEmail }));
}

export function isLocalTestAuthBypassEnabled(): boolean {
  return typeof window !== "undefined"
    && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname)
    && process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === "true";
}

export async function authenticateLocalTestUser(): Promise<Session> {
  if (!isLocalTestAuthBypassEnabled()) {
    throw new Error("The local test sign-in is disabled");
  }

  const storageKey = "video-platform-local-test-browser";
  const browserId = window.sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, browserId);
  return request<{ accessToken: string; userId: string; email: string }>(
    `${AUTH_URL}/api/auth/local-test-session`, null, {
      method: "POST",
      body: JSON.stringify({ browserId }),
    },
  ).then(({ accessToken, userId, email }) => ({ token: accessToken, userId, email }));
}

export type CallRecord = {
  id: string;
  callerId: string;
  calleeId: string;
  status: string;
};

export function createCall(token: string, calleeId: string) {
  return request<CallRecord>(`${CALL_URL}/api/calls`, token, {
    method: "POST",
    body: JSON.stringify({ calleeId }),
  });
}

export function joinCall(token: string, callId: string) {
  return request<CallRecord>(`${CALL_URL}/api/calls/${callId}/join`, token, { method: "POST" });
}

export function endCall(token: string, callId: string) {
  return request<CallRecord>(`${CALL_URL}/api/calls/${callId}/end`, token, { method: "PATCH" });
}

export function rejectCall(token: string, callId: string) {
  return request<CallRecord>(`${CALL_URL}/api/calls/${callId}/reject`, token, { method: "PATCH" });
}

export function getCallHistory(token: string) {
  return request<CallRecord[]>(`${CALL_URL}/api/calls`, token);
}

export function getCall(token: string, callId: string) {
  return request<CallRecord>(`${CALL_URL}/api/calls/${callId}`, token);
}
