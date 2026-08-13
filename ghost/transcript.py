"""Teams transcript loading.

Two input shapes are supported:
  - Ghost JSON (what the prototype records and what tests use)
  - WebVTT, which is what Microsoft Graph returns for a Teams meeting
    transcript (`/me/onlineMeetings/{id}/transcripts/{id}/content`)

Response latency is derived here rather than measured live, so a recorded
interview produces exactly the same signals as a live one.
"""

import json
import re
from typing import Any, Dict, List, Optional, Sequence

from .models import TranscriptTurn

_VTT_TIME = re.compile(
    r"(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})"
)
_VTT_SPEAKER = re.compile(r"^<v\s+([^>]+)>(.*?)(?:</v>)?$", re.DOTALL)

_INTERVIEWER_HINTS = ("interviewer", "hiring", "manager", "recruiter", "host")


def _to_seconds(hours: Optional[str], minutes: str, seconds: str, millis: str) -> float:
    return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000.0


def _infer_role(speaker: str, interviewer_names: Sequence[str]) -> str:
    lowered = speaker.lower()
    if any(name.lower() in lowered for name in interviewer_names if name):
        return "interviewer"
    if any(hint in lowered for hint in _INTERVIEWER_HINTS):
        return "interviewer"
    return "candidate"


def compute_latency(turns: List[TranscriptTurn]) -> List[TranscriptTurn]:
    """Gap between the end of the previous speaker and the start of this turn.

    Negative gaps (overlapping speech) are clamped to zero - an interruption
    is not a hesitation.
    """
    for index, turn in enumerate(turns):
        if index == 0:
            turn.latency_s = 0.0
            continue
        gap = turn.start_s - turns[index - 1].end_s
        turn.latency_s = round(max(0.0, gap), 2)
    return turns


# Cues that end a topic. Without these, every answer after the last planned
# question keeps inheriting that question's id - including "any questions
# for me?" at the end.
_CLOSING_CUES = (
    "anything you want to ask", "any questions for", "before we wrap",
    "before we finish", "that's all i had", "thanks for your time",
    "we're out of time", "hand back to",
)


def attach_questions(
    turns: List[TranscriptTurn], questions: Sequence[Any], threshold: float = 0.35
) -> List[TranscriptTurn]:
    """Tag each candidate answer with the planned question it responds to.

    Matching is lexical overlap against the interviewer turn that preceded
    it; good enough for the prototype and fully deterministic, which keeps
    the evidence chain auditable.
    """
    if not questions:
        return turns

    def tokens(text: str) -> set:
        return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 3}

    question_tokens = [(q, tokens(q.text)) for q in questions]
    current_id: Optional[str] = None
    for turn in turns:
        if turn.role == "interviewer":
            lowered = turn.text.lower()
            if any(cue in lowered for cue in _CLOSING_CUES):
                current_id = None
                continue
            if "?" not in turn.text:
                # Framing, small talk or a hand-off - not the asking of a question.
                continue
            asked = tokens(turn.text)
            best_score, best_id = 0.0, None
            for question, q_tokens in question_tokens:
                if not q_tokens:
                    continue
                score = len(asked & q_tokens) / len(q_tokens)
                if score > best_score:
                    best_score, best_id = score, question.id
            # An unmatched interviewer turn is usually a follow-up probe on the
            # current question, so we keep the existing id rather than clearing.
            current_id = best_id if best_score >= threshold else current_id
        elif turn.role == "candidate":
            turn.question_id = current_id
    return turns


def from_json(data: Any) -> List[TranscriptTurn]:
    """Load Ghost's own transcript format."""
    if isinstance(data, dict):
        entries = data.get("turns") or data.get("transcript") or []
        interviewer_names = data.get("interviewers", [])
    else:
        entries, interviewer_names = data, []

    turns: List[TranscriptTurn] = []
    for entry in entries:
        speaker = str(entry.get("speaker", "Unknown"))
        role = str(entry.get("role") or _infer_role(speaker, interviewer_names))
        turns.append(
            TranscriptTurn(
                speaker=speaker,
                role="interviewer" if role.startswith("interview") else "candidate",
                text=str(entry.get("text", "")).strip(),
                start_s=float(entry.get("start_s", 0.0)),
                end_s=float(entry.get("end_s", entry.get("start_s", 0.0))),
                question_id=entry.get("question_id"),
            )
        )
    turns.sort(key=lambda t: t.start_s)
    return compute_latency(turns)


def from_vtt(text: str, interviewer_names: Optional[Sequence[str]] = None) -> List[TranscriptTurn]:
    """Load a WebVTT transcript as produced by Microsoft Teams."""
    interviewer_names = interviewer_names or []
    turns: List[TranscriptTurn] = []
    blocks = re.split(r"\n\s*\n", text.replace("\r\n", "\n").strip())

    for block in blocks:
        lines = [l for l in block.split("\n") if l.strip()]
        if not lines or lines[0].strip().upper().startswith("WEBVTT"):
            continue
        timing_line = next((l for l in lines if _VTT_TIME.search(l)), None)
        if not timing_line:
            continue
        match = _VTT_TIME.search(timing_line)
        start_s = _to_seconds(match.group(1), match.group(2), match.group(3), match.group(4))
        end_s = _to_seconds(match.group(5), match.group(6), match.group(7), match.group(8))

        payload = " ".join(lines[lines.index(timing_line) + 1 :]).strip()
        if not payload:
            continue

        speaker_match = _VTT_SPEAKER.match(payload)
        if speaker_match:
            speaker = speaker_match.group(1).strip()
            body = speaker_match.group(2).strip()
        elif ":" in payload[:40]:
            speaker, body = payload.split(":", 1)
            speaker, body = speaker.strip(), body.strip()
        else:
            speaker, body = "Unknown", payload

        turns.append(
            TranscriptTurn(
                speaker=speaker,
                role=_infer_role(speaker, interviewer_names),
                text=body,
                start_s=start_s,
                end_s=end_s,
            )
        )

    turns = _merge_adjacent(turns)
    turns.sort(key=lambda t: t.start_s)
    return compute_latency(turns)


def _merge_adjacent(turns: List[TranscriptTurn], max_gap_s: float = 1.5) -> List[TranscriptTurn]:
    """Teams emits a cue every few seconds; stitch them back into utterances."""
    merged: List[TranscriptTurn] = []
    for turn in turns:
        if (
            merged
            and merged[-1].speaker == turn.speaker
            and turn.start_s - merged[-1].end_s <= max_gap_s
        ):
            merged[-1].text = (merged[-1].text + " " + turn.text).strip()
            merged[-1].end_s = turn.end_s
        else:
            merged.append(turn)
    return merged


def load(path: str, interviewer_names: Optional[Sequence[str]] = None) -> List[TranscriptTurn]:
    with open(path, "r", encoding="utf-8") as handle:
        content = handle.read()
    if path.lower().endswith(".vtt") or content.lstrip().upper().startswith("WEBVTT"):
        return from_vtt(content, interviewer_names)
    return from_json(json.loads(content))


def to_dict(turns: Sequence[TranscriptTurn]) -> List[Dict[str, Any]]:
    return [turn.to_dict() for turn in turns]
