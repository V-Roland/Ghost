import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken } from '../src/middleware/authenticateRequest.js';
import { profileRecord } from '../src/lib/apiRecords.js';

test('accepts only a single bearer access token', () => {
  assert.equal(bearerToken('Bearer signed-token'), 'signed-token');
  assert.equal(bearerToken('bearer signed-token'), 'signed-token');
  assert.equal(bearerToken('Basic credentials'), null);
  assert.equal(bearerToken('Bearer one two'), null);
  assert.equal(bearerToken(undefined), null);
});

test('profile projection exposes no authentication secrets', () => {
  const profile = profileRecord({
    id: '8ad77031-e7b0-41e1-aa9f-ec9ef2463939',
    display_name: 'Sally Chen',
    role: 'Interviewer',
    theme_preference: 'dark',
    created_at: '2026-08-05T00:00:00.000Z',
    updated_at: '2026-08-05T00:00:00.000Z'
  }, 'sally@example.com');
  assert.equal(profile.userId, profile.id);
  assert.equal('password' in profile, false);
  assert.equal('accessToken' in profile, false);
});
