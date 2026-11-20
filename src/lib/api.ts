'use client';

import { CLIENT_ID_HEADER } from './sessionCookie';

/** Random per-tab id; the server echoes it in realtime events so this tab can skip its own changes. */
export const CLIENT_ID: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function newPlaceId(): string {
  return crypto.randomUUID();
}

/** fetch with the client id header and JSON body handling. Throws on non-2xx with the server's error message. */
export async function apiFetch<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      [CLIENT_ID_HEADER]: CLIENT_ID,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error((data as { error?: string }).error || `요청 실패 (${res.status})`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return data as T;
}
