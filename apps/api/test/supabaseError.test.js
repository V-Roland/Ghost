import test from 'node:test';
import assert from 'node:assert/strict';
import { throwIfSupabaseError } from '../src/lib/supabaseError.js';

test('maps row visibility misses to a generic not-found error', () => {
  assert.throws(
    () => throwIfSupabaseError({ code: 'PGRST116', message: 'zero rows' }),
    { statusCode: 404, code: 'RESOURCE_NOT_FOUND' }
  );
});

test('maps row-level authorization failures without leaking database details', () => {
  assert.throws(
    () => throwIfSupabaseError({ code: '42501', message: 'internal policy details' }),
    { statusCode: 403, code: 'ACCESS_DENIED', message: 'The requested operation is not permitted.' }
  );
});

test('maps database workspace validation to a safe client error', () => {
  assert.throws(
    () => throwIfSupabaseError({ code: '22023', message: 'internal database detail' }),
    { statusCode: 400, code: 'INVALID_REQUEST', message: 'The workspace data did not satisfy database validation.' }
  );
});
