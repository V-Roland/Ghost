// Timing and role derivation for parsed transcripts.
//
// parseVttToTranscript already returns { speaker, start, end, text } per cue.
// Two things are missing before integrity analysis is possible:
//
//   1. Teams emits a cue every few seconds, so one spoken answer arrives as
//      several fragments. They have to be stitched back into utterances or
//      every per-answer measurement is measuring a fragment.
//   2. Response latency - the gap between the end of the previous speaker and
//      the start of this turn - is derivable from start/end but never computed.
//      It is the highest-value signal in the product spec.

const INTERVIEWER_HINTS = ['interviewer', 'hiring', 'manager', 'recruiter', 'host', 'panel'];

const DEFAULT_MERGE_GAP_SECONDS = 1.5;

/**
 * Stitch consecutive cues from the same speaker back into one utterance.
 * @param {Array<{speaker: string, start: number, end: number, text: string}>} segments
 * @param {number} maxGapSeconds
 */
export function mergeAdjacentSegments(segments, maxGapSeconds = DEFAULT_MERGE_GAP_SECONDS) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  const ordered = [...segments].sort((a, b) => a.start - b.start);
  const merged = [];

  for (const segment of ordered) {
    const previous = merged[merged.length - 1];
    if (previous && previous.speaker === segment.speaker && segment.start - previous.end <= maxGapSeconds) {
      previous.text = `${previous.text} ${segment.text}`.trim();
      previous.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }

  return merged;
}

/**
 * Label each segment 'interviewer' or 'candidate'.
 * Explicit names win; otherwise fall back to naming hints.
 */
export function assignSpeakerRoles(segments, { interviewerNames = [], candidateNames = [] } = {}) {
  const interviewers = interviewerNames.filter(Boolean).map((name) => name.toLowerCase());
  const candidates = candidateNames.filter(Boolean).map((name) => name.toLowerCase());

  return segments.map((segment) => {
    const speaker = String(segment.speaker || '').toLowerCase();
    let role = 'candidate';
    if (candidates.some((name) => speaker.includes(name))) role = 'candidate';
    else if (interviewers.some((name) => speaker.includes(name))) role = 'interviewer';
    else if (INTERVIEWER_HINTS.some((hint) => speaker.includes(hint))) role = 'interviewer';
    return { ...segment, role };
  });
}

/**
 * Add `latency` to each segment: seconds between the previous speaker
 * finishing and this turn starting.
 *
 * Overlapping speech clamps to zero - an interruption is not a hesitation,
 * and a negative gap would otherwise drag a candidate's baseline downward.
 */
export function withResponseLatency(segments) {
  return segments.map((segment, index) => {
    if (index === 0) return { ...segment, latency: 0 };
    const gap = segment.start - segments[index - 1].end;
    return { ...segment, latency: Math.max(0, Math.round(gap * 100) / 100) };
  });
}

/**
 * Map each candidate answer to the question that prompted it.
 *
 * Matching is deterministic lexical overlap against the preceding interviewer
 * turn, which keeps the evidence chain auditable - a reviewer can see exactly
 * why an answer is filed under a question.
 *
 * @param {Array<object>} segments segments carrying `role`
 * @param {Array<{id: string, prompt: string}>} questions
 */
export function attachQuestions(segments, questions, threshold = 0.35) {
  if (!Array.isArray(questions) || questions.length === 0) return segments.map((s) => ({ ...s }));

  const closingCues = [
    'anything you want to ask', 'any questions for', 'before we wrap',
    'before we finish', 'thanks for your time', 'we are out of time'
  ];
  const indexed = questions.map((question) => ({ id: question.id, tokens: significantTokens(question.prompt) }));

  let currentId = null;
  return segments.map((segment) => {
    if (segment.role === 'interviewer') {
      const lowered = String(segment.text || '').toLowerCase();
      if (closingCues.some((cue) => lowered.includes(cue))) {
        currentId = null;
        return { ...segment };
      }
      // Framing and small talk are not the asking of a question.
      if (!lowered.includes('?')) return { ...segment };

      const asked = significantTokens(segment.text);
      let bestScore = 0;
      let bestId = null;
      for (const question of indexed) {
        if (question.tokens.size === 0) continue;
        let shared = 0;
        for (const token of question.tokens) if (asked.has(token)) shared += 1;
        const score = shared / question.tokens.size;
        if (score > bestScore) {
          bestScore = score;
          bestId = question.id;
        }
      }
      // An unmatched interviewer turn is usually a follow-up probe on the
      // current question, so the existing pointer is kept rather than cleared.
      if (bestScore >= threshold) currentId = bestId;
      return { ...segment };
    }

    if (segment.role === 'candidate') return { ...segment, questionId: currentId };
    return { ...segment };
  });
}

function significantTokens(text) {
  const matches = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  return new Set(matches.filter((token) => token.length > 3));
}

/**
 * Convenience wrapper: cues in, analysis-ready turns out.
 */
export function prepareTurns(segments, options = {}) {
  const merged = mergeAdjacentSegments(segments, options.maxGapSeconds);
  const roled = assignSpeakerRoles(merged, options);
  const timed = withResponseLatency(roled);
  return attachQuestions(timed, options.questions || []);
}
