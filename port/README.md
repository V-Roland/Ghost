# JS port of the integrity engine

A drop-in JavaScript implementation of the signal taxonomy declared in
`prompts/integrity-signal.prompt.md`, ported from the Python prototype on this
branch. No dependencies, no AI provider, no new runtime.

Paths here mirror `main` exactly, so integrating is a copy:

```bash
cp -r port/apps/. apps/
```

| File | Purpose |
|---|---|
| `apps/api/src/lib/transcriptTiming.js` | Cue merging, response latency, speaker roles, answer→question mapping |
| `apps/api/src/lib/integritySignals.js` | The five detectors, plus adapters for the API response and the `integrity_signals` table |
| `apps/api/test/integritySignals.test.js` | 22 tests in `node:test` style |

## Why this exists

`generateMockReport` currently emits two placeholder signals: percentage of
captioned speaking time, and a raw count of `um/uh/erm` across the transcript.
The prompt file specifies five signal types that nothing implements yet.

This closes that gap deterministically. Same transcript in, same signals out,
every time — and a reviewer can be shown the exact arithmetic behind any flag.
That matters more here than model quality: `ResponseLatency` is a measurement,
not a judgement, and a language model cannot reliably do timestamp arithmetic.

| Prompt spec | Implemented as |
|---|---|
| `ResponseLatency` | median/MAD z-score, leave-one-out, 4s absolute floor |
| `InconsistentExplanation` | ownership language that flips between answers |
| `GenericAnswer` | long answer, no first-person, no names or numbers |
| `PortfolioMismatch` | stemmed vocabulary overlap against the grounding claim |
| `MissingEvidence` | covered by `GenericAnswer` + unanswered-question packets |
| — | `RegisterShift` (new; four indicators, two required to fire) |

## Three changes needed on `main`

**1. Register the test file** — `test:api` enumerates files explicitly:

```diff
-"test:api": "node --test apps/api/test/afterInterview.test.js ... apps/api/test/vttParser.test.js"
+"test:api": "node --test apps/api/test/afterInterview.test.js ... apps/api/test/vttParser.test.js apps/api/test/integritySignals.test.js"
```

**2. Wire it into the report** — in `apps/api/src/lib/reportGenerator.js`:

```js
import { prepareTurns } from './transcriptTiming.js';
import { analyzeTranscript, toReportSignals, baselineSummary } from './integritySignals.js';

export function generateReviewReport(transcript, options = {}) {
  const { questions = [], interviewerNames = [], candidateNames = [] } = options;
  const turns = prepareTurns(transcript.segments, { questions, interviewerNames, candidateNames });
  const signals = analyzeTranscript(turns, { questions });

  const evidencePackets = signals.map((signal, index) => ({
    id: `e-${index + 1}`,
    quoteId: `q${index + 1}`,
    quote: signal.quote,
    speaker: signal.speaker,
    timestamp: signal.timestamp,
    context: signal.rationale
  }));

  return {
    reportId: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    summary: `Review packet generated from ${transcript.segments.length} transcript cues. ${signals.length} moment(s) surfaced for human review.`,
    signals: toReportSignals(signals),
    evidencePackets,
    baseline: baselineSummary(turns)
  };
}
```

The response shape is unchanged — `signals[]` still carries `id`, `type` and
`description`, so `afterInterview.test.js` and the frontend keep working. The
extra fields (`level`, `confidence`, `rationale`, `quote`, `timecode`,
`suggestedFollowUp`) are additive.

**3. Persist signals (optional)** — `toIntegritySignalRows(signals, interviewId)`
returns rows matching `public.integrity_signals`, with `level` constrained to
`Info | Review | Elevated` and `review_status` left at its `Pending` default so
a reviewer confirms or dismisses each one.

## Guardrail alignment

`docs/GUARDRAILS.md` is satisfied by construction:

- Signals are observations for review; nothing concludes misconduct or scores anyone
- Every signal carries its quote, timestamp, rationale and confidence
- `review_status` defaults to `Pending`, so a human must act on each one
- No face, voice, or behavioural biometrics — the input is transcript text and cue timings only
- No protected characteristic, emotion, health or personality inference

**Every measurement is self-relative.** A candidate is compared only against
their own earlier answers in the same conversation. Statistical detectors stay
silent below four candidate turns, and confidence is capped by sample size, so
a short interview can never produce a high-confidence signal.

One test asserts that no signal text can contain "cheat", "dishonest",
"guilty", "fraud", "lying", "liar" or "reject". Another asserts that ordinary
disfluent conversation produces **zero** signals — a detector that fires on
normal speech is worse than no detector.

## Verification

Node is not installed on the machine this was written on, so the suite was run
under JavaScriptCore with shims for `node:test` and `node:assert/strict`:
**22 passed, 0 failed**.

The engine was also cross-checked against the Python implementation on the same
transcript, through `main`'s own `parseVttToTranscript`. Output is identical —
same six signals, same timecodes, same confidences, same ordering:

```
05:28  Elevated  ResponseLatency          conf=0.90
05:28  Elevated  RegisterShift            conf=0.72
08:13  Elevated  RegisterShift            conf=0.59
08:13  Review    PortfolioMismatch        conf=0.43
07:13  Review    InconsistentExplanation  conf=0.40
08:13  Info      GenericAnswer            conf=0.45
```

**Please still run `npm run test:api` before merging.** JavaScriptCore is not
Node, and the guardrail and structure linters were only checked by hand.

## Two things found while reading `main`

**The filler-word signal has a fairness problem.** `reportGenerator.js` counts
`um/uh/erm` across the whole transcript with no per-speaker baseline, so a
naturally disfluent candidate accumulates a worse signal for speaking normally.
The `RegisterShift` detector measures the opposite and self-relatively —
disfluencies *vanishing* relative to that person's own norm — which is both
fairer and more informative.

**`fetchGraphTranscript` points at Outlook, not Teams.**
`graphClient.js` calls `/me/messages/{id}/$value`, which returns email MIME
content. Teams meeting transcripts are at
`/me/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content`. It is
mocked by default (`MOCK_GRAPH !== 'false'`) so it has not bitten yet, but it
will need changing before live Graph ingestion works.
