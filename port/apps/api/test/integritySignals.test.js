import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeAdjacentSegments,
  withResponseLatency,
  attachQuestions,
  prepareTurns
} from '../src/lib/transcriptTiming.js';
import {
  analyzeTranscript,
  baselineSummary,
  detectPortfolioMismatch,
  robustZ,
  toIntegritySignalRows,
  toReportSignals,
  MIN_TURNS_FOR_BASELINE
} from '../src/lib/integritySignals.js';

// A detector that fires on ordinary human speech is worse than no detector,
// so several of these assert that nothing is flagged.

const ORDINARY_ANSWERS = [
  'Yeah so, um, we ran it as a nightly job at first and it kept falling over on the big customers. I ended up splitting it per tenant, which was, uh, not elegant but it held.',
  'I think the main thing was, like, we did not have replay. So when it broke you just lost the window. I put a queue in front of it so we could re-read.',
  'Um, honestly the first version was too clever. I wrote a bloom filter and it missed duplicates that came in weeks apart, so we, you know, went simpler.',
  'So the trade-off was blast radius against duplication. We picked blast radius, and, uh, I would do it again but generate the config instead.',
  'That one I owned end to end. I did the schema, the consumer, and most of the tests. One of the platform folks did the infrastructure side of it.',
  'Right, so the dashboard was taking like eight seconds. I pre-aggregated the series and it went under a second, which people noticed straight away.'
];

function conversation(count = 6) {
  const segments = [];
  let clock = 0;
  for (let i = 0; i < count; i += 1) {
    segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'Tell me about that piece of work?', start: clock, end: clock + 8 });
    clock += 9.2;
    segments.push({ speaker: 'Candidate', role: 'candidate', text: ORDINARY_ANSWERS[i % ORDINARY_ANSWERS.length], start: clock, end: clock + 40 });
    clock += 42;
  }
  return withResponseLatency(segments);
}

test('mergeAdjacentSegments stitches same-speaker cues back into one utterance', () => {
  const merged = mergeAdjacentSegments([
    { speaker: 'Candidate', text: 'So the first thing', start: 0, end: 3 },
    { speaker: 'Candidate', text: 'we did was add a queue.', start: 3.4, end: 7 },
    { speaker: 'Interviewer', text: 'Why a queue?', start: 8, end: 10 }
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].text, 'So the first thing we did was add a queue.');
  assert.equal(merged[0].end, 7);
});

test('mergeAdjacentSegments keeps cues separated by a long gap apart', () => {
  const merged = mergeAdjacentSegments([
    { speaker: 'Candidate', text: 'First point.', start: 0, end: 3 },
    { speaker: 'Candidate', text: 'Much later point.', start: 30, end: 34 }
  ]);
  assert.equal(merged.length, 2);
});

test('withResponseLatency derives the gap between speakers', () => {
  const timed = withResponseLatency([
    { speaker: 'Interviewer', text: 'Question?', start: 0, end: 5 },
    { speaker: 'Candidate', text: 'Answer.', start: 6.5, end: 20 }
  ]);
  assert.equal(timed[0].latency, 0);
  assert.equal(timed[1].latency, 1.5);
});

test('overlapping speech is not counted as a pause', () => {
  const timed = withResponseLatency([
    { speaker: 'Interviewer', text: 'So what happened?', start: 0, end: 10 },
    { speaker: 'Candidate', text: 'Sorry, jumping in there.', start: 8, end: 20 }
  ]);
  assert.equal(timed[1].latency, 0);
});

test('attachQuestions files an answer under the question that prompted it', () => {
  const questions = [{ id: 'q1', prompt: 'Tell me about the ingestion pipeline you rebuilt' }];
  const turns = attachQuestions([
    { role: 'interviewer', text: 'Tell me about the ingestion pipeline you rebuilt?' },
    { role: 'candidate', text: 'Sure, I rebuilt it over about four months.' }
  ], questions);
  assert.equal(turns[1].questionId, 'q1');
});

test('a closing question does not inherit the previous question id', () => {
  const questions = [{ id: 'q1', prompt: 'Tell me about the ingestion pipeline you rebuilt' }];
  const turns = attachQuestions([
    { role: 'interviewer', text: 'Tell me about the ingestion pipeline you rebuilt?' },
    { role: 'candidate', text: 'Sure, I rebuilt it over four months.' },
    { role: 'interviewer', text: 'Anything you want to ask me before we wrap?' },
    { role: 'candidate', text: 'What does on-call look like?' }
  ], questions);
  assert.equal(turns[1].questionId, 'q1');
  assert.equal(turns[3].questionId, null);
});

test('framing without a question mark does not start a question', () => {
  const questions = [{ id: 'q1', prompt: 'What is the most recent thing you built with monitoring?' }];
  const turns = attachQuestions([
    { role: 'interviewer', text: 'I want to spend the time on things you built recently, from your portfolio, especially monitoring.' },
    { role: 'candidate', text: 'Sounds good.' }
  ], questions);
  // Candidate turns always carry the field; null means "not attributed".
  assert.equal(turns[1].questionId, null);
});

test('ordinary disfluent conversation produces no signals', () => {
  const signals = analyzeTranscript(conversation());
  assert.deepEqual(signals.map((s) => s.signalType), [],
    `detectors fired on ordinary speech: ${signals.map((s) => s.signalType).join(', ')}`);
});

test('a short interview produces no statistical signals', () => {
  const turns = withResponseLatency([
    { speaker: 'Interviewer', role: 'interviewer', text: 'Tell me about it?', start: 0, end: 5 },
    { speaker: 'Candidate', role: 'candidate', text: 'Sure, um, I built the thing.', start: 6, end: 20 },
    { speaker: 'Interviewer', role: 'interviewer', text: 'And then?', start: 21, end: 25 },
    { speaker: 'Candidate', role: 'candidate', text: 'Then we shipped it, yeah.', start: 55, end: 70 }
  ]);
  const signals = analyzeTranscript(turns);
  assert.equal(signals.filter((s) => s.signalType === 'ResponseLatency').length, 0);
});

test('a long pause is flagged relative to this candidate', () => {
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'One more question?', start: 600, end: 610 });
  segments.push({
    speaker: 'Candidate',
    role: 'candidate',
    text: 'Um, so, the answer there is that we sharded it by tenant and it worked out fine in the end I think.',
    start: 625,
    end: 660
  });
  const signals = analyzeTranscript(withResponseLatency(segments));
  const latency = signals.filter((s) => s.signalType === 'ResponseLatency');
  assert.equal(latency.length, 1);
  assert.equal(latency[0].level, 'Elevated');
});

test('a pause must be long in absolute terms, not only unusual', () => {
  // A crisp speaker whose gaps are 0.2s must not be flagged for a 2s pause.
  const segments = [];
  let clock = 0;
  for (let i = 0; i < 6; i += 1) {
    segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'Next question?', start: clock, end: clock + 5 });
    clock += 5 + (i === 5 ? 2 : 0.2);
    segments.push({ speaker: 'Candidate', role: 'candidate', text: `Short answer number ${i}.`, start: clock, end: clock + 10 });
    clock += 10;
  }
  const signals = analyzeTranscript(withResponseLatency(segments));
  assert.equal(signals.filter((s) => s.signalType === 'ResponseLatency').length, 0);
});

test('a textbook register shift is flagged', () => {
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'How would you approach partitioning?', start: 600, end: 610 });
  segments.push({
    speaker: 'Candidate',
    role: 'candidate',
    text: 'There are several considerations when designing a partitioning strategy. The primary objective is to select a partition key that distributes both storage and request volume evenly across logical partitions, thereby avoiding hot partitions. It is important to consider the logical partition limit, as an unbounded key will eventually result in write failures.',
    start: 612,
    end: 700
  });
  const signals = analyzeTranscript(withResponseLatency(segments));
  const shifts = signals.filter((s) => s.signalType === 'RegisterShift');
  assert.equal(shifts.length, 1);
});

test('filler words are matched on word boundaries', () => {
  // 'consumer' contains 'um'; substring counting made textbook prose look
  // disfluent and suppressed the register-shift signal entirely.
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'What degrades first?', start: 600, end: 610 });
  segments.push({
    speaker: 'Candidate',
    role: 'candidate',
    text: 'The consumer assumed the volume would resume. Firstly the consumer lag grows, and it is important to ensure back-pressure is applied upstream so that memory does not grow without bound across the consumer group.',
    start: 612,
    end: 700
  });
  const signals = analyzeTranscript(withResponseLatency(segments));
  assert.ok(signals.some((s) => s.signalType === 'RegisterShift'),
    'a filler-free textbook answer should still register as a style shift');
});

test('paraphrasing a portfolio claim is not a mismatch', () => {
  const question = {
    id: 'q1',
    prompt: 'Tell me about the deduplication service?',
    groundedIn: 'Wrote the deduplication service in Go that removed roughly 8% duplicate records from the warehouse feed'
  };
  const turns = withResponseLatency([
    { speaker: 'Interviewer', role: 'interviewer', text: 'Tell me about the deduplication service?', start: 0, end: 5 },
    {
      speaker: 'Candidate',
      role: 'candidate',
      questionId: 'q1',
      text: 'The dedup service, yeah. It removes duplicates from the warehouse records before they land. The first version was a bloom filter, which missed duplicates arriving weeks apart, so I moved it to a keyed store with a ninety day window instead.',
      start: 6,
      end: 60
    }
  ]);
  const signals = analyzeTranscript(turns, { questions: [question] });
  assert.equal(signals.filter((s) => s.signalType === 'PortfolioMismatch').length, 0);
});

test('an answer that avoids the claim is flagged as a mismatch', () => {
  const question = {
    id: 'q1',
    prompt: 'Tell me about the on-call runbook?',
    groundedIn: 'Own the on-call runbook for the tracking platform; reduced page volume by 60% by fixing the three alerts that produced most noise'
  };
  const metrics = [{
    turn: {
      questionId: 'q1',
      start: 0,
      text: 'There are a few standard failure modes to think about at that kind of scale. Typically the first thing to degrade is queue consumer lag, because consumers scale more slowly than producers do. It is important to ensure back-pressure is applied upstream rather than allowing memory to grow without bound.'
    },
    index: 0,
    words: 50
  }];
  const found = detectPortfolioMismatch(metrics, [question]);
  assert.equal(found.length, 1);
  assert.equal(found[0].signalType, 'PortfolioMismatch');
});

test('an ownership flip between answers is flagged', () => {
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'Who built that?', start: 600, end: 605 });
  segments.push({ speaker: 'Candidate', role: 'candidate', text: 'I built the ingestion pipeline myself over about four months.', start: 606, end: 640 });
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'And the partitioning?', start: 641, end: 645 });
  segments.push({ speaker: 'Candidate', role: 'candidate', text: 'Honestly the team built the ingestion pipeline before I joined, so I inherited most of it.', start: 646, end: 680 });
  const signals = analyzeTranscript(withResponseLatency(segments));
  assert.equal(signals.filter((s) => s.signalType === 'InconsistentExplanation').length, 1);
});

test('robustZ leaves the value under test out of its own baseline', () => {
  const values = [1, 1, 1, 1, 20];
  assert.ok(robustZ(20, values, 4, 1) > robustZ(20, values, null, 1));
});

test('baseline reports whether it is reliable yet', () => {
  assert.equal(baselineSummary(conversation(2)).baselineReliable, false);
  assert.equal(baselineSummary(conversation(6)).baselineReliable, true);
  assert.ok(MIN_TURNS_FOR_BASELINE >= 4);
});

test('no signal states a conclusion about misconduct', () => {
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'One more question?', start: 600, end: 610 });
  segments.push({
    speaker: 'Candidate',
    role: 'candidate',
    text: 'There are several considerations here. It is important to ensure that the partition key distributes storage and request volume evenly across all logical partitions in the account.',
    start: 625,
    end: 700
  });
  const signals = analyzeTranscript(withResponseLatency(segments));
  assert.ok(signals.length > 0, 'expected at least one signal to inspect');
  const banned = ['cheat', 'dishonest', 'guilty', 'fraud', 'lying', 'liar', 'reject'];
  for (const signal of signals) {
    const blob = `${signal.label} ${signal.description} ${signal.rationale} ${signal.suggestedFollowUp}`.toLowerCase();
    for (const word of banned) {
      assert.ok(!blob.includes(word), `signal ${signal.signalType} used the word "${word}"`);
    }
  }
});

test('report signals keep the existing response contract', () => {
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'One more?', start: 600, end: 610 });
  segments.push({ speaker: 'Candidate', role: 'candidate', text: 'Um, so, we sharded it by tenant and it worked out fine in the end I think, yeah.', start: 625, end: 660 });
  const signals = analyzeTranscript(withResponseLatency(segments));
  const reportSignals = toReportSignals(signals);
  assert.ok(reportSignals.length > 0);
  for (const signal of reportSignals) {
    assert.equal(typeof signal.id, 'string');
    assert.equal(typeof signal.type, 'string');
    assert.equal(typeof signal.description, 'string');
  }
});

test('integrity signal rows satisfy the level check constraint', () => {
  const segments = conversation();
  segments.push({ speaker: 'Interviewer', role: 'interviewer', text: 'One more?', start: 600, end: 610 });
  segments.push({ speaker: 'Candidate', role: 'candidate', text: 'Um, so, we sharded it by tenant and it worked out fine in the end I think, yeah.', start: 625, end: 660 });
  const signals = analyzeTranscript(withResponseLatency(segments));
  const rows = toIntegritySignalRows(signals, '00000000-0000-0000-0000-000000000000');
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(['Info', 'Review', 'Elevated'].includes(row.level));
    assert.ok(row.signal_type.length >= 1 && row.signal_type.length <= 120);
    assert.equal(typeof row.evidence, 'object');
    assert.equal(row.evidence.method, 'deterministic-transcript-analysis');
  }
});

test('prepareTurns runs cues through merge, roles, latency and question mapping', () => {
  const turns = prepareTurns([
    { speaker: 'Marcus Webb (Hiring Manager)', text: 'Tell me about the pipeline you rebuilt?', start: 0, end: 8 },
    { speaker: 'Priya Raman', text: 'Sure, so I rebuilt it', start: 9.5, end: 12 },
    { speaker: 'Priya Raman', text: 'over about four months.', start: 12.4, end: 20 }
  ], { questions: [{ id: 'q1', prompt: 'Tell me about the pipeline you rebuilt' }] });

  assert.equal(turns.length, 2);
  assert.equal(turns[0].role, 'interviewer');
  assert.equal(turns[1].role, 'candidate');
  assert.equal(turns[1].text, 'Sure, so I rebuilt it over about four months.');
  assert.equal(turns[1].latency, 1.5);
  assert.equal(turns[1].questionId, 'q1');
});
