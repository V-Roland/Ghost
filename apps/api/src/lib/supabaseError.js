import { HttpError } from './httpError.js';

export function throwIfSupabaseError(error, fallbackCode = 'DATABASE_REQUEST_FAILED') {
  if (!error) return;

  if (error.code === 'PGRST116') {
    throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }
  if (error.code === '23505') {
    throw new HttpError(409, 'RESOURCE_CONFLICT', 'A matching record already exists.');
  }
  if (error.code === '42501') {
    throw new HttpError(403, 'ACCESS_DENIED', 'The requested operation is not permitted.');
  }

  const requestError = new Error(error.message || 'Supabase request failed.');
  requestError.code = fallbackCode;
  throw requestError;
}
