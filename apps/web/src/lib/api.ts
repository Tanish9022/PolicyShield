/**
 * Shared API configuration for the PolicyShield frontend.
 * Single source of truth for the backend URL and safe fetch helpers.
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetch JSON from the API with safe error handling.
 * Returns the parsed JSON or throws with a descriptive message.
 */
export async function fetchApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch an array from the API. Returns [] if the response is not an array.
 */
export async function fetchArray<T = any>(path: string): Promise<T[]> {
  try {
    const data = await fetchApi(path);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
