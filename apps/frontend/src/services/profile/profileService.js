import { apiRequest } from '../api/apiClient.js';

export async function updateProfile(update) {
  const { profile } = await apiRequest('/api/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(update)
  });
  return profile;
}
