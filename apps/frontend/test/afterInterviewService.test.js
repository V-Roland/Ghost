import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestTranscript } from '../src/services/api/afterInterviewService.js';

test('ingestTranscript delegates to the authenticated API request path', async () => {
  const calls = [];
  const result = await ingestTranscript({ mode: 'vtt', vtt: 'WEBVTT' }, async (...args) => {
    calls.push(args);
    return { report: { reportId: 'report-1' } };
  });

  assert.equal(result.report.reportId, 'report-1');
  assert.equal(calls[0][0], '/api/after-interview/ingest');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), { mode: 'vtt', vtt: 'WEBVTT' });
});

test('ingestTranscript omits unused transcript fields in sample mode', async () => {
  await ingestTranscript({ mode: 'sample' }, async (_path, options) => {
    assert.deepEqual(JSON.parse(options.body), { mode: 'sample' });
    return {};
  });
});
