import express from 'express';
import { HttpError } from '../lib/httpError.js';
import { parseVttToTranscript } from '../lib/vttParser.js';
import { generateMockReport } from '../lib/reportGenerator.js';
import { fetchGraphTranscript, readSampleTranscript } from '../services/graphClient.js';

export const afterInterviewRouter = express.Router();

const allowedFields = new Set(['mode', 'vtt', 'graphMessageId']);
const graphMessageIdPattern = /^[A-Za-z0-9._=-]{1,512}$/;

export function normalizeAfterInterviewRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_REPORT_REQUEST', 'Provide a valid report request.');
  }
  const unknownField = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unknownField) {
    throw new HttpError(400, 'INVALID_REPORT_REQUEST', `Unsupported report field: ${unknownField}.`);
  }

  const mode = body.mode || 'sample';
  if (!['sample', 'vtt', 'graph'].includes(mode)) {
    throw new HttpError(400, 'INVALID_REPORT_MODE', 'Choose sample, VTT, or Microsoft Graph transcript input.');
  }
  if (mode === 'vtt') {
    if (typeof body.vtt !== 'string' || !body.vtt.trim()) {
      throw new HttpError(400, 'VTT_REQUIRED', 'Paste a non-empty WebVTT transcript.');
    }
    if (Buffer.byteLength(body.vtt, 'utf8') > 200_000) {
      throw new HttpError(413, 'VTT_TOO_LARGE', 'The transcript must be 200 KB or smaller.');
    }
    return { mode, vtt: body.vtt };
  }
  if (mode === 'graph') {
    if (typeof body.graphMessageId !== 'string' || !graphMessageIdPattern.test(body.graphMessageId)) {
      throw new HttpError(400, 'GRAPH_MESSAGE_ID_REQUIRED', 'Provide a valid Microsoft Graph message ID.');
    }
    return { mode, graphMessageId: body.graphMessageId };
  }
  return { mode };
}

afterInterviewRouter.post('/ingest', async (req, res, next) => {
  try {
    const input = normalizeAfterInterviewRequest(req.body);
    const rawVtt = input.mode === 'graph'
      ? await fetchGraphTranscript(input.graphMessageId)
      : input.mode === 'vtt'
        ? input.vtt
        : await readSampleTranscript();

    const transcript = parseVttToTranscript(rawVtt);
    if (transcript.segments.length === 0) {
      return next(new HttpError(422, 'TRANSCRIPT_EMPTY', 'No valid transcript cues were found in the WebVTT content.'));
    }
    const report = generateMockReport(transcript);

    return res.json({ source: input.mode, transcript, report });
  } catch (error) {
    return next(error);
  }
});
