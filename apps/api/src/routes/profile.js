import express from 'express';
import { profileRecord } from '../lib/apiRecords.js';
import { normalizeProfileUpdate } from '../lib/profile.js';
import { throwIfSupabaseError } from '../lib/supabaseError.js';

export const profileRouter = express.Router();

profileRouter.get('/me', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('profiles')
      .select('id,display_name,role,theme_preference,created_at,updated_at')
      .eq('id', req.auth.userId)
      .single();
    throwIfSupabaseError(error);
    res.json({ profile: profileRecord(data, req.auth.email) });
  } catch (error) {
    next(error);
  }
});

profileRouter.patch('/me', async (req, res, next) => {
  try {
    const update = normalizeProfileUpdate(req.body);
    const databaseUpdate = {};
    if (update.displayName) databaseUpdate.display_name = update.displayName;
    if (update.themePreference) databaseUpdate.theme_preference = update.themePreference;
    const { data, error } = await req.supabase
      .from('profiles')
      .update(databaseUpdate)
      .eq('id', req.auth.userId)
      .select('id,display_name,role,theme_preference,created_at,updated_at')
      .single();
    throwIfSupabaseError(error);
    res.json({ profile: profileRecord(data, req.auth.email) });
  } catch (error) {
    next(error);
  }
});
