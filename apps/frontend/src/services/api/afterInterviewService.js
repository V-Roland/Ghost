import { apiRequest } from './apiClient.js';

export async function ingestTranscript({ mode = 'sample', vtt = '', graphMessageId = '' } = {}, request = apiRequest) {
  const payload = { mode };
  if (mode === 'vtt') payload.vtt = vtt;
  if (mode === 'graph') payload.graphMessageId = graphMessageId;
  return request('/api/after-interview/ingest', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
