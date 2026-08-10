import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const SAMPLE_PATH = fileURLToPath(new URL('../../sample/team-sample.vtt', import.meta.url));

export function readSampleTranscript() {
  return fs.readFile(SAMPLE_PATH, 'utf8');
}

export async function fetchGraphTranscript(messageId) {
  const mockGraph = process.env.MOCK_GRAPH !== 'false';
  if (mockGraph) return readSampleTranscript();

  const token = process.env.GRAPH_ACCESS_TOKEN;
  if (!token) throw new Error('GRAPH_ACCESS_TOKEN is not configured on the server.');

  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/$value`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Microsoft Graph transcript fetch failed with status ${response.status}.`);
  return response.text();
}
