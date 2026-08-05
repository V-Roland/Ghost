import { getSupabaseClient } from '../supabase/client.js';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071').replace(/\/$/, '');

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
