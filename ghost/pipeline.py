"""The four-step workflow from slide 05: INPUT -> GENERATE -> INTERVIEW -> REPORT.

Each stage is a pure function over the previous stage's output, which is
what lets the same code run as one local process now and as separate
Azure Functions later.
"""

from typing import Any, Dict, List, Optional, Sequence

from .config import engine_name
from .ingest import load_context
from .integrity import analyse
from .models import CandidateProfile, IntegrityReport, Question, RoleSpec, TranscriptTurn
from .questions import generate_questions
from .report import build_report, report_to_dict, to_markdown
from .transcript import attach_questions, from_json, from_vtt


class InterviewSession:
    """One candidate, one role, one interview."""

    def __init__(self, profile: CandidateProfile, spec: RoleSpec):
        self.profile = profile
        self.spec = spec
        self.questions: List[Question] = []
        self.transcript: List[TranscriptTurn] = []
        self.report: Optional[IntegrityReport] = None

    # --- stage 2: GENERATE -------------------------------------------------
    def prepare(self, count: int = 8, use_llm: Optional[bool] = None) -> List[Question]:
        self.questions = generate_questions(
            self.profile, self.spec, count=count, use_llm=use_llm
        )
        return self.questions

    # --- stage 3: INTERVIEW ------------------------------------------------
    def load_transcript(self, turns: Sequence[TranscriptTurn]) -> List[TranscriptTurn]:
        self.transcript = attach_questions(list(turns), self.questions)
        return self.transcript

    # --- stage 4: REPORT ---------------------------------------------------
    def review(
        self, use_llm: Optional[bool] = None, interview_date: Optional[str] = None
    ) -> IntegrityReport:
        signals = analyse(
            self.transcript,
            questions=self.questions,
            profile=self.profile,
            use_llm=use_llm,
        )
        self.report = build_report(
            self.profile, self.spec, self.questions, self.transcript, signals,
            interview_date=interview_date,
        )
        return self.report

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "engine": engine_name(),
            "candidate": self.profile.to_dict(),
            "role": self.spec.to_dict(),
            "questions": [q.to_dict() for q in self.questions],
            "transcript": [t.to_dict() for t in self.transcript],
        }
        if self.report:
            payload["report"] = report_to_dict(self.report, self.transcript)
            payload["report_markdown"] = to_markdown(self.report, self.transcript)
        return payload


def run(
    portfolio_text: str,
    job_description_text: str,
    transcript_text: Optional[str] = None,
    transcript_format: str = "auto",
    question_count: int = 8,
    use_llm: Optional[bool] = None,
    interview_date: Optional[str] = None,
) -> InterviewSession:
    """Run as much of the pipeline as the supplied inputs allow.

    With no transcript this stops after GENERATE - which is exactly the
    pre-interview prep view an interviewer opens the morning of the call.
    """
    profile, spec = load_context(portfolio_text, job_description_text, use_llm=use_llm)
    session = InterviewSession(profile, spec)
    session.prepare(count=question_count, use_llm=use_llm)

    if transcript_text:
        session.load_transcript(parse_transcript(transcript_text, transcript_format))
        session.review(use_llm=use_llm, interview_date=interview_date)

    return session


def parse_transcript(text: str, fmt: str = "auto") -> List[TranscriptTurn]:
    import json

    stripped = text.lstrip()
    if fmt == "vtt" or (fmt == "auto" and stripped.upper().startswith("WEBVTT")):
        return from_vtt(text)
    return from_json(json.loads(text))
