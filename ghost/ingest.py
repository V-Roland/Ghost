"""Candidate portfolio and job description ingestion.

Turns free text into the structured context every later stage depends on:
what the candidate claims, and what the role actually requires.
"""

import re
from typing import Dict, List, Optional, Tuple

from .llm import try_chat_json
from .models import CandidateProfile, Claim, RoleSpec

# A small, editable vocabulary. In production this moves to a Cosmos DB
# skill taxonomy so it can be maintained without a deploy.
SKILL_VOCABULARY = [
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "c#", "c++",
    "sql", "nosql", "react", "angular", "vue", "node", "django", "flask", "fastapi",
    "spring", ".net", "azure", "aws", "gcp", "kubernetes", "docker", "terraform",
    "bicep", "ci/cd", "github actions", "azure devops", "postgres", "postgresql",
    "mysql", "mongodb", "cosmos db", "redis", "kafka", "rabbitmq", "spark", "airflow",
    "databricks", "snowflake", "dbt", "etl", "elt", "graphql", "rest", "grpc",
    "microservices", "distributed systems", "system design", "observability",
    "prometheus", "grafana", "datadog", "machine learning", "deep learning", "nlp",
    "pytorch", "tensorflow", "scikit-learn", "llm", "rag", "vector database",
    "openai", "azure openai", "pandas", "numpy", "unit testing", "pytest",
    "load testing", "security", "oauth", "authentication", "caching", "sharding",
    "replication", "event-driven", "serverless", "azure functions", "graph api",
]

# Words that make a claim checkable in an interview.
_METRIC_PATTERN = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:%|percent|x|ms|s\b|k\b|m\b|gb|tb|qps|rps|users|records|"
    r"requests|hours|days|weeks|months|years)",
    re.IGNORECASE,
)
_SCALE_WORDS = ("reduced", "increased", "migrated", "designed", "built", "led",
                "scaled", "shipped", "owned", "rewrote", "optimi")

_SECTION_HEADING = re.compile(r"^\s{0,3}(?:#{1,6}\s*|\*\*)?([A-Za-z][A-Za-z /&+-]{2,40}?)(?:\*\*)?\s*:?\s*$")
_BULLET = re.compile(r"^\s*[-*•]\s+(.*\S)\s*$")


_MARKDOWN_NOISE = re.compile(r"\*\*|__|`|\[|\]\([^)]*\)")


def _normalise(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def _clean(text: str) -> str:
    """Strip markdown emphasis so claims read as plain prose in a question."""
    return _MARKDOWN_NOISE.sub("", text).strip(" -*•\t")


def _find_skills(text: str) -> List[str]:
    lowered = text.lower()
    found = []
    for skill in SKILL_VOCABULARY:
        # Word-boundary match so "go" does not fire inside "going".
        pattern = r"(?<![a-z0-9+#.]){}(?![a-z0-9+#])".format(re.escape(skill))
        if re.search(pattern, lowered):
            canonical = "golang" if skill == "go" else skill
            if canonical not in found:
                found.append(canonical)
    return found


def _sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n", text)
    return [p.strip(" -*•\t") for p in parts if len(p.strip()) > 25]


def _specificity(sentence: str) -> float:
    """How checkable is this claim as written? Drives which claims we probe."""
    score = 0.15
    if _METRIC_PATTERN.search(sentence):
        score += 0.4
    if any(word in sentence.lower() for word in _SCALE_WORDS):
        score += 0.2
    skills_in_sentence = len(_find_skills(sentence))
    score += min(skills_in_sentence, 3) * 0.08
    if len(sentence.split()) > 30:
        score -= 0.1
    return round(max(0.0, min(1.0, score)), 2)


def _split_sections(text: str) -> Dict[str, List[str]]:
    """Group bullet lines under the heading that precedes them."""
    sections: Dict[str, List[str]] = {}
    current = "summary"
    sections[current] = []
    for line in text.split("\n"):
        if not line.strip():
            continue
        bullet = _BULLET.match(line)
        if bullet:
            sections.setdefault(current, []).append(bullet.group(1))
            continue
        heading = _SECTION_HEADING.match(line)
        if heading and len(line.strip()) < 45:
            current = heading.group(1).strip().lower()
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line.strip())
    return sections


def _guess_headline(text: str) -> str:
    """First prose line that is not the name and not a heading."""
    for line in text.split("\n")[1:]:
        cleaned = line.strip()
        if not cleaned or cleaned.startswith(("#", "-", "*", "•")):
            continue
        if len(cleaned.split()) > 4:
            return cleaned
    return ""


def _guess_name(text: str) -> str:
    for line in text.split("\n"):
        cleaned = line.strip().lstrip("#").strip()
        if not cleaned:
            continue
        words = cleaned.split()
        if 1 < len(words) <= 4 and all(w[:1].isupper() for w in words if w[:1].isalpha()):
            return cleaned
        break
    return "Candidate"


# A bare skills list is inventory, not an achievement - probing it produces
# "tell me about Kafka, Airflow" questions, which is exactly the low-signal
# prep we are trying to replace.
_NON_CLAIM_SECTIONS = ("skill", "education", "certification", "language", "interest", "contact")


def _extract_claims(sections: Dict[str, List[str]]) -> List[Claim]:
    claims: List[Claim] = []
    seen = set()
    for section, lines in sections.items():
        if any(marker in section for marker in _NON_CLAIM_SECTIONS):
            continue
        for line in lines:
            for raw_sentence in _sentences(line) or [line]:
                sentence = _clean(raw_sentence)
                key = sentence.lower()[:80]
                if key in seen or len(sentence.split()) < 5:
                    continue
                seen.add(key)
                skills = _find_skills(sentence)
                claims.append(
                    Claim(
                        text=sentence,
                        skill=skills[0] if skills else "general",
                        source=section,
                        specificity=_specificity(sentence),
                    )
                )
    claims.sort(key=lambda c: -c.specificity)
    return claims


def parse_portfolio(text: str, use_llm: bool = True) -> CandidateProfile:
    """Parse a resume / portfolio into a structured profile."""
    text = _normalise(text)
    sections = _split_sections(text)
    profile = CandidateProfile(
        name=_guess_name(text),
        headline=_guess_headline(text),
        skills=_find_skills(text),
        claims=_extract_claims(sections),
        projects=[l for key, lines in sections.items() if "project" in key or "experience" in key
                  for l in lines][:12],
        raw_text=text,
    )

    if use_llm:
        enriched = try_chat_json(
            system=(
                "You extract structured facts from a candidate portfolio for an "
                "interview preparation tool. Report only what the document states. "
                "Never infer seniority, demographics, or personal attributes. "
                'Return JSON: {"name": str, "headline": str, "skills": [str], '
                '"projects": [str]}'
            ),
            user=text[:12000],
            temperature=0.1,
            max_tokens=900,
        )
        if enriched:
            profile.name = enriched.get("name") or profile.name
            profile.headline = enriched.get("headline") or profile.headline
            llm_skills = [s.lower() for s in enriched.get("skills", []) if isinstance(s, str)]
            for skill in llm_skills:
                if skill not in profile.skills:
                    profile.skills.append(skill)
            llm_projects = [p for p in enriched.get("projects", []) if isinstance(p, str)]
            if llm_projects:
                profile.projects = llm_projects

    return profile


def parse_job_description(text: str, use_llm: bool = True) -> RoleSpec:
    """Parse a job description into requirements and competencies."""
    text = _normalise(text)
    sections = _split_sections(text)

    title = "Open role"
    for line in text.split("\n"):
        cleaned = line.strip().lstrip("#").strip()
        if cleaned:
            title = cleaned
            break

    level = ""
    for candidate_level in ("principal", "staff", "senior", "mid-level", "junior", "intern"):
        if candidate_level in text.lower():
            level = candidate_level
            break

    def _lines_for(*keywords: str) -> List[str]:
        out: List[str] = []
        for section, lines in sections.items():
            if any(k in section for k in keywords):
                out.extend(lines)
        return out

    must_have = _lines_for("require", "must", "qualification", "you have")
    nice_to_have = _lines_for("nice", "bonus", "preferred", "plus")

    spec = RoleSpec(
        title=title,
        level=level,
        must_have=must_have[:12],
        nice_to_have=nice_to_have[:8],
        competencies=[],
        raw_text=text,
    )
    spec.competencies = derive_competencies(spec)

    if use_llm:
        enriched = try_chat_json(
            system=(
                "You extract hiring requirements from a job description. Use only "
                "the text provided. Return JSON: "
                '{"title": str, "level": str, "must_have": [str], '
                '"nice_to_have": [str], "competencies": [str]}. '
                "Competencies are 3-6 broad evaluation areas, e.g. "
                '"distributed system design", "data modelling", "incident response".'
            ),
            user=text[:12000],
            temperature=0.1,
            max_tokens=900,
        )
        if enriched:
            spec.title = enriched.get("title") or spec.title
            spec.level = enriched.get("level") or spec.level
            for key in ("must_have", "nice_to_have", "competencies"):
                values = [v for v in enriched.get(key, []) if isinstance(v, str)]
                if values:
                    setattr(spec, key, values)

    if not spec.competencies:
        spec.competencies = derive_competencies(spec)
    return spec


# Skill -> competency buckets. Used both to derive a role's competency model
# and to decide which competency a given portfolio claim speaks to.
COMPETENCY_BUCKETS = {
    "system design": ["system design", "distributed systems", "microservices",
                      "event-driven", "grpc", "kafka", "rabbitmq", "sharding",
                      "replication", "graphql", "rest"],
    "data engineering": ["sql", "postgresql", "postgres", "mysql", "spark", "airflow",
                         "etl", "elt", "dbt", "snowflake", "databricks", "mongodb",
                         "cosmos db", "nosql", "redis"],
    "cloud and platform": ["azure", "aws", "gcp", "kubernetes", "docker", "terraform",
                           "serverless", "azure functions", "bicep", "graph api"],
    "applied AI": ["machine learning", "deep learning", "nlp", "llm", "rag", "pytorch",
                   "tensorflow", "scikit-learn", "openai", "azure openai",
                   "vector database"],
    "code quality and testing": ["unit testing", "pytest", "ci/cd", "load testing",
                                 "github actions", "azure devops"],
    "reliability and operations": ["observability", "prometheus", "grafana",
                                   "datadog", "caching", "security", "oauth",
                                   "authentication"],
}

# Words in a claim that point at a competency even when no tool is named.
_COMPETENCY_KEYWORDS = {
    "system design": ["architecture", "throughput", "latency", "partition", "queue",
                      "pipeline", "event-driven", "topic"],
    "data engineering": ["records", "warehouse", "dedup", "ingestion", "batch",
                         "dataset", "schema", "dag"],
    "cloud and platform": ["migrat", "deploy", "infrastructure", "cluster", "cloud"],
    "code quality and testing": ["testing", "contract", "coverage", "release", "lint"],
    "reliability and operations": ["on-call", "oncall", "runbook", "page", "alert",
                                   "incident", "downtime", "instrumentation"],
}


def derive_competencies(spec: RoleSpec) -> List[str]:
    """Fallback competency model built from the skills named in the JD."""
    skills = _find_skills(spec.raw_text)
    competencies = [name for name, members in COMPETENCY_BUCKETS.items()
                    if any(skill in skills for skill in members)]
    return competencies or ["core engineering fundamentals", "communication"]


def match_claims_to_role(
    profile: CandidateProfile, spec: RoleSpec, limit: int = 8
) -> List[Tuple[Claim, str]]:
    """Pair the most checkable portfolio claims with the competency they touch.

    This is what makes the questions role-specific rather than generic:
    we only probe claims that matter for the job being filled.
    """
    role_skills = set(_find_skills(spec.raw_text))
    scored: List[Tuple[float, Claim, str]] = []
    for claim in profile.claims:
        claim_skills = set(_find_skills(claim.text))
        overlap = claim_skills & role_skills
        relevance = claim.specificity + (0.25 * len(overlap))
        competency = _competency_for(claim, spec)
        scored.append((relevance, claim, competency))
    scored.sort(key=lambda row: -row[0])
    return [(claim, competency) for _, claim, competency in scored[:limit]]


def _competency_for(claim: Claim, spec: RoleSpec) -> str:
    """Score the claim against each competency the role actually cares about."""
    available = spec.competencies or list(COMPETENCY_BUCKETS)
    claim_skills = set(_find_skills(claim.text))
    lowered = claim.text.lower()

    best_name, best_score = available[0], 0
    for competency in available:
        key = competency.lower()
        score = 2 * len(claim_skills & set(COMPETENCY_BUCKETS.get(key, [])))
        score += sum(1 for word in _COMPETENCY_KEYWORDS.get(key, []) if word in lowered)
        # Competencies invented by the LLM are not in our buckets; fall back to
        # matching their own significant words against the claim.
        if key not in COMPETENCY_BUCKETS:
            score += sum(1 for word in key.split() if len(word) > 4 and word in lowered)
        if score > best_score:
            best_name, best_score = competency, score
    return best_name


def load_context(
    portfolio_text: str, job_description_text: str, use_llm: Optional[bool] = None
) -> Tuple[CandidateProfile, RoleSpec]:
    """Ingest both documents. `use_llm=None` means 'use Azure if configured'."""
    from .config import azure_configured

    enabled = azure_configured() if use_llm is None else use_llm
    return (
        parse_portfolio(portfolio_text, use_llm=enabled),
        parse_job_description(job_description_text, use_llm=enabled),
    )
