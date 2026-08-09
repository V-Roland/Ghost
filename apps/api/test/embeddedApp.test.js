import assert from 'node:assert/strict';
import test from 'node:test';
import { createGhostApiApp } from '../src/app.js';

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'public-test-key';

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => resolve(server));
  });
}

test('embedded API serves health with desktop security headers', async () => {
  const app = createGhostApiApp({ allowedOrigins: [], desktopMode: true, isProduction: true });
  const server = await listen(app);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'ghost-api' });
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
