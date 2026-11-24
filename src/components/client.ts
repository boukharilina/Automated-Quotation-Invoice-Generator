"use client";

/** Small fetch helper: JSON in/out, throws Error(message-from-server). */
export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { window.location.href = "/login"; }
    throw new Error(data.error || "Une erreur est survenue.");
  }
  return data;
}
