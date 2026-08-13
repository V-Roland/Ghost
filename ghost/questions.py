"""Question generation engine.

Objective 1 on slide 03: cut interviewer prep time to near zero by
generating deep, role-specific questions from the candidate's own
portfolio. Questions are grounded in a specific claim so the interviewer
can check skills the candidate may have overstated.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional

from .config import azure_configured
from .ingest import match_claims_to_role
from .llm import try_chat_json
from .models import DIFFICULTY_TIERS, CandidateProfile, Question, RoleSpec

QUESTION_SYSTEM_PROMPT = """You generate interview questions for a human interviewer.

Rules:
- Ground every question in a specific claim from the candidate's portfolio or a
  stated requirement of the role. Quote the grounding text.
- Questions must be answerable only by someone who actually did the work: ask
  about trade-offs, failure modes, what they would change, and why alternatives
  were rejected. Avoid questions a generic model answer would satisfy.
- Never ask about protected characteristics, age, health, family, nationality,
  or anything not job related.
- Assign difficulty from: warmup, core, stretch.
- Provide two follow-up probes per question and a short description of what a
  strong answer contains.

Return JSON: {"questions": [{"text": str, "competency": str, "difficulty": str,
"grounded_in": str, "follow_ups": [str], "looking_for": str}]}"""

# Offline templates. Each probes depth-of-experience rather than recall,
# which is what makes a rehearsed or generated answer visible.
_TEMPLATES = {
    "warmup": [
        ("Your portfolio says: “{claim}”. Walk me through that end to end - "
         "what was the starting state, and which parts did you personally own?",
         "A concrete narrative with their own scope clearly separated from the team's."),
        ("You list {skill} on your portfolio. What is the most recent thing you built "
         "with it, and who used it?",
         "A specific, dated, named piece of work rather than a definition of {skill}."),
    ],
    "core": [
        ("On “{claim}” - what did you try first that did not work, and what "
         "did that teach you about the problem?",
         "A real dead end with a causal explanation. Rehearsed answers skip the failure."),
        ("You write: “{claim}”. What was the main trade-off you accepted "
         "there, and what did you give up to get it?",
         "Named alternatives with the cost of the chosen path, not just the benefits."),
        ("Take “{claim}”. If that had to handle ten times the load next "
         "quarter, what breaks first and why?",
         "A specific bottleneck tied to their actual design, not a generic scaling list."),
    ],
    "stretch": [
        ("If you rebuilt this today with no constraints - “{claim}” - what "
         "would you keep, what would you throw away, and why?",
         "Judgement grounded in what they learned; keeps the parts that earned their place."),
        ("Thinking about “{claim}” - where would an on-call engineer most "
         "likely get paged at 3am, and what would the runbook tell them to do?",
         "Operational awareness - failure modes, blast radius, and recovery steps."),
    ],
}


def _question_id(text: str, index: int) -> str:
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:6]
    return "q{:02d}-{}".format(index + 1, digest)


def _shorten(text: str, words: int = 14) -> str:
    parts = text.split()
    if len(parts) <= words:
        return text.rstrip(".")
    return " ".join(parts[:words]).rstrip(",.") + "..."


def _offline_questions(
    profile: CandidateProfile, spec: RoleSpec, count: int
) -> List[Question]:
    pairs = match_claims_to_role(profile, spec, limit=max(count, 6))
    if not pairs:
        return _role_only_questions(spec, count)

    # Roughly 1 warmup : 2 core : 1 stretch, which is how a 45 minute loop runs.
    plan: List[str] = []
    while len(plan) < count:
        plan.extend(["warmup", "core", "core", "stretch"])
    plan = plan[:count]

    questions: List[Question] = []
    used_templates: Dict[str, int] = {tier: 0 for tier in DIFFICULTY_TIERS}
    for index, tier in enumerate(plan):
        claim, competency = pairs[index % len(pairs)]
        templates = _TEMPLATES[tier]
        template, looking_for = templates[used_templates[tier] % len(templates)]
        used_templates[tier] += 1

        skill = claim.skill if claim.skill != "general" else competency
        text = template.format(claim=_shorten(claim.text, words=22), skill=skill)
        looking_for = looking_for.format(skill=skill)

        questions.append(
            Question(
                id=_question_id(text, index),
                text=text,
                competency=competency,
                difficulty=tier,
                grounded_in=claim.text,
                follow_ups=[
                    "What part of that would you struggle to explain to a new joiner?",
                    "Who else worked on it, and which decisions were theirs rather than yours?",
                ],
                looking_for=looking_for,
                source="offline",
            )
        )
    return questions


def _role_only_questions(spec: RoleSpec, count: int) -> List[Question]:
    """Used when a portfolio yields no usable claims - fall back to the JD."""
    requirements = spec.must_have or spec.competencies or ["the core responsibilities"]
    questions = []
    for index in range(count):
        requirement = requirements[index % len(requirements)]
        text = (
            "This role needs {}. Tell me about the last time you did that in "
            "production, including what went wrong.".format(_shorten(requirement, 18))
        )
        questions.append(
            Question(
                id=_question_id(text, index),
                text=text,
                competency=spec.competencies[0] if spec.competencies else "core engineering",
                difficulty=DIFFICULTY_TIERS[min(index % 3, 2)],
                grounded_in="Job description: {}".format(requirement),
                follow_ups=["What would you do differently now?",
                            "How did you verify it actually worked?"],
                looking_for="Specific production experience with a named failure and fix.",
                source="offline",
            )
        )
    return questions


def _azure_questions(
    profile: CandidateProfile, spec: RoleSpec, count: int
) -> Optional[List[Question]]:
    pairs = match_claims_to_role(profile, spec, limit=8)
    context = {
        "role": {
            "title": spec.title,
            "level": spec.level,
            "must_have": spec.must_have,
            "competencies": spec.competencies,
        },
        "candidate": {
            "headline": profile.headline,
            "skills": profile.skills[:25],
            "priority_claims": [
                {"claim": claim.text, "competency": competency}
                for claim, competency in pairs
            ],
        },
        "questions_requested": count,
    }
    payload = try_chat_json(
        system=QUESTION_SYSTEM_PROMPT,
        user=json.dumps(context, indent=2),
        temperature=0.5,
        max_tokens=2200,
    )
    if not payload:
        return None

    raw_questions = payload.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        return None

    questions: List[Question] = []
    for index, item in enumerate(raw_questions[:count]):
        if not isinstance(item, dict) or not item.get("text"):
            continue
        difficulty = str(item.get("difficulty", "core")).lower()
        if difficulty not in DIFFICULTY_TIERS:
            difficulty = "core"
        follow_ups = [f for f in item.get("follow_ups", []) if isinstance(f, str)]
        questions.append(
            Question(
                id=_question_id(str(item["text"]), index),
                text=str(item["text"]).strip(),
                competency=str(item.get("competency") or "core engineering").strip(),
                difficulty=difficulty,
                grounded_in=str(item.get("grounded_in") or "").strip(),
                follow_ups=follow_ups[:3],
                looking_for=str(item.get("looking_for") or "").strip(),
                source="azure-openai",
            )
        )
    return questions or None


def generate_questions(
    profile: CandidateProfile,
    spec: RoleSpec,
    count: int = 8,
    use_llm: Optional[bool] = None,
) -> List[Question]:
    """Build the interview guide. Falls back to templates if Azure is unavailable."""
    count = max(1, min(count, 20))
    enabled = azure_configured() if use_llm is None else use_llm
    if enabled:
        generated = _azure_questions(profile, spec, count)
        if generated:
            return generated
    return _offline_questions(profile, spec, count)


def guide_to_dict(questions: List[Question]) -> Dict[str, Any]:
    by_tier: Dict[str, List[Dict[str, Any]]] = {tier: [] for tier in DIFFICULTY_TIERS}
    for question in questions:
        by_tier.setdefault(question.difficulty, []).append(question.to_dict())
    return {
        "count": len(questions),
        "source": questions[0].source if questions else "offline",
        "by_difficulty": by_tier,
        "questions": [q.to_dict() for q in questions],
    }
