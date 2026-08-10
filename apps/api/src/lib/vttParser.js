export function parseVttToTranscript(vttText) {
  if (typeof vttText !== 'string' || !vttText.trim()) return { segments: [] };
  const lines = vttText.replace(/^\uFEFF/, '').split(/\r?\n/);
  const segments = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (!line.includes('-->')) {
      i++;
      continue;
    }

    const [rawStart, rawEndWithSettings] = line.split('-->').map((part) => part.trim());
    const rawEnd = rawEndWithSettings?.split(/\s+/)[0];
    const start = parseVttTimestamp(rawStart);
    const end = parseVttTimestamp(rawEnd);
    i++;

    const textLines = [];
    while (i < lines.length && lines[i].trim()) {
      textLines.push(lines[i].trim());
      i++;
    }
    if (start === null || end === null || end <= start) continue;

    const rawText = textLines.join(' ').trim();
    const voiceMatch = rawText.match(/^<v(?:\.[^\s>]+)*\s+([^>]+)>([\s\S]*)$/i);
    const withoutVoice = voiceMatch ? voiceMatch[2] : rawText;
    const speakerMatch = withoutVoice.match(/^([^:]{1,60}):\s*([\s\S]*)$/);
    const speaker = cleanVttText(voiceMatch?.[1] || speakerMatch?.[1] || 'Unknown');
    const text = cleanVttText(speakerMatch?.[2] ?? withoutVoice);
    if (text) segments.push({ speaker, start, end, text });
  }

  return { segments };
}

function parseVttTimestamp(ts) {
  if (typeof ts !== 'string' || !/^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}$/.test(ts)) return null;
  const parts = ts.split(':').map((p) => p.trim());
  const secondsPart = parts.pop().replace(',', '.');
  const seconds = Number(secondsPart);
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (minutes > 59 || seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanVttText(value) {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
