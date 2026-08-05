import { getSupabaseClient } from '../supabase/client.js';

function authenticationError(error, fallback) {
  const requestError = new Error(error?.message || fallback);
  requestError.code = error?.code;
  requestError.status = error?.status;
  return requestError;
}

function profileView(profile, user) {
  return {
    id: profile.id,
    userId: profile.id,
    email: user.email || '',
    displayName: profile.display_name,
    role: profile.role,
    themePreference: profile.theme_preference
  };
}

async function loadProfile(user) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,role,theme_preference')
    .eq('id', user.id)
    .single();
  if (error) {
    throw authenticationError(error, 'Your profile could not be loaded.');
  }
  return profileView(data, user);
}

export async function loadSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { profile: await loadProfile(data.user), authenticationMethod: 'supabase' };
}

export async function login({ email, password }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    throw authenticationError(error, 'Sign-in failed.');
  }
  return { profile: await loadProfile(data.user), authenticationMethod: 'supabase' };
}

export async function logout() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw authenticationError(error, 'Sign-out failed.');
}

export async function changePassword(currentPassword, newPassword) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) {
    throw authenticationError(userError, 'Your current session could not be verified.');
  }

  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword
  });
  if (verificationError) {
    throw authenticationError(verificationError, 'The current password is incorrect.');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    throw authenticationError(updateError, 'Password could not be changed.');
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) throw authenticationError(signOutError, 'Password changed, but sign-out failed.');
}

export function onAuthenticationChange(callback) {
  const { data } = getSupabaseClient().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') callback(null);
  });
  return () => data.subscription.unsubscribe();
}
