import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMockReport } from '../src/lib/reportGenerator.js';

test('generateMockReport creates grounded, review-only signals and evidence packets', () => {
  const transcript = { segments: [
    { speaker: 'Interviewer', start: 0, end: 2, text: 'Tell me about your work.' },
    { speaker: 'Candidate', start: 2, end: 8, text: 'I improved queue reliability.' }
  ] };
  const report = generateMockReport(transcript);
  assert.ok(report.reportId);
  assert.equal(report.signals.length, 1);
  assert.match(report.signals[0].description, /75%/);
  assert.match(report.signals[0].description, /not an assessment/i);
  assert.equal(report.evidencePackets.length, transcript.segments.length);
  assert.match(report.evidencePackets[0].context, /does not establish a conclusion/i);
  assert.match(report.summary, /human interpretation/i);
});

test('generateMockReport does not invent a candidate signal without identified speakers', () => {
  const report = generateMockReport({ segments: [{ speaker: 'Speaker 1', start: 0, end: 1, text: 'Hello' }] });
  assert.deepEqual(report.signals, []);
});
