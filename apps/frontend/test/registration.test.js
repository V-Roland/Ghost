import assert from 'node:assert/strict';
import test from 'node:test';
import { MINIMUM_PASSWORD_LENGTH, prepareRegistration } from '../src/domain/auth/registration.js';

test('prepareRegistration normalizes account identity fields', () => {
  const password = 'a secure password';
  assert.deepEqual(
    prepareRegistration({
      displayName: '  Sally   Chen  ',
      email: '  SALLY@example.COM ',
      password,
      confirmPassword: password
    }),
    {
      displayName: 'Sally Chen',
      email: 'sally@example.com',
      password
    }
  );
});

test('prepareRegistration enforces the configured password minimum', () => {
  assert.throws(
    () => prepareRegistration({
      displayName: 'Sally Chen',
      email: 'sally@example.com',
      password: 'x'.repeat(MINIMUM_PASSWORD_LENGTH - 1),
      confirmPassword: 'x'.repeat(MINIMUM_PASSWORD_LENGTH - 1)
    }),
    /at least 15 characters/
  );
});

test('prepareRegistration rejects mismatched password confirmation', () => {
  assert.throws(
    () => prepareRegistration({
      displayName: 'Sally Chen',
      email: 'sally@example.com',
      password: 'correct horse battery staple',
      confirmPassword: 'different secure password'
    }),
    /do not match/
  );
});

test('prepareRegistration rejects invalid names and email addresses', () => {
  assert.throws(
    () => prepareRegistration({
      displayName: ' ',
      email: 'sally@example.com',
      password: 'correct horse battery staple',
      confirmPassword: 'correct horse battery staple'
    }),
    /Enter the name/
  );
  assert.throws(
    () => prepareRegistration({
      displayName: 'Sally Chen',
      email: 'not-an-email',
      password: 'correct horse battery staple',
      confirmPassword: 'correct horse battery staple'
    }),
    /valid email/
  );
});
