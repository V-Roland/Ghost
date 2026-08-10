import { getSupabaseClient } from '../supabase/client.js';

const viteEnvironment = import.meta.env || {};
const configuredApiBaseUrl = viteEnvironment.VITE_API_BASE_URL?.trim();
const defaultApiBaseUrl = viteEnvironment.MODE === 'desktop'
  ? globalThis.location.origin
  : globalThis.location?.protocol?.startsWith('http')
    ? globalThis.location.origin
    : 'http://localhost:7071';
const apiBaseUrl = (configuredApiBaseUrl || defaultApiBaseUrl).replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your session has expired. Sign in again.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || 'The request failed.');
  }
  return response.status === 204 ? null : response.json();
}
