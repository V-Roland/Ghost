"""Integrity signal engine.

What this module does: surfaces moments in an interview that a human
should look at again, each attached to the exact quote and timestamp that
produced it.

What this module deliberately does not do:
  - decide whether a candidate cheated
  - produce a guilt score, a probability of cheating, or a hire signal
  - use biometrics, face tracking, or gaze estimation
  - compare a candidate against other candidates

Every measurement is *self-relative*: a candidate is only ever compared to
their own baseline earlier in the same conversation. That is what keeps a
naturally terse, accented, non-native, or neurodivergent speaker from
being flagged for speaking differently from some assumed norm.
"""

import json
import re
import statistics
from typing import Dict, List, Optional, Sequence, Tuple

from .config import azure_configured
from .llm import try_chat_json
from .models import CandidateProfile, IntegritySignal, Question, TranscriptTurn, rank_severity

# Nothing statistical fires until we have this many candidate turns; before
# that a "baseline" is noise and any flag would be unfair.
MIN_TURNS_FOR_BASELINE = 4

# A pause has to be long in absolute terms *and* unusual for this person.
MIN_ABSOLUTE_LATENCY_S = 4.0
LATENCY_Z_MEDIUM = 2.0
LATENCY_Z_HIGH = 3.0
# Floor on the latency scale: a candidate whose gaps are metronomically even
# should not have a single thoughtful pause treated as extreme.
MIN_LATENCY_SPREAD_S = 1.5

# An answer must have room to echo the claim before we call it a mismatch,
# and must share almost none of its vocabulary.
MIN_WORDS_FOR_MISMATCH = 45
MISMATCH_COVERAGE_MAX = 0.12

_FILLERS = (
    "um", "uh", "erm", "hmm", "like", "you know", "i mean", "sort of", "kind of",
    "basically", "actually", "right", "so yeah", "i guess",
)
_HEDGES = (
    "i think", "probably", "maybe", "i believe", "i would say", "generally",
    "typically", "usually", "in general", "it depends",
)
_TEXTBOOK_MARKERS = (
    "there are several", "it is important to", "in order to ensure", "best practice",
    "key considerations", "firstly", "secondly", "furthermore", "moreover",
    "in conclusion", "one common approach", "the main advantage", "trade-offs include",
)
_NUMBER = re.compile(r"\b\d")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


_STOPWORDS = frozenset((
    "their", "which", "would", "about", "these", "there", "where", "that", "this",
    "with", "from", "into", "than", "then", "them", "were", "been", "have", "having",
    "after", "before", "other", "using", "used", "over", "most", "some", "such",
))


def _tokens(text: str) -> List[str]:
    return re.findall(r"[a-z0-9'+#.-]+", text.lower())


def _stems(text: str, prefix: int = 5) -> set:
    """Crude prefix stemming so 'duplicate' and 'duplicates' count as a match.

    Without this, a candidate who paraphrases their own CV instead of quoting
    it gets flagged - which is the opposite of what we want.
    """
    return {
        t[:prefix] for t in _tokens(text)
        if len(t) > 4 and t not in _STOPWORDS
    }


def _robust_z(
    value: float, values: Sequence[float], index: Optional[int] = None, min_spread: float = 0.0
) -> float:
    """Median/MAD z-score, robust to the one weird turn that would skew a mean.

    Pass `index` to leave the turn under test out of its own baseline -
    otherwise a single large outlier inflates the spread it is measured
    against and hides itself. `min_spread` floors the scale so a candidate
    who is merely consistent does not make every small deviation extreme.
    """
    baseline = list(values)
    if index is not None and 0 <= index < len(baseline) and len(baseline) > 2:
        baseline.pop(index)
    if len(baseline) < 2:
        return 0.0

    median = statistics.median(baseline)
    mad = statistics.median([abs(v - median) for v in baseline])
    scale = 1.4826 * mad
    if scale < 1e-6:
        scale = statistics.pstdev(baseline)
    scale = max(scale, min_spread)
    if scale < 1e-6:
        return 0.0
    return (value - median) / scale


def _mean_sentence_length(text: str) -> float:
    sentences = [s for s in _SENTENCE_SPLIT.split(text.strip()) if s.strip()]
    if not sentences:
        return 0.0
    return statistics.mean(len(s.split()) for s in sentences)


def _phrase_pattern(phrases: Sequence[str]) -> "re.Pattern":
    """Word-boundary matcher. Substring counting would score 'consumer' as 'um'."""
    alternatives = sorted((re.escape(p.strip()) for p in phrases), key=len, reverse=True)
    return re.compile(r"(?<![a-z'])(?:{})(?![a-z'])".format("|".join(alternatives)))


_FILLER_RE = _phrase_pattern(_FILLERS)
_HEDGE_RE = _phrase_pattern(_HEDGES)
_TEXTBOOK_RE = _phrase_pattern(_TEXTBOOK_MARKERS)
_FIRST_PERSON_RE = re.compile(r"(?<![a-z'])(?:i|i'\w+|my|we|we'\w+|our|us|me)(?![a-z'])")


def _density(text: str, pattern: "re.Pattern") -> float:
    words = max(len(_tokens(text)), 1)
    hits = len(pattern.findall(text.lower()))
    return (hits / words) * 100.0


def _first_person_density(text: str) -> float:
    return _density(text, _FIRST_PERSON_RE)


def _concreteness(text: str) -> float:
    """Rough proxy for 'this describes a real thing that happened'.

    Counts numbers and proper nouns. Sentence-initial words are skipped -
    otherwise every capitalised "The" would read as a named system.
    """
    tokens = _tokens(text)
    if not tokens:
        return 0.0
    numbers = len(_NUMBER.findall(text))
    named = 0
    for sentence in _SENTENCE_SPLIT.split(text.strip()):
        words = sentence.split()[1:]  # skip the sentence-initial capital
        named += len([w for w in words if re.match(r"^[A-Z][a-zA-Z0-9]{2,}", w)])
    return ((numbers * 2 + named) / max(len(tokens), 1)) * 100.0


class TurnMetrics:
    """Everything we measure about one candidate turn."""

    def __init__(self, turn: TranscriptTurn, index: int):
        self.turn = turn
        self.index = index
        self.latency = turn.latency_s
        self.words = turn.word_count
        self.sentence_length = _mean_sentence_length(turn.text)
        self.filler = _density(turn.text, _FILLER_RE)
        self.hedge = _density(turn.text, _HEDGE_RE)
        self.first_person = _first_person_density(turn.text)
        self.concreteness = _concreteness(turn.text)
        self.textbook = _density(turn.text, _TEXTBOOK_RE)

    @property
    def fluency(self) -> float:
        """Higher means longer, cleaner, less spontaneous-sounding speech."""
        return self.sentence_length - (self.filler * 2.0)


def _candidate_turns(transcript: Sequence[TranscriptTurn]) -> List[Tuple[int, TranscriptTurn]]:
    return [(i, t) for i, t in enumerate(transcript) if t.role == "candidate"]


def _cap_confidence(value: float, sample_size: int) -> float:
    """Small samples never get high confidence, no matter how extreme the z."""
    ceiling = min(0.9, 0.35 + 0.08 * sample_size)
    return round(max(0.05, min(value, ceiling)), 2)


def detect_latency_signals(metrics: List[TurnMetrics]) -> List[IntegritySignal]:
    if len(metrics) < MIN_TURNS_FOR_BASELINE:
        return []
    latencies = [m.latency for m in metrics]
    signals = []
    for position, m in enumerate(metrics):
        if m.latency < MIN_ABSOLUTE_LATENCY_S:
            continue
        z = _robust_z(m.latency, latencies, index=position, min_spread=MIN_LATENCY_SPREAD_S)
        if z < LATENCY_Z_MEDIUM:
            continue
        severity = "high" if z >= LATENCY_Z_HIGH else "medium"
        signals.append(
            IntegritySignal(
                kind="response_latency",
                severity=severity,
                confidence=_cap_confidence(0.3 + 0.12 * z, len(metrics)),
                summary="{:.1f}s pause before answering ({:.1f}x this candidate's usual)".format(
                    m.latency, m.latency / max(statistics.median(latencies), 0.1)
                ),
                rationale=(
                    "This candidate's median response gap is {:.1f}s. This answer began "
                    "after {:.1f}s. Long pauses have many innocent causes - thinking, "
                    "connection lag, re-reading a diagram - so treat this only as a "
                    "pointer to re-watch this moment.".format(
                        statistics.median(latencies), m.latency
                    )
                ),
                quote=m.turn.text[:280],
                timestamp=m.turn.timestamp,
                turn_index=m.index,
                suggested_follow_up=(
                    "Ask them to expand on this answer live: 'can you sketch that "
                    "out for me?' A held explanation survives the follow-up."
                ),
            )
        )
    return signals


def detect_register_shifts(metrics: List[TurnMetrics]) -> List[IntegritySignal]:
    """A person's speaking style is stable within one conversation.

    A sudden jump to long, filler-free, textbook-structured sentences is
    worth a second look - not because it proves anything, but because it
    is the cheapest thing for a human to verify with one follow-up.
    """
    if len(metrics) < MIN_TURNS_FOR_BASELINE:
        return []

    median_filler = statistics.median([m.filler for m in metrics])
    median_person = statistics.median([m.first_person for m in metrics])
    sentence_lengths = [m.sentence_length for m in metrics]

    signals = []
    for position, m in enumerate(metrics):
        if m.words < 30:  # too short to characterise a style
            continue

        # Four independent indicators. One alone is noise; a person who is
        # simply articulate will trip at most one. Two or more together is
        # what makes a moment worth a human re-read.
        detail = []
        if median_filler > 1.0 and m.filler <= 0.25 * median_filler:
            detail.append("disfluencies drop away")
        if _robust_z(m.sentence_length, sentence_lengths, index=position) >= 1.5:
            detail.append("{:.0f}-word average sentences".format(m.sentence_length))
        if m.textbook > 0:
            detail.append("essay-style connectives")
        if median_person > 1.5 and m.first_person <= 0.4 * median_person:
            detail.append("first-person ownership disappears")

        if len(detail) < 2:
            continue
        severity = "high" if len(detail) >= 3 else "medium"
        signals.append(
            IntegritySignal(
                kind="register_shift",
                severity=severity,
                confidence=_cap_confidence(0.2 + 0.13 * len(detail), len(metrics)),
                summary="Speaking style changes sharply here ({})".format(", ".join(detail)),
                rationale=(
                    "Compared with this candidate's own earlier answers, this turn is "
                    "markedly more written-sounding. People do get more fluent on "
                    "topics they know well, so this is a prompt to probe the topic, "
                    "not evidence of anything."
                ),
                quote=m.turn.text[:280],
                timestamp=m.turn.timestamp,
                turn_index=m.index,
                suggested_follow_up=(
                    "Interrupt gently with a specific, personal probe: 'which part of "
                    "that did you build yourself?'"
                ),
            )
        )
    return signals


def detect_low_specificity(metrics: List[TurnMetrics]) -> List[IntegritySignal]:
    """Generic answers are a *question quality* problem as much as an integrity one."""
    signals = []
    for m in metrics:
        if m.words < 40:
            continue
        generic = (
            m.first_person < 1.0
            and m.concreteness < 2.0
            and (m.textbook > 0 or m.hedge > 1.5)
        )
        if not generic:
            continue
        signals.append(
            IntegritySignal(
                kind="low_specificity",
                severity="low",
                confidence=_cap_confidence(0.45, len(metrics)),
                summary="Answer describes the topic in general rather than their own work",
                rationale=(
                    "No first-person ownership, no names, numbers or dates. This is the "
                    "shape of a correct-but-anonymous answer. It is also what a nervous "
                    "candidate produces under pressure - the fix is the same either way: "
                    "ask for their specific involvement."
                ),
                quote=m.turn.text[:280],
                timestamp=m.turn.timestamp,
                turn_index=m.index,
                suggested_follow_up=(
                    "'What was your part of that, specifically - what did you write "
                    "or decide?'"
                ),
            )
        )
    return signals


def detect_portfolio_mismatch(
    metrics: List[TurnMetrics],
    questions: Sequence[Question],
) -> List[IntegritySignal]:
    """Did the answer engage with the claim the question was built from?"""
    if not questions:
        return []
    by_id = {q.id: q for q in questions}
    signals = []
    for m in metrics:
        question = by_id.get(m.turn.question_id or "")
        if not question or not question.grounded_in:
            continue
        grounding_terms = _stems(question.grounded_in)
        # Too few anchor words and the overlap ratio is meaningless.
        if len(grounding_terms) < 5:
            continue
        # A short answer has no room to echo the claim; judging it unfair.
        if m.words < MIN_WORDS_FOR_MISMATCH:
            continue
        overlap = grounding_terms & _stems(m.turn.text)
        coverage = len(overlap) / len(grounding_terms)
        if coverage > MISMATCH_COVERAGE_MAX:
            continue
        signals.append(
            IntegritySignal(
                kind="portfolio_mismatch",
                severity="medium",
                confidence=_cap_confidence(0.4 + (MISMATCH_COVERAGE_MAX - coverage), len(metrics)),
                summary="Answer does not engage with the portfolio claim behind the question",
                rationale=(
                    "The question was grounded in: \"{}\". The answer shares almost none "
                    "of that vocabulary. That can mean the claim was overstated - or "
                    "simply that they answered a different reading of the question. "
                    "Re-ask before drawing any conclusion.".format(
                        question.grounded_in[:180]
                    )
                ),
                quote=m.turn.text[:280],
                timestamp=m.turn.timestamp,
                turn_index=m.index,
                suggested_follow_up=(
                    "Quote their portfolio back to them: 'your CV says {} - tell me "
                    "about that part.'".format(question.grounded_in[:90])
                ),
            )
        )
    return signals


def detect_self_contradiction(metrics: List[TurnMetrics]) -> List[IntegritySignal]:
    """Ownership language that flips between answers about the same work."""
    signals = []
    solo_claims: Dict[str, TurnMetrics] = {}
    for m in metrics:
        lowered = m.turn.text.lower()
        subjects = set(re.findall(r"\b(?:the|our|my)\s+([a-z]{4,}(?:\s+[a-z]{4,})?)", lowered))
        says_solo = any(p in lowered for p in ("i built", "i wrote", "i designed", "i owned"))
        says_team = any(p in lowered for p in ("the team built", "we had a team", "someone else",
                                               "another team", "i wasn't involved", "i was not involved"))
        for subject in subjects:
            if says_solo and subject not in solo_claims:
                solo_claims[subject] = m
            elif says_team and subject in solo_claims:
                first = solo_claims[subject]
                signals.append(
                    IntegritySignal(
                        kind="ownership_inconsistency",
                        severity="medium",
                        confidence=_cap_confidence(0.4, len(metrics)),
                        summary="Ownership of \"{}\" described differently at {} and {}".format(
                            subject, first.turn.timestamp, m.turn.timestamp
                        ),
                        rationale=(
                            "Earlier the candidate described this as their own work; here "
                            "it is attributed to others. People do clarify scope as a "
                            "conversation goes on - this is a prompt to establish who "
                            "did what, not a contradiction to hold against them."
                        ),
                        quote=m.turn.text[:280],
                        timestamp=m.turn.timestamp,
                        turn_index=m.index,
                        suggested_follow_up=(
                            "'Help me get the boundaries right - which pieces were "
                            "yours and which were the team's?'"
                        ),
                    )
                )
                break
    return signals


def _azure_review(
    transcript: Sequence[TranscriptTurn],
    questions: Sequence[Question],
    profile: Optional[CandidateProfile],
) -> List[IntegritySignal]:
    """Optional LLM pass for inconsistencies the heuristics cannot see."""
    lines = [
        "[{}] {}: {}".format(t.timestamp, t.role, t.text)
        for t in transcript
    ]
    claims = [c.text for c in (profile.claims if profile else [])][:12]
    payload = try_chat_json(
        system=(
            "You review an interview transcript for a human interviewer. Identify "
            "moments worth re-reading: answers that contradict the candidate's stated "
            "experience, answers that contradict an earlier answer, or claims that "
            "cannot be verified from what was said.\n"
            "Hard rules: never state or imply that the candidate cheated or used AI. "
            "Never score the candidate. Never mention protected characteristics. "
            "Every item must quote the transcript verbatim. If nothing warrants "
            "review, return an empty list.\n"
            'Return JSON: {"observations": [{"summary": str, "rationale": str, '
            '"quote": str, "timestamp": str, "severity": "low"|"medium", '
            '"suggested_follow_up": str}]}'
        ),
        user=json.dumps(
            {"portfolio_claims": claims, "transcript": lines[:220]}, indent=2
        ),
        temperature=0.2,
        max_tokens=1800,
    )
    if not payload:
        return []

    quote_index = {t.text[:60]: i for i, t in enumerate(transcript)}
    signals = []
    for item in payload.get("observations", []):
        if not isinstance(item, dict) or not item.get("summary"):
            continue
        quote = str(item.get("quote", ""))[:280]
        severity = str(item.get("severity", "low")).lower()
        if severity not in ("low", "medium"):
            severity = "low"
        turn_index = next(
            (i for key, i in quote_index.items() if key and key[:40] in quote), 0
        )
        signals.append(
            IntegritySignal(
                kind="transcript_review",
                severity=severity,
                confidence=0.35,
                summary=str(item["summary"])[:200],
                rationale=str(item.get("rationale", ""))[:600],
                quote=quote,
                timestamp=str(item.get("timestamp", transcript[turn_index].timestamp)),
                turn_index=turn_index,
                suggested_follow_up=str(item.get("suggested_follow_up", ""))[:240],
            )
        )
    return signals


def analyse(
    transcript: Sequence[TranscriptTurn],
    questions: Optional[Sequence[Question]] = None,
    profile: Optional[CandidateProfile] = None,
    use_llm: Optional[bool] = None,
) -> List[IntegritySignal]:
    """Run every detector and return signals ranked by how much they need a human."""
    questions = questions or []
    pairs = _candidate_turns(transcript)
    metrics = [TurnMetrics(turn, index) for index, turn in pairs]
    if not metrics:
        return []

    signals: List[IntegritySignal] = []
    signals.extend(detect_latency_signals(metrics))
    signals.extend(detect_register_shifts(metrics))
    signals.extend(detect_low_specificity(metrics))
    signals.extend(detect_portfolio_mismatch(metrics, questions))
    signals.extend(detect_self_contradiction(metrics))

    enabled = azure_configured() if use_llm is None else use_llm
    if enabled:
        signals.extend(_azure_review(transcript, questions, profile))

    return rank_severity(_dedupe(signals))


def _dedupe(signals: List[IntegritySignal]) -> List[IntegritySignal]:
    """One turn should not produce five near-identical cards in the UI."""
    best: Dict[Tuple[int, str], IntegritySignal] = {}
    for signal in signals:
        key = (signal.turn_index, signal.kind)
        current = best.get(key)
        if current is None or signal.confidence > current.confidence:
            best[key] = signal
    return list(best.values())


def baseline_summary(transcript: Sequence[TranscriptTurn]) -> Dict[str, float]:
    """The candidate's own norms - shown in the UI so flags are interpretable."""
    metrics = [TurnMetrics(t, i) for i, t in _candidate_turns(transcript)]
    if not metrics:
        return {}
    return {
        "turns": len(metrics),
        "median_latency_s": round(statistics.median([m.latency for m in metrics]), 2),
        "median_words": round(statistics.median([m.words for m in metrics]), 1),
        "median_sentence_length": round(
            statistics.median([m.sentence_length for m in metrics]), 1
        ),
        "median_filler_per_100w": round(statistics.median([m.filler for m in metrics]), 2),
        "baseline_reliable": len(metrics) >= MIN_TURNS_FOR_BASELINE,
    }
