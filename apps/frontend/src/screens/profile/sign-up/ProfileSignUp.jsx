import React, { useState } from 'react';
import { MINIMUM_PASSWORD_LENGTH } from '../../../domain/auth/registration.js';

const EMPTY_FORM = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: ''
};

export default function ProfileSignUp({ configurationError, onRegister, onSignIn }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await onRegister(form);
      if (result?.verificationRequired) {
        setVerificationEmail(result.email);
        setForm(EMPTY_FORM);
      }
    } catch (requestError) {
      setError(requestError.message || 'Your account could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationEmail) {
    return (
      <section className="profile-sign-in">
        <div className="profile-sign-in-card card elevated auth-confirmation" role="status">
          <span className="eyebrow">Confirm Your Account</span>
          <h1>Check your email</h1>
          <p>
            We sent an account confirmation link to <strong>{verificationEmail}</strong>. Open it to finish
            creating your account, then return to Ghost.
          </p>
          <button className="primary" type="button" onClick={onSignIn}>Return to sign in</button>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-sign-in">
      <div className="profile-sign-in-card card elevated">
        <span className="eyebrow">Create Secure Workspace</span>
        <h1>Create your Ghost account</h1>
        <p>Your account owns its interviews, candidates, folders, and private files.</p>
        {configurationError && (
          <div className="auth-error" role="alert">
            <strong>Configuration required.</strong> {configurationError}
          </div>
        )}
        <form className="profile-login-form" onSubmit={submit}>
          <label>
            Account name
            <input
              type="text"
              autoComplete="name"
              maxLength="120"
              value={form.displayName}
              onChange={updateField('displayName')}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField('email')}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              minLength={MINIMUM_PASSWORD_LENGTH}
              value={form.password}
              onChange={updateField('password')}
              aria-describedby="sign-up-password-help"
              required
            />
            <small id="sign-up-password-help">Use at least {MINIMUM_PASSWORD_LENGTH} characters.</small>
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={MINIMUM_PASSWORD_LENGTH}
              value={form.confirmPassword}
              onChange={updateField('confirmPassword')}
              required
            />
          </label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={submitting || Boolean(configurationError)}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-switch">
          <span>Already have an account?</span>
          <button className="ghost-link" type="button" onClick={onSignIn}>Sign in</button>
        </div>
      </div>
    </section>
  );
}
