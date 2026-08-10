import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { afterInterviewRouter, normalizeAfterInterviewRequest } from '../src/routes/afterInterview.js';

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => resolve(server));
  });
}

function testApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/after-interview', afterInterviewRouter);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
  });
  return app;
}

test('normalizes report input and rejects caller-supplied ownership', () => {
  assert.deepEqual(normalizeAfterInterviewRequest({ mode: 'sample' }), { mode: 'sample' });
  assert.throws(
    () => normalizeAfterInterviewRequest({ mode: 'sample', user_id: 'caller-controlled' }),
    (error) => error.statusCode === 400 && error.code === 'INVALID_REPORT_REQUEST'
  );
});

test('sample report endpoint runs the complete parser and report pipeline', async () => {
  const server = await listen(testApp());
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/after-interview/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'sample' })
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, 'sample');
    assert.equal(result.transcript.segments.length, 6);
    assert.equal(result.report.evidencePackets.length, 6);
    assert.match(result.report.summary, /human interpretation/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('report endpoint rejects empty VTT content', async () => {
  const server = await listen(testApp());
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/after-interview/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'vtt', vtt: '' })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VTT_REQUIRED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
