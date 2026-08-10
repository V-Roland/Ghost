import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVttToTranscript } from '../src/lib/vttParser.js';

test('parseVttToTranscript parses sample VTT into segments', () => {
  const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nInterviewer: Hello\n\n00:00:02.500 --> 00:00:05.000\nCandidate: Hi there`;
  const result = parseVttToTranscript(vtt);
  assert.ok(result && Array.isArray(result.segments));
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[0].speaker, 'Interviewer');
  assert.equal(result.segments[1].speaker, 'Candidate');
});

test('parseVttToTranscript handles cue identifiers, settings, voice tags, and multiline text', () => {
  const vtt = `WEBVTT\n\ncue-1\n00:01.000 --> 00:04.500 align:start\n<v Candidate>First line\nsecond &amp; final line</v>`;
  const result = parseVttToTranscript(vtt);
  assert.deepEqual(result.segments, [{
    speaker: 'Candidate',
    start: 1,
    end: 4.5,
    text: 'First line second & final line'
  }]);
});

test('parseVttToTranscript skips malformed and reversed cues', () => {
  const vtt = `WEBVTT\n\nnot-a-time --> 00:02.000\nBad cue\n\n00:05.000 --> 00:03.000\nReversed cue`;
  assert.deepEqual(parseVttToTranscript(vtt), { segments: [] });
});
