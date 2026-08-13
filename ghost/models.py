"""Core data structures shared by every Ghost module.

These map onto the four solution components on slide 06:
  ingestion -> CandidateProfile / RoleSpec
  question generation -> Question
  live integrity engine -> TranscriptTurn / IntegritySignal
  report generator -> EvidencePacket / IntegrityReport
"""

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

# Severity is deliberately about *how much interviewer attention this
# deserves*, never about how likely the candidate is to be cheating.
SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3}

DIFFICULTY_TIERS = ("warmup", "core", "stretch")


@dataclass
class Claim:
    """A single verifiable assertion pulled out of a candidate's portfolio."""

    text: str
    skill: str
    source: str  # which section of the portfolio it came from
    specificity: float = 0.0  # 0-1; how checkable the claim is as written

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CandidateProfile:
    name: str
    headline: str = ""
    skills: List[str] = field(default_factory=list)
    claims: List[Claim] = field(default_factory=list)
    projects: List[str] = field(default_factory=list)
    raw_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["claims"] = [c.to_dict() for c in self.claims]
        return data


@dataclass
class RoleSpec:
    title: str
    level: str = ""
    must_have: List[str] = field(default_factory=list)
    nice_to_have: List[str] = field(default_factory=list)
    competencies: List[str] = field(default_factory=list)
    raw_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Question:
    id: str
    text: str
    competency: str
    difficulty: str  # one of DIFFICULTY_TIERS
    grounded_in: str  # the portfolio claim or JD requirement behind it
    follow_ups: List[str] = field(default_factory=list)
    looking_for: str = ""  # what a strong answer contains
    source: str = "offline"  # "azure-openai" or "offline"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TranscriptTurn:
    """One utterance from a Teams transcript.

    `latency_s` is the gap between the end of the previous turn and the
    start of this one - the response-latency signal on slide 03.
    """

    speaker: str
    role: str  # "interviewer" or "candidate"
    text: str
    start_s: float
    end_s: float
    latency_s: float = 0.0
    question_id: Optional[str] = None

    @property
    def timestamp(self) -> str:
        minutes, seconds = divmod(int(self.start_s), 60)
        return "{:02d}:{:02d}".format(minutes, seconds)

    @property
    def word_count(self) -> int:
        return len(self.text.split())

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["timestamp"] = self.timestamp
        data["word_count"] = self.word_count
        return data


@dataclass
class IntegritySignal:
    """A prompt to review evidence. Never a conclusion about a person."""

    kind: str
    severity: str
    confidence: float  # 0-1, how reliable the detector considers itself here
    summary: str
    rationale: str
    quote: str
    timestamp: str
    turn_index: int
    suggested_follow_up: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EvidencePacket:
    """The traceability unit described in the slide 06 speaker notes.

    Every observation Ghost surfaces can be walked back to the exact
    question, answer, quote and timestamp that produced it.
    """

    question_id: str
    question: str
    competency: str
    candidate_answer: str
    transcript_quote: str
    timestamp: str
    follow_up_question: str = ""
    follow_up_answer: str = ""
    unverified_claim: str = ""
    signals: List[IntegritySignal] = field(default_factory=list)
    environment_events: List[str] = field(default_factory=list)
    interviewer_disposition: str = ""  # filled in by the human, never by Ghost
    interviewer_rationale: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["signals"] = [s.to_dict() for s in self.signals]
        return data


@dataclass
class IntegrityReport:
    candidate: str
    role: str
    interview_date: str
    duration_s: float
    packets: List[EvidencePacket] = field(default_factory=list)
    signals: List[IntegritySignal] = field(default_factory=list)
    coverage: Dict[str, str] = field(default_factory=dict)
    review_recommended: bool = False
    headline: str = ""
    generated_by: str = "offline"

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["packets"] = [p.to_dict() for p in self.packets]
        data["signals"] = [s.to_dict() for s in self.signals]
        return data


def rank_severity(signals: List[IntegritySignal]) -> List[IntegritySignal]:
    """Most-severe first, then most-confident, then earliest in the interview."""
    return sorted(
        signals,
        key=lambda s: (-SEVERITY_ORDER.get(s.severity, 0), -s.confidence, s.turn_index),
    )
