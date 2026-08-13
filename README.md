# Project Ghost

A Microsoft-native interview evidence copilot. Ghost prepares interviewers,
strengthens structured verification, and documents hiring decisions.

Built for LaunchPad Cohort 2 · Team Out Of Office · theme *Fix Microsoft + Invisible Work*.

---

## Run it

No dependencies, no build step, no API keys required.

```bash
python3 -m ghost.cli serve          # dashboard at http://127.0.0.1:8000
```

Click **Load sample interview** to see the whole pipeline end to end.

```bash
python3 -m ghost.cli demo                       # full sample report to stdout
python3 -m ghost.cli demo --json -o session.json

python3 -m ghost.cli prepare --portfolio cv.md --job jd.md
python3 -m ghost.cli review  --portfolio cv.md --job jd.md --transcript teams.vtt

python3 -m unittest discover -s tests           # 33 tests
```

Ghost runs its deterministic offline engine by default. Point it at Azure OpenAI
and the same code paths use GPT-4o instead:

```bash
export AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com"
export AZURE_OPENAI_API_KEY="<key>"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o"
```

The dashboard badge shows which engine is live, and every report records the
engine that produced it.

---

## The four stages

```
INPUT ──────────► GENERATE ──────────► INTERVIEW ──────────► REPORT
portfolio + JD    tailored questions    Teams transcript      evidence packets
                  grounded in claims    + response timing     + review signals
```

| Stage | Module | What it does |
|---|---|---|
| Input | [ingest.py](ghost/ingest.py) | Parses a portfolio into checkable claims and a JD into competencies, then pairs them |
| Generate | [questions.py](ghost/questions.py) | Builds an interview guide where every question quotes the claim it probes |
| Interview | [transcript.py](ghost/transcript.py) | Loads WebVTT (Teams/Graph) or JSON, derives response latency, maps answers to questions |
| Report | [integrity.py](ghost/integrity.py), [report.py](ghost/report.py) | Surfaces moments worth a human re-read, packaged as traceable evidence |

[pipeline.py](ghost/pipeline.py) wires the stages together as pure functions, which
is what lets each one move to its own Azure Function without changing callers.

---

## What Ghost will not do

This is the part the design is actually built around.

Ghost **does not** decide whether a candidate cheated. It does not produce a guilt
score, a probability of AI use, or a hiring recommendation. It does not use
biometrics, face tracking, or gaze estimation. It does not compare one candidate
against another.

It surfaces moments and hands them to a human with the quote and the timestamp
attached. Every signal ships with the ordinary explanations alongside the
concerning ones, because a long pause is usually just thinking.

**Every measurement is self-relative.** A candidate is only ever compared to their
own baseline earlier in the same conversation. A naturally terse speaker, a
non-native speaker, an accented speaker, or a neurodivergent speaker is never
measured against an assumed norm — that comparison is not made anywhere in the
codebase. Statistical detectors stay silent below four candidate turns
(`MIN_TURNS_FOR_BASELINE`), because a baseline built on less is noise, and a flag
built on noise is unfair.

`tests/test_ghost.py` asserts this directly: ordinary disfluent conversation
produces zero signals, short interviews produce no statistical signals, and no
signal text may contain the words "cheat", "dishonest", "fraud" or "guilty".

---

## The signals

| Signal | Fires when | Severity |
|---|---|---|
| `response_latency` | A pause is over 4s **and** far outside this candidate's own gap distribution | medium / high |
| `register_shift` | Two or more of: disfluencies vanish, sentences lengthen sharply, essay connectives appear, first-person ownership disappears | medium / high |
| `low_specificity` | A long answer with no first-person ownership, no names, no numbers | low |
| `portfolio_mismatch` | An answer shares almost no vocabulary with the claim the question was built from | medium |
| `ownership_inconsistency` | The same work is described as solo in one answer and the team's in another | medium |
| `transcript_review` | Azure OpenAI pass (when configured) finds a contradiction the heuristics missed | low / medium |

Each carries a confidence that is capped by sample size — a short interview can
never yield a high-confidence signal, no matter how extreme the measurement.

### Worked example

`python3 -m ghost.cli demo` runs a scripted interview with Priya Raman and
returns six signals:

- **05:28 · high** — 10.6s pause (7.6× her usual), immediately followed by a
  textbook-register answer about Cosmos DB partitioning
- **07:13 · medium** — asked which part she wrote herself, she attributes the
  work to the team, having claimed it at 00:49
- **08:13 · medium** — an on-call answer that never touches the runbook claim
  it was built from

Which is the useful shape of the output: not "she cheated", but *these three
moments are where your interview needs a second look, here are the timestamps.*

---

## Evidence packets

Every question produces a packet, whether or not it was asked:

```
question + competency
candidate answer
transcript quote + timestamp
follow-up question + answer
claim not evidenced by the answer
signals attached to this moment
interviewer disposition + rationale   ← the human fills this in, never Ghost
```

The dashboard records dispositions inline and exports the whole report as
Markdown for an ATS or a hiring channel. Coverage is reported too: which
competencies got evidence, which got one answer, and which were planned but
never asked — the prep-quality half of the report.

---

## Moving onto Azure

The prototype is stdlib-only so it runs anywhere, but the seams are cut for the
slide 06 architecture:

| Prototype | Azure |
|---|---|
| [llm.py](ghost/llm.py) urllib calls | `openai.AzureOpenAI` with managed identity |
| [server.py](ghost/server.py) routes | Azure Functions (`/api/prepare`, `/api/review`) |
| In-process session | Cosmos DB — profiles, guides, packets, reports |
| Pasted VTT | Microsoft Graph `/onlineMeetings/{id}/transcripts/{id}/content` |
| [web/](ghost/web/) vanilla JS | React dashboard, same JSON contract |
| `SKILL_VOCABULARY` in code | Cosmos DB skill taxonomy, editable without a deploy |

The JSON returned by `/api/prepare` and `/api/review` is the contract. A React
front end can be dropped in against the same shapes without touching the engine.

---

## Layout

```
ghost/
  models.py      dataclasses shared by every stage
  config.py      Azure config + engine selection
  llm.py         Azure OpenAI client, stdlib only
  ingest.py      portfolio + JD parsing
  questions.py   question generation engine
  transcript.py  WebVTT / JSON loading, latency, question mapping
  integrity.py   the detectors
  report.py      evidence packets, coverage, Markdown export
  pipeline.py    the four stages wired together
  server.py      local HTTP API + static host
  cli.py         prepare / review / demo / serve
  web/           interviewer dashboard
data/samples/    Priya Raman portfolio, JD, and Teams transcript
tests/           33 tests
```

Requires Python 3.9+.
