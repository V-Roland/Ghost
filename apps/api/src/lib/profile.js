import { HttpError } from './httpError.js';

const allowedProfileFields = new Set(['displayName', 'themePreference']);
const allowedThemes = new Set(['dark', 'light', 'system']);

function normalizedDisplayName(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'INVALID_PROFILE', 'displayName is required.');
  }

  const displayName = value.trim().replace(/\s+/g, ' ');
  if (displayName.length > 120) {
    throw new HttpError(400, 'INVALID_PROFILE', 'displayName must be 120 characters or fewer.');
  }
  return displayName;
}

export function normalizeProfileUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Profile update must be a JSON object.');
  }

  for (const field of Object.keys(body)) {
    if (!allowedProfileFields.has(field)) {
      throw new HttpError(400, 'INVALID_PROFILE', `Unsupported profile property: ${field}.`);
    }
  }

  const update = {};
  if ('displayName' in body) update.displayName = normalizedDisplayName(body.displayName);
  if ('themePreference' in body) {
    if (!allowedThemes.has(body.themePreference)) {
      throw new HttpError(400, 'INVALID_PROFILE', 'themePreference must be dark, light, or system.');
    }
    update.themePreference = body.themePreference;
  }

  if (!Object.keys(update).length) {
    throw new HttpError(400, 'INVALID_PROFILE', 'At least one profile property is required.');
  }
  return update;
}
