import React, { useState } from 'react';

export default function ProfileSignIn({ configurationError, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onLogin({ email, password });
    } catch (requestError) {
      setError(requestError.message || 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="profile-sign-in">
      <div className="profile-sign-in-card card elevated">
        <span className="eyebrow">Secure Profile Workspace</span>
        <h1>Sign in to Ghost</h1>
        <p>Your verified Supabase account determines every interview, candidate, and file you can access.</p>
        {configurationError && (
          <div className="auth-error" role="alert">
            <strong>Configuration required.</strong> {configurationError}
          </div>
        )}
        <form className="profile-login-form" onSubmit={submit}>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={submitting || Boolean(configurationError)}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </section>
  );
}
