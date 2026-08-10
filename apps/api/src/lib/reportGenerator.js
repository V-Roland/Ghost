export function generateMockReport(transcript) {
  const now = new Date().toISOString();
  const quotes = transcript.segments.slice(0, 6).map((s, idx) => ({
    id: `q${idx + 1}`,
    speaker: s.speaker,
    start: s.start,
    end: s.end,
    text: s.text
  }));

  const speakerDurations = new Map();
  for (const segment of transcript.segments) {
    const duration = Math.max(0, segment.end - segment.start);
    speakerDurations.set(segment.speaker, (speakerDurations.get(segment.speaker) || 0) + duration);
  }
  const totalCaptionedSeconds = [...speakerDurations.values()].reduce((sum, duration) => sum + duration, 0);
  const candidate = [...speakerDurations].find(([speaker]) => /candidate/i.test(speaker));
  const interviewer = [...speakerDurations].find(([speaker]) => /interviewer/i.test(speaker));
  const signals = [];

  if (candidate && interviewer && totalCaptionedSeconds > 0) {
    const candidateShare = Math.round((candidate[1] / totalCaptionedSeconds) * 100);
    signals.push({
      id: 's1',
      type: 'captioned-participation-context',
      description: `Candidate-captioned cues account for approximately ${candidateShare}% of captioned speaking time. This is context for human review, not an assessment.`
    });
  }

  const fillerCount = transcript.segments.reduce((count, segment) => {
    return count + (segment.text.match(/\b(?:um|uh|erm)\b/gi)?.length || 0);
  }, 0);
  if (fillerCount >= 3) {
    signals.push({
      id: `s${signals.length + 1}`,
      type: 'transcript-verbal-pattern',
      description: `${fillerCount} filler-word occurrences appear in the transcript. Review the original context before drawing any conclusion.`
    });
  }

  const evidencePackets = quotes.map((q) => ({
    id: `e-${q.id}`,
    quoteId: q.id,
    quote: q.text,
    speaker: q.speaker,
    timestamp: q.start,
    context: 'Transcript excerpt retained for human review; it does not establish a conclusion.'
  }));

  const finalEnd = transcript.segments.reduce((latest, segment) => Math.max(latest, segment.end), 0);

  return {
    reportId: `mock-${Date.now()}`,
    generatedAt: now,
    summary: `Review packet generated from ${transcript.segments.length} transcript cues spanning approximately ${Math.round(finalEnd)} seconds. All signals require human interpretation.`,
    signals,
    evidencePackets
  };
}
