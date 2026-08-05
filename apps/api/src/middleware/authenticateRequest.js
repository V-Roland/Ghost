import { HttpError } from '../lib/httpError.js';
import { createTokenVerifier, createUserClient } from '../services/supabaseClient.js';

export function bearerToken(authorization) {
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] || null;
}

export async function authenticateRequest(req, _res, next) {
  const accessToken = bearerToken(req.header('authorization'));
  if (!accessToken) {
    return next(new HttpError(401, 'AUTH_REQUIRED', 'A valid Supabase access token is required.'));
  }

  try {
    const verifier = createTokenVerifier();
    const { data, error } = await verifier.auth.getUser(accessToken);
    if (error || !data.user) {
      return next(new HttpError(401, 'AUTH_REQUIRED', 'A valid Supabase access token is required.'));
    }

    req.auth = { userId: data.user.id, email: data.user.email || null };
    req.supabase = createUserClient(accessToken);
    return next();
  } catch (error) {
    return next(error);
  }
}
