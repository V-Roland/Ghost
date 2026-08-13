"""Post-interview evidence report.

Objective 3 on slide 03: back decisions with evidence, not guesswork.

The unit of output is the evidence packet from the slide 06 notes - question,
competency, answer, verbatim quote, timestamp, follow-up, unverified claim,
authorised environment events, and the interviewer's own disposition. Every
observation Ghost makes is traceable to the exact moment that produced it.
"""

import datetime
from typing import Any, Dict, List, Optional, Sequence

from .config import engine_name
from .integrity import baseline_summary
from .models import (
    CandidateProfile,
    EvidencePacket,
    IntegrityReport,
    IntegritySignal,
    Question,
    RoleSpec,
    TranscriptTurn,
    rank_severity,
)

# Ghost recommends a human re-watch at this level, and never more than that.
REVIEW_THRESHOLDS = {"high": 1, "medium": 2}

DISCLAIMER = (
    "Ghost surfaces observations for human review. It does not determine whether "
    "a candidate used unauthorised assistance, does not score candidates, and does "
    "not make hiring recommendations. Every item below is a prompt to re-read the "
    "transcript, and each has ordinary explanations as well as concerning ones."
)


def _answers_for(
    transcript: Sequence[TranscriptTurn], question_id: str
) -> List[TranscriptTurn]:
    return [
        t for t in transcript
        if t.role == "candidate" and t.question_id == question_id and t.text
    ]


def build_packets(
    transcript: Sequence[TranscriptTurn],
    questions: Sequence[Question],
    signals: Sequence[IntegritySignal],
    profile: Optional[CandidateProfile] = None,
) -> List[EvidencePacket]:
    signals_by_turn: Dict[int, List[IntegritySignal]] = {}
    for signal in signals:
        signals_by_turn.setdefault(signal.turn_index, []).append(signal)

    packets: List[EvidencePacket] = []
    for question in questions:
        answers = _answers_for(transcript, question.id)
        if not answers:
            packets.append(
                EvidencePacket(
                    question_id=question.id,
                    question=question.text,
                    competency=question.competency,
                    candidate_answer="",
                    transcript_quote="",
                    timestamp="",
                    unverified_claim=question.grounded_in,
                    interviewer_disposition="not asked",
                )
            )
            continue

        primary = answers[0]
        follow_up_answer = answers[1] if len(answers) > 1 else None
        follow_up_question = ""
        if follow_up_answer:
            index = transcript.index(follow_up_answer)
            for previous in reversed(list(transcript[:index])):
                if previous.role == "interviewer":
                    follow_up_question = previous.text
                    break

        packet_signals: List[IntegritySignal] = []
        for answer in answers:
            packet_signals.extend(signals_by_turn.get(transcript.index(answer), []))

        unverified = ""
        if any(s.kind == "portfolio_mismatch" for s in packet_signals):
            unverified = question.grounded_in

        packets.append(
            EvidencePacket(
                question_id=question.id,
                question=question.text,
                competency=question.competency,
                candidate_answer=primary.text,
                transcript_quote=primary.text[:400],
                timestamp=primary.timestamp,
                follow_up_question=follow_up_question,
                follow_up_answer=follow_up_answer.text if follow_up_answer else "",
                unverified_claim=unverified,
                signals=rank_severity(packet_signals),
            )
        )
    return packets


def coverage_map(packets: Sequence[EvidencePacket], spec: RoleSpec) -> Dict[str, str]:
    """Which competencies actually got evidence - the prep-quality half of the report."""
    coverage: Dict[str, str] = {}
    for competency in spec.competencies:
        relevant = [p for p in packets if p.competency == competency]
        answered = [p for p in relevant if p.candidate_answer]
        if not relevant:
            coverage[competency] = "not planned"
        elif not answered:
            coverage[competency] = "planned, not asked"
        elif len(answered) == 1:
            coverage[competency] = "one answer"
        else:
            coverage[competency] = "{} answers".format(len(answered))
    return coverage


def _headline(signals: Sequence[IntegritySignal], packets: Sequence[EvidencePacket]) -> str:
    asked = len([p for p in packets if p.candidate_answer])
    if not signals:
        return (
            "No moments flagged for review across {} answered questions. "
            "The transcript and evidence packets are attached for the record.".format(asked)
        )
    high = len([s for s in signals if s.severity == "high"])
    medium = len([s for s in signals if s.severity == "medium"])
    parts = []
    if high:
        parts.append("{} moment{} worth re-watching closely".format(high, "" if high == 1 else "s"))
    if medium:
        parts.append("{} worth a second read".format(medium))
    remainder = len(signals) - high - medium
    if remainder:
        parts.append("{} minor note{}".format(remainder, "" if remainder == 1 else "s"))
    if len(parts) > 1:
        summary = "{} and {}".format(", ".join(parts[:-1]), parts[-1])
    else:
        summary = parts[0]
    return (
        "{} across {} answered questions. Each links to a timestamp so you can "
        "check it yourself.".format(summary[0].upper() + summary[1:], asked)
    )


def _needs_review(signals: Sequence[IntegritySignal]) -> bool:
    high = len([s for s in signals if s.severity == "high"])
    medium = len([s for s in signals if s.severity == "medium"])
    return high >= REVIEW_THRESHOLDS["high"] or medium >= REVIEW_THRESHOLDS["medium"]


def build_report(
    profile: CandidateProfile,
    spec: RoleSpec,
    questions: Sequence[Question],
    transcript: Sequence[TranscriptTurn],
    signals: Sequence[IntegritySignal],
    interview_date: Optional[str] = None,
) -> IntegrityReport:
    packets = build_packets(transcript, questions, signals, profile)
    duration = transcript[-1].end_s if transcript else 0.0
    report = IntegrityReport(
        candidate=profile.name,
        role=spec.title,
        interview_date=interview_date or datetime.date.today().isoformat(),
        duration_s=round(duration, 1),
        packets=packets,
        signals=rank_severity(list(signals)),
        coverage=coverage_map(packets, spec),
        review_recommended=_needs_review(signals),
        headline=_headline(signals, packets),
        generated_by=engine_name(),
    )
    return report


def report_to_dict(report: IntegrityReport, transcript: Sequence[TranscriptTurn]) -> Dict[str, Any]:
    data = report.to_dict()
    data["disclaimer"] = DISCLAIMER
    data["baseline"] = baseline_summary(transcript)
    data["signal_counts"] = {
        severity: len([s for s in report.signals if s.severity == severity])
        for severity in ("high", "medium", "low", "info")
    }
    return data


def to_markdown(report: IntegrityReport, transcript: Sequence[TranscriptTurn]) -> str:
    """Plain-text report for pasting into an ATS or a hiring channel."""
    baseline = baseline_summary(transcript)
    lines = [
        "# Interview evidence report",
        "",
        "**Candidate:** {}  ".format(report.candidate),
        "**Role:** {}  ".format(report.role),
        "**Date:** {}  ".format(report.interview_date),
        "**Duration:** {:.0f} min  ".format(report.duration_s / 60.0),
        "**Generated by:** {}".format(report.generated_by),
        "",
        "> {}".format(DISCLAIMER),
        "",
        "## Summary",
        "",
        report.headline,
        "",
    ]

    if report.review_recommended:
        lines += ["**A second reviewer is suggested before a decision is recorded.**", ""]

    lines += ["## Competency coverage", ""]
    for competency, status in report.coverage.items():
        lines.append("- **{}** - {}".format(competency, status))
    lines.append("")

    if report.signals:
        lines += ["## Moments flagged for review", ""]
        for signal in report.signals:
            lines += [
                "### [{}] {} ({})".format(signal.timestamp, signal.summary, signal.severity),
                "",
                "- **Signal:** `{}`  confidence {:.0%}".format(signal.kind, signal.confidence),
                "- **Why it surfaced:** {}".format(signal.rationale),
                "- **Quote:** “{}”".format(signal.quote),
            ]
            if signal.suggested_follow_up:
                lines.append("- **Suggested follow-up:** {}".format(signal.suggested_follow_up))
            lines.append("")

    lines += ["## Evidence packets", ""]
    for packet in report.packets:
        lines += [
            "### {} - {}".format(packet.question_id, packet.competency),
            "",
            "**Question:** {}".format(packet.question),
        ]
        if not packet.candidate_answer:
            lines += ["", "_Not asked in this interview._", ""]
            continue
        lines += [
            "**Answer [{}]:** “{}”".format(packet.timestamp, packet.transcript_quote),
        ]
        if packet.follow_up_question:
            lines.append("**Follow-up:** {}".format(packet.follow_up_question))
        if packet.follow_up_answer:
            lines.append("**Follow-up answer:** “{}”".format(packet.follow_up_answer[:300]))
        if packet.unverified_claim:
            lines.append("**Claim not evidenced in the answer:** {}".format(packet.unverified_claim))
        if packet.signals:
            lines.append("**Flags:** {}".format(
                ", ".join("{} ({})".format(s.kind, s.severity) for s in packet.signals)
            ))
        lines += [
            "**Interviewer disposition:** {}".format(packet.interviewer_disposition or "_to be completed_"),
            "",
        ]

    if baseline:
        lines += [
            "## Candidate baseline",
            "",
            "Signals are measured against this candidate's own norms in this "
            "conversation, never against other candidates.",
            "",
            "- Candidate turns: {}".format(baseline.get("turns")),
            "- Median response gap: {}s".format(baseline.get("median_latency_s")),
            "- Median answer length: {} words".format(baseline.get("median_words")),
            "- Baseline considered reliable: {}".format(
                "yes" if baseline.get("baseline_reliable") else "no - too few turns"
            ),
            "",
        ]

    return "\n".join(lines)
