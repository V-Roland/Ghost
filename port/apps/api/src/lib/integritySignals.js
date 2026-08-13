// Deterministic integrity signal engine.
//
// Implements the signal taxonomy declared in prompts/integrity-signal.prompt.md
// without an AI provider. Every value below is arithmetic over the transcript,
// so a reviewer can be shown exactly why a moment surfaced, and the same
// transcript always produces the same output.
//
// What this module does: surface moments a human should look at again, each
// attached to the quote and timestamp that produced it.
//
// What it does not do: reach a conclusion about misconduct, score a candidate,
// rank anyone, infer protected characteristics, or use face, voice or
// behavioural biometrics. Those boundaries are set in docs/GUARDRAILS.md.
//
// Every measurement is self-relative. A candidate is compared only against
// their own earlier answers in the same conversation, never against other
// candidates or an assumed norm. That is what keeps a naturally terse,
// accented, non-native or neurodivergent speaker from being flagged for
// speaking differently from someone else.

// Nothing statistical fires below this many candidate turns; a baseline built
// on less is noise, and a flag built on noise is unfair.
export const MIN_TURNS_FOR_BASELINE = 4;

// A pause must be long in absolute terms *and* unusual for this person.
const MIN_ABSOLUTE_LATENCY_SECONDS = 4;
const LATENCY_Z_REVIEW = 2;
const LATENCY_Z_ELEVATED = 3;

// Floor on the latency scale, so a candidate whose gaps are metronomically
// even does not have one thoughtful pause treated as extreme.
const MIN_LATENCY_SPREAD_SECONDS = 1.5;

// An answer needs room to echo a claim before absence of overlap means anything.
const MIN_WORDS_FOR_MISMATCH = 45;
const MISMATCH_COVERAGE_MAX = 0.12;

const FILLERS = [
  'um', 'uh', 'erm', 'hmm', 'like', 'you know', 'i mean', 'sort of', 'kind of',
  'basically', 'actually', 'right', 'so yeah', 'i guess'
];

const HEDGES = [
  'i think', 'probably', 'maybe', 'i believe', 'i would say', 'generally',
  'typically', 'usually', 'in general', 'it depends'
];

const TEXTBOOK_MARKERS = [
  'there are several', 'it is important to', 'in order to ensure', 'best practice',
  'key considerations', 'firstly', 'secondly', 'furthermore', 'moreover',
  'in conclusion', 'one common approach', 'the main advantage', 'trade-offs include'
];

const STOPWORDS = new Set([
  'their', 'which', 'would', 'about', 'these', 'there', 'where', 'that', 'this',
  'with', 'from', 'into', 'than', 'then', 'them', 'were', 'been', 'have', 'having',
  'after', 'before', 'other', 'using', 'used', 'over', 'most', 'some', 'such'
]);

const LEVEL_RANK = { Info: 0, Review: 1, Elevated: 2 };

const FILLER_PATTERN = phrasePattern(FILLERS);
const HEDGE_PATTERN = phrasePattern(HEDGES);
const TEXTBOOK_PATTERN = phrasePattern(TEXTBOOK_MARKERS);
const FIRST_PERSON_PATTERN = /(?<![a-z'])(?:i|i'\w+|my|we|we'\w+|our|us|me)(?![a-z'])/g;
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/**
 * Word-boundary matcher for a phrase list.
 * Substring counting would score 'consumer' as the filler 'um'.
 */
function phrasePattern(phrases) {
  const alternatives = [...phrases]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z'])(?:${alternatives.join('|')})(?![a-z'])`, 'g');
}

function tokens(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9'+#.-]+/g) || [];
}

/**
 * Crude prefix stemming so 'duplicate' and 'duplicates' count as a match.
 * Without it, a candidate who paraphrases their own portfolio instead of
 * quoting it looks like they avoided the question.
 */
function stems(text, prefix = 5) {
  const out = new Set();
  for (const token of tokens(text)) {
    if (token.length > 4 && !STOPWORDS.has(token)) out.add(token.slice(0, prefix));
  }
  return out;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function populationStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Median/MAD z-score, robust to the single odd turn that would skew a mean.
 *
 * `index` leaves the turn under test out of its own baseline - otherwise one
 * large outlier inflates the spread it is measured against and hides itself.
 * `minSpread` floors the scale so consistency alone cannot make small
 * deviations look extreme.
 */
export function robustZ(value, values, index = null, minSpread = 0) {
  const baseline = [...values];
  if (index !== null && index >= 0 && index < baseline.length && baseline.length > 2) {
    baseline.splice(index, 1);
  }
  if (baseline.length < 2) return 0;

  const centre = median(baseline);
  const mad = median(baseline.map((value_) => Math.abs(value_ - centre)));
  let scale = 1.4826 * mad;
  if (scale < 1e-6) scale = populationStdDev(baseline);
  scale = Math.max(scale, minSpread);
  if (scale < 1e-6) return 0;
  return (value - centre) / scale;
}

function meanSentenceLength(text) {
  const sentences = String(text || '').trim().split(SENTENCE_SPLIT).filter((s) => s.trim());
  if (sentences.length === 0) return 0;
  const total = sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).filter(Boolean).length, 0);
  return total / sentences.length;
}

function density(text, pattern) {
  const wordCount = Math.max(tokens(text).length, 1);
  // String.match with a global regex returns every match and does not consume
  // lastIndex, so these module-level patterns are safe to share.
  const matches = String(text || '').toLowerCase().match(pattern) || [];
  return (matches.length / wordCount) * 100;
}

/**
 * Proxy for 'this describes a real thing that happened': numbers and proper
 * nouns. Sentence-initial words are skipped, or every capitalised 'The' would
 * read as a named system.
 */
function concreteness(text) {
  const wordCount = tokens(text).length;
  if (wordCount === 0) return 0;
  const numbers = (String(text).match(/\b\d/g) || []).length;
  let named = 0;
  for (const sentence of String(text).trim().split(SENTENCE_SPLIT)) {
    const words = sentence.split(/\s+/).filter(Boolean).slice(1);
    named += words.filter((word) => /^[A-Z][a-zA-Z0-9]{2,}/.test(word)).length;
  }
  return ((numbers * 2 + named) / wordCount) * 100;
}

function formatTimecode(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Everything measured about one candidate turn. */
function measureTurn(turn, index) {
  const text = turn.text || '';
  return {
    turn,
    index,
    latency: turn.latency || 0,
    words: text.split(/\s+/).filter(Boolean).length,
    sentenceLength: meanSentenceLength(text),
    filler: density(text, FILLER_PATTERN),
    hedge: density(text, HEDGE_PATTERN),
    firstPerson: density(text, FIRST_PERSON_PATTERN),
    concreteness: concreteness(text),
    textbook: density(text, TEXTBOOK_PATTERN)
  };
}

/** Small samples never earn high confidence, however extreme the measurement. */
function capConfidence(value, sampleSize) {
  const ceiling = Math.min(0.9, 0.35 + 0.08 * sampleSize);
  return Math.round(Math.max(0.05, Math.min(value, ceiling)) * 100) / 100;
}

function buildSignal(metric, fields) {
  return {
    signalType: fields.signalType,
    level: fields.level,
    confidence: fields.confidence,
    label: fields.label,
    description: fields.description,
    rationale: fields.rationale,
    quote: String(metric.turn.text || '').slice(0, 280),
    timestamp: metric.turn.start,
    timecode: formatTimecode(metric.turn.start),
    turnIndex: metric.index,
    speaker: metric.turn.speaker,
    suggestedFollowUp: fields.suggestedFollowUp
  };
}

export function detectResponseLatency(metrics) {
  if (metrics.length < MIN_TURNS_FOR_BASELINE) return [];
  const latencies = metrics.map((metric) => metric.latency);
  const typical = Math.max(median(latencies), 0.1);
  const signals = [];

  metrics.forEach((metric, position) => {
    if (metric.latency < MIN_ABSOLUTE_LATENCY_SECONDS) return;
    const z = robustZ(metric.latency, latencies, position, MIN_LATENCY_SPREAD_SECONDS);
    if (z < LATENCY_Z_REVIEW) return;

    signals.push(buildSignal(metric, {
      signalType: 'ResponseLatency',
      level: z >= LATENCY_Z_ELEVATED ? 'Elevated' : 'Review',
      confidence: capConfidence(0.3 + 0.12 * z, metrics.length),
      label: 'Response latency flagged',
      description: `${metric.latency.toFixed(1)}s pause before answering, about ${(metric.latency / typical).toFixed(1)}x this candidate's usual gap.`,
      rationale: `This candidate's median response gap is ${typical.toFixed(1)}s and this answer began after ${metric.latency.toFixed(1)}s. Long pauses have many ordinary causes including thinking, connection lag, or re-reading a shared screen, so this points at a moment to re-read rather than establishing anything.`,
      suggestedFollowUp: 'Ask them to expand on this answer live, for example "can you sketch that out for me?". A held explanation survives the follow-up.'
    }));
  });

  return signals;
}

/**
 * A person's speaking style is stable within one conversation.
 *
 * Four independent indicators are counted; one alone is noise and a candidate
 * who is simply articulate will trip at most one. Two together is what makes a
 * moment worth a reviewer's time.
 */
export function detectRegisterShift(metrics) {
  if (metrics.length < MIN_TURNS_FOR_BASELINE) return [];
  const medianFiller = median(metrics.map((metric) => metric.filler));
  const medianPerson = median(metrics.map((metric) => metric.firstPerson));
  const sentenceLengths = metrics.map((metric) => metric.sentenceLength);
  const signals = [];

  metrics.forEach((metric, position) => {
    if (metric.words < 30) return; // too short to characterise a style

    const detail = [];
    if (medianFiller > 1 && metric.filler <= 0.25 * medianFiller) detail.push('disfluencies drop away');
    if (robustZ(metric.sentenceLength, sentenceLengths, position) >= 1.5) {
      detail.push(`${Math.round(metric.sentenceLength)}-word average sentences`);
    }
    if (metric.textbook > 0) detail.push('essay-style connectives');
    if (medianPerson > 1.5 && metric.firstPerson <= 0.4 * medianPerson) {
      detail.push('first-person ownership disappears');
    }
    if (detail.length < 2) return;

    signals.push(buildSignal(metric, {
      signalType: 'RegisterShift',
      level: detail.length >= 3 ? 'Elevated' : 'Review',
      confidence: capConfidence(0.2 + 0.13 * detail.length, metrics.length),
      label: 'Review recommended',
      description: `Speaking style changes sharply here (${detail.join(', ')}).`,
      rationale: 'Compared with this candidate\'s own earlier answers, this turn is markedly more written-sounding. People do become more fluent on topics they know well, so this is a prompt to probe the topic rather than evidence of anything.',
      suggestedFollowUp: 'Interrupt gently with a specific, personal probe, for example "which part of that did you build yourself?".'
    }));
  });

  return signals;
}

/** Generic answers are a question-quality problem as much as an integrity one. */
export function detectGenericAnswer(metrics) {
  const signals = [];

  for (const metric of metrics) {
    if (metric.words < 40) continue;
    const generic = metric.firstPerson < 1 && metric.concreteness < 2 && (metric.textbook > 0 || metric.hedge > 1.5);
    if (!generic) continue;

    signals.push(buildSignal(metric, {
      signalType: 'GenericAnswer',
      level: 'Info',
      confidence: capConfidence(0.45, metrics.length),
      label: 'Evidence missing',
      description: 'Answer describes the topic in general rather than the candidate\'s own work.',
      rationale: 'No first-person ownership, and no names, numbers or dates. That is the shape of a correct but anonymous answer. It is also what a nervous candidate produces under pressure, and the remedy is the same either way: ask what their specific involvement was.',
      suggestedFollowUp: 'Ask "what was your part of that, specifically - what did you write or decide?".'
    }));
  }

  return signals;
}

/** Did the answer engage with the claim the question was built from? */
export function detectPortfolioMismatch(metrics, questions) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const signals = [];

  for (const metric of metrics) {
    const question = byId.get(metric.turn.questionId);
    if (!question || !question.groundedIn) continue;

    const grounding = stems(question.groundedIn);
    if (grounding.size < 5) continue; // too few anchors for a ratio to mean anything
    if (metric.words < MIN_WORDS_FOR_MISMATCH) continue; // no room to echo the claim

    const answer = stems(metric.turn.text);
    let shared = 0;
    for (const stem of grounding) if (answer.has(stem)) shared += 1;
    const coverage = shared / grounding.size;
    if (coverage > MISMATCH_COVERAGE_MAX) continue;

    signals.push(buildSignal(metric, {
      signalType: 'PortfolioMismatch',
      level: 'Review',
      confidence: capConfidence(0.4 + (MISMATCH_COVERAGE_MAX - coverage), metrics.length),
      label: 'Portfolio claim needs follow-up',
      description: 'Answer does not engage with the portfolio claim behind the question.',
      rationale: `The question was grounded in: "${String(question.groundedIn).slice(0, 180)}". The answer shares almost none of that vocabulary. That can mean the claim was overstated, or simply that they answered a different reading of the question. Re-ask before drawing any conclusion.`,
      suggestedFollowUp: `Quote the portfolio back to them: "your CV says ${String(question.groundedIn).slice(0, 90)} - tell me about that part.".`
    }));
  }

  return signals;
}

/** Ownership language that flips between answers about the same work. */
export function detectInconsistentExplanation(metrics) {
  const soloClaims = new Map();
  const signals = [];
  const solo = ['i built', 'i wrote', 'i designed', 'i owned'];
  const team = ['the team built', 'we had a team', 'someone else', 'another team', 'i was not involved', 'i wasn\'t involved'];

  for (const metric of metrics) {
    const lowered = String(metric.turn.text || '').toLowerCase();
    const subjects = new Set();
    for (const match of lowered.matchAll(/\b(?:the|our|my)\s+([a-z]{4,}(?:\s+[a-z]{4,})?)/g)) {
      subjects.add(match[1]);
    }
    const saysSolo = solo.some((phrase) => lowered.includes(phrase));
    const saysTeam = team.some((phrase) => lowered.includes(phrase));

    for (const subject of subjects) {
      if (saysSolo && !soloClaims.has(subject)) {
        soloClaims.set(subject, metric);
        continue;
      }
      if (!saysTeam || !soloClaims.has(subject)) continue;

      const first = soloClaims.get(subject);
      signals.push(buildSignal(metric, {
        signalType: 'InconsistentExplanation',
        level: 'Review',
        confidence: capConfidence(0.4, metrics.length),
        label: 'Possible inconsistency',
        description: `Ownership of "${subject}" is described differently at ${formatTimecode(first.turn.start)} and ${formatTimecode(metric.turn.start)}.`,
        rationale: 'Earlier this was described as the candidate\'s own work; here it is attributed to others. People do clarify scope as a conversation goes on, so this is a prompt to establish who did what, not a contradiction to hold against them.',
        suggestedFollowUp: 'Ask "help me get the boundaries right - which pieces were yours and which were the team\'s?".'
      }));
      break;
    }
  }

  return signals;
}

/** One turn should not produce five near-identical cards in the UI. */
function dedupe(signals) {
  const best = new Map();
  for (const signal of signals) {
    const key = `${signal.turnIndex}:${signal.signalType}`;
    const current = best.get(key);
    if (!current || signal.confidence > current.confidence) best.set(key, signal);
  }
  return [...best.values()];
}

/** Most in need of a human first. */
export function rankSignals(signals) {
  return [...signals].sort((a, b) => {
    const byLevel = (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0);
    if (byLevel !== 0) return byLevel;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.turnIndex - b.turnIndex;
  });
}

/**
 * Run every detector over prepared turns.
 *
 * @param {Array<object>} turns output of prepareTurns()
 * @param {{questions?: Array<{id: string, groundedIn?: string}>}} options
 */
export function analyzeTranscript(turns, { questions = [] } = {}) {
  if (!Array.isArray(turns) || turns.length === 0) return [];
  const metrics = turns
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.role === 'candidate')
    .map(({ turn, index }) => measureTurn(turn, index));
  if (metrics.length === 0) return [];

  return rankSignals(dedupe([
    ...detectResponseLatency(metrics),
    ...detectRegisterShift(metrics),
    ...detectGenericAnswer(metrics),
    ...detectPortfolioMismatch(metrics, questions),
    ...detectInconsistentExplanation(metrics)
  ]));
}

/**
 * The candidate's own norms. Worth showing in the UI beside any signal so a
 * reviewer can judge whether the comparison is even meaningful yet.
 */
export function baselineSummary(turns) {
  const candidateTurns = (turns || []).filter((turn) => turn.role === 'candidate');
  if (candidateTurns.length === 0) return null;
  const metrics = candidateTurns.map((turn, index) => measureTurn(turn, index));
  const round = (value) => Math.round(value * 100) / 100;

  return {
    turns: metrics.length,
    medianLatencySeconds: round(median(metrics.map((m) => m.latency))),
    medianWords: round(median(metrics.map((m) => m.words))),
    medianSentenceLength: round(median(metrics.map((m) => m.sentenceLength))),
    medianFillerPer100Words: round(median(metrics.map((m) => m.filler))),
    baselineReliable: metrics.length >= MIN_TURNS_FOR_BASELINE
  };
}

/**
 * Adapt to the existing after-interview response contract
 * (docs/AFTER_INTERVIEW_REPORT_SCHEMA.md). `id`, `type` and `description`
 * keep their meaning; the extra fields are additive.
 */
export function toReportSignals(signals) {
  return signals.map((signal, index) => ({
    id: `s${index + 1}`,
    type: signal.signalType,
    description: signal.description,
    level: signal.level,
    label: signal.label,
    confidence: signal.confidence,
    rationale: signal.rationale,
    quote: signal.quote,
    timestamp: signal.timestamp,
    timecode: signal.timecode,
    speaker: signal.speaker,
    suggestedFollowUp: signal.suggestedFollowUp
  }));
}

/**
 * Adapt to public.integrity_signals rows. `level` matches the table's
 * check constraint ('Info' | 'Review' | 'Elevated'); `review_status` is left
 * at its 'Pending' default so a reviewer confirms or dismisses every signal.
 */
export function toIntegritySignalRows(signals, interviewId) {
  return signals.map((signal) => ({
    interview_id: interviewId,
    signal_type: signal.signalType.slice(0, 120),
    level: signal.level,
    evidence: {
      label: signal.label,
      description: signal.description,
      rationale: signal.rationale,
      quote: signal.quote,
      timestamp: signal.timestamp,
      timecode: signal.timecode,
      speaker: signal.speaker,
      confidence: signal.confidence,
      suggestedFollowUp: signal.suggestedFollowUp,
      method: 'deterministic-transcript-analysis'
    }
  }));
}
